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

function extractHostname(rule: string): string | null {
  const match = rule.match(/Host\(`([^`]+)`\)/)
  return match ? match[1] : null
}

function matchDomain(hostname: string, domainRows: DomainRow[]): DomainRow | null {
  return domainRows.find(d =>
    hostname === d.domain || hostname.endsWith(`.${d.domain}`)
  ) ?? null
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
    const entryPoints = parseStringArray(row.entry_points)
    const mws = parseStringArray(row.middlewares)

    const router: Record<string, unknown> = {
      rule: row.rule,
      ...(entryPoints.length ? { entryPoints } : {}),
      service: row.name,
      ...(mws.length ? { middlewares: mws } : {}),
    }

    const hostname = extractHostname(row.rule)
    const matched = hostname ? matchDomain(hostname, domainRows) : null

    if (matched) {
      router.tls = {
        certResolver: matched.cert_resolver,
        domains: [{ main: `*.${matched.domain}` }],
      }
    } else if (row.tls_resolver) {
      const tls: Record<string, unknown> = { certResolver: row.tls_resolver }
      if (row.tls_domain) tls.domains = [{ main: row.tls_domain }]
      router.tls = tls
    }

    const endpoints = parseServiceEndpoints(row.service_url)
    if (endpoints.length === 0) continue

    httpRouters[row.name] = router
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
