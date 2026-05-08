export type ParsedEndpoint = {
  url: string
  weight: number
}

export type ParsedDomainRule = {
  subdomain: string
  domain: string
  aliases: string[]
}

export function parseEndpoints(endpoints: string): ParsedEndpoint[] {
  const trimmed = endpoints.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item): ParsedEndpoint[] => {
        if (typeof item === 'string') {
          const url = item.trim()
          return url ? [{ url, weight: 1 }] : []
        }
        if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
          const url = item.url.trim()
          const weight = typeof item.weight === 'number' ? item.weight : 1
          return url ? [{ url, weight }] : []
        }
        return []
      })
    }
  } catch {
    // Backward compatibility with older single-url values
  }

  return trimmed ? [{ url: trimmed, weight: 1 }] : []
}

function toSubdomain(hostname: string, domain: string): string | null {
  if (hostname === domain) return ''
  if (hostname.endsWith(`.${domain}`)) return hostname.slice(0, -(domain.length + 1))
  return null
}

export function parseRuleIntoDomain(
  rule: string,
  domains: Array<{ id: string; domain: string }>,
  extractHostnames: (rule: string) => string[]
): ParsedDomainRule | null {
  const hostnames = extractHostnames(rule)
  const primaryHostname = hostnames[0]
  if (!primaryHostname) return null
  for (const d of domains) {
    const primarySubdomain = toSubdomain(primaryHostname, d.domain)
    if (primarySubdomain === null) continue
    const aliases = hostnames
      .slice(1)
      .map(hostname => toSubdomain(hostname, d.domain))
      .filter((subdomain): subdomain is string => subdomain !== null && subdomain.length > 0)
    return { subdomain: primarySubdomain, domain: d.domain, aliases }
  }
  return null
}
