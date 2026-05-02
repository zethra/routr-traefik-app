import type { RouterRow, MiddlewareRow, DomainRow } from './db'

type ServiceEndpoint = { url: string; weight: number }

function parseStringArray(value: string, fallback: string[] = []): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : fallback
  } catch {
    return fallback
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function normalizeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1
}

function parseServiceEndpoints(value: string): ServiceEndpoint[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item): ServiceEndpoint[] => {
        if (typeof item === 'string') {
          const url = item.trim()
          return url ? [{ url, weight: 1 }] : []
        }
        if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
          const url = item.url.trim()
          if (!url) return []

          const rawWeight = 'weight' in item ? Number(item.weight) : 1
          return [{ url, weight: normalizeWeight(rawWeight) }]
        }
        return []
      })
    }
  } catch {
    // Backward compatibility for single stored URLs.
  }

  return [{ url: trimmed, weight: 1 }]
}

function extractHostClause(rule: string): string | null {
  const match = rule.match(/Host\(([^)]*)\)/)
  return match ? match[0] : null
}

function extractHostnames(rule: string): string[] {
  const hostClause = extractHostClause(rule)
  if (!hostClause) return []
  return Array.from(hostClause.matchAll(/`([^`]+)`/g), m => m[1].trim()).filter(Boolean)
}

function replaceRuleHostname(rule: string, hostname: string): string {
  const hostClause = extractHostClause(rule)
  if (!hostClause) return rule
  return rule.replace(hostClause, `Host(\`${hostname}\`)`)
}

function aliasRouterName(baseName: string, hostname: string, index: number): string {
  const slug = hostname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `host-${index}`
  return `${baseName}--alias-${index}-${slug}`
}

function matchDomain(hostname: string, domainRows: DomainRow[]): DomainRow | null {
  return domainRows.find(d =>
    hostname === d.domain || hostname.endsWith(`.${d.domain}`)
  ) ?? null
}

function buildRouterTls(row: RouterRow, hostname: string | null, domainRows: DomainRow[]): Record<string, unknown> | null {
  const matchedDomain = hostname ? matchDomain(hostname, domainRows) : null

  if (matchedDomain) {
    return {
      certResolver: matchedDomain.cert_resolver,
      domains: [{
        main: matchedDomain.domain,
        sans: [`*.${matchedDomain.domain}`],
      }],
    }
  }

  if (!row.tls_resolver) return null

  const tls: Record<string, unknown> = { certResolver: row.tls_resolver }
  if (hostname) {
    tls.domains = [{ main: hostname }]
  } else if (row.tls_domain) {
    tls.domains = [{ main: row.tls_domain }]
  }

  return tls
}

export function buildTraefikConfig(
  routerRows: RouterRow[],
  middlewareRows: MiddlewareRow[],
  domainRows: DomainRow[] = []
) {
  const httpRouters: Record<string, unknown> = {}
  const httpServices: Record<string, unknown> = {}
  const httpMiddlewares: Record<string, unknown> = {}

  for (const row of routerRows.filter(r => r.enabled)) {
    const endpoints = parseServiceEndpoints(row.service_url)
    if (endpoints.length === 0) continue

    const entryPoints = parseStringArray(row.entry_points)
    const mws = parseStringArray(row.middlewares)
    const hostnames = extractHostnames(row.rule)

    const routerEntries = hostnames.length > 1
      ? hostnames.map((hostname, index) => ({
          name: index === 0 ? row.name : aliasRouterName(row.name, hostname, index),
          rule: replaceRuleHostname(row.rule, hostname),
          hostname,
        }))
      : [{
          name: row.name,
          rule: row.rule,
          hostname: hostnames[0] ?? null,
        }]

    for (const routerEntry of routerEntries) {
      const router: Record<string, unknown> = {
        rule: routerEntry.rule,
        ...(entryPoints.length ? { entryPoints } : {}),
        service: row.name,
        ...(mws.length ? { middlewares: mws } : {}),
      }

      const tls = buildRouterTls(row, routerEntry.hostname, domainRows)
      if (tls) router.tls = tls

      httpRouters[routerEntry.name] = router
    }

    httpServices[row.name] = {
      loadBalancer: {
        servers: endpoints.map(endpoint => ({
          url: endpoint.url,
          weight: endpoint.weight,
        })),
      },
    }
  }

  for (const row of middlewareRows.filter(m => m.enabled)) {
    httpMiddlewares[row.name] = { [row.type]: parseObject(row.config) }
  }

  const http: Record<string, unknown> = {
    routers: httpRouters,
    services: httpServices,
  }
  if (Object.keys(httpMiddlewares).length > 0) {
    http.middlewares = httpMiddlewares
  }

  return { http }
}
