import type { RouterRow, MiddlewareRow, DomainRow } from './db'

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
    const entryPoints: string[] = JSON.parse(row.entry_points)
    const mws: string[] = JSON.parse(row.middlewares)

    const router: Record<string, unknown> = {
      rule: row.rule,
      ...(entryPoints.length ? { entryPoints } : {}),
      service: row.name,
      ...(mws.length ? { middlewares: mws } : {}),
      ...(row.priority != null ? { priority: row.priority } : {}),
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

    httpRouters[row.name] = router
    httpServices[row.name] = {
      loadBalancer: { servers: [{ url: row.service_url }] },
    }
  }

  for (const row of middlewareRows.filter(m => m.enabled)) {
    httpMiddlewares[row.name] = { [row.type]: JSON.parse(row.config) }
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
