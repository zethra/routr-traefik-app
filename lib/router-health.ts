import { profiles, routerHealth, routers } from './db'
import http from 'node:http'
import https from 'node:https'

type ServiceEndpoint = { url: string; weight: number }

type EndpointCheckResult = {
  url: string
  up: boolean
  latencyMs: number | null
  error: string | null
}

type MonitorState = {
  started?: boolean
  profileLocks: Set<string>
}

const monitorState = (globalThis as typeof globalThis & { __routrHealthMonitorState?: MonitorState })

if (!monitorState.__routrHealthMonitorState) {
  monitorState.__routrHealthMonitorState = {
    started: false,
    profileLocks: new Set<string>(),
  }
}

const state = monitorState.__routrHealthMonitorState

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
          return url ? [{ url, weight: 1 }] : []
        }
        return []
      })
    }
  } catch {
    // Backward compatibility with older single-url values.
  }

  return [{ url: trimmed, weight: 1 }]
}

function nowSqlString(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function checkEndpoint(url: string): Promise<EndpointCheckResult> {
  const start = Date.now()
  const isHttps = url.trim().toLowerCase().startsWith('https://')

  function probeEndpoint(insecureTls: boolean): Promise<{ statusCode: number | null; error: string | null }> {
    return new Promise((resolve) => {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch {
        resolve({ statusCode: null, error: 'Invalid URL' })
        return
      }

      const isHttpsUrl = parsedUrl.protocol === 'https:'
      const client = isHttpsUrl ? https : http

      const req = client.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'GET',
          headers: { 'user-agent': 'routr-health/1.0' },
          ...(isHttpsUrl ? { rejectUnauthorized: !insecureTls } : {}),
        },
        (res) => {
          res.resume()
          resolve({ statusCode: res.statusCode ?? null, error: null })
        }
      )

      req.setTimeout(5000, () => {
        req.destroy(new Error('Timeout'))
      })

      req.on('error', (error) => {
        resolve({ statusCode: null, error: error.message })
      })

      req.end()
    })
  }

  try {
    let result = await probeEndpoint(false)
    if (result.error && isHttps) {
      result = await probeEndpoint(true)
    }

    if (result.error) throw new Error(result.error)

    const statusCode = result.statusCode ?? 0
    const up = statusCode > 0 && statusCode < 500

    return {
      url,
      up,
      latencyMs: Date.now() - start,
      error: up ? null : `HTTP ${statusCode}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    return {
      url,
      up: false,
      latencyMs: Date.now() - start,
      error: message,
    }
  }
}

function summarizeFailure(results: EndpointCheckResult[]): string | null {
  const failures = results.filter(result => !result.up).slice(0, 2)
  if (failures.length === 0) return null
  return failures.map(result => `${result.url}: ${result.error ?? 'unreachable'}`).join(' | ')
}

export async function runProfileHealthChecks(profileId: string) {
  if (state.profileLocks.has(profileId)) return
  state.profileLocks.add(profileId)

  try {
    const checkedAt = nowSqlString()
    const routerRows = routers.list(profileId).filter(router => router.enabled === 1)

    for (const routerRow of routerRows) {
      const endpoints = parseServiceEndpoints(routerRow.service_url)
      if (endpoints.length === 0) {
        routerHealth.recordCheck({
          profileId,
          routerId: routerRow.id,
          isUp: false,
          upEndpoints: 0,
          totalEndpoints: 0,
          latencyMs: null,
          error: 'No endpoints configured',
          checkedAt,
        })
        continue
      }

      const results = await Promise.all(endpoints.map(endpoint => checkEndpoint(endpoint.url)))
      const upEndpoints = results.filter(result => result.up).length
      const successfulLatencies = results.filter(result => result.up && result.latencyMs !== null).map(result => result.latencyMs as number)
      const latencyMs = successfulLatencies.length > 0
        ? Math.round(successfulLatencies.reduce((sum, value) => sum + value, 0) / successfulLatencies.length)
        : null

      routerHealth.recordCheck({
        profileId,
        routerId: routerRow.id,
        isUp: upEndpoints > 0,
        upEndpoints,
        totalEndpoints: endpoints.length,
        latencyMs,
        error: upEndpoints > 0 ? null : summarizeFailure(results),
        checkedAt,
      })
    }
  } finally {
    state.profileLocks.delete(profileId)
  }
}

export async function runAllProfileHealthChecks() {
  const profileRows = profiles.list()
  for (const profile of profileRows) {
    await runProfileHealthChecks(profile.id)
  }
}

export function ensureHealthMonitorStarted() {
  if (state.started) return

  state.started = true
  void runAllProfileHealthChecks()

  const timer = setInterval(() => {
    void runAllProfileHealthChecks()
  }, 30_000)

  if (typeof (timer as NodeJS.Timeout).unref === 'function') {
    ;(timer as NodeJS.Timeout).unref()
  }
}
