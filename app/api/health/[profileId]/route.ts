import { profiles, serviceHealth } from '@/lib/db'
import { ensureHealthMonitorStarted, runProfileHealthChecks } from '@/lib/router-health'

export async function GET(req: Request, ctx: RouteContext<'/api/health/[profileId]'>) {
  const { profileId } = await ctx.params
  const profile = profiles.get(profileId)

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }

  ensureHealthMonitorStarted()
  const force = new URL(req.url).searchParams.get('force') === '1'
  if (force) {
    await runProfileHealthChecks(profile.id)
  }

  const statusRows = serviceHealth.listStatus(profile.id)
  const uptimeRows = serviceHealth.listUptimePercent(profile.id, 24)
  const events = serviceHealth.listRecentEvents(profile.id, 20)

  const uptimeMap = new Map(uptimeRows.map(row => [row.service_id, row.uptime_percent]))

  return Response.json({
    generatedAt: new Date().toISOString(),
    statuses: statusRows.map(row => {
      let endpointStatuses: any[] = []
      if (row.endpoint_status) {
        try {
          endpointStatuses = JSON.parse(row.endpoint_status)
        } catch {
          // Ignore parse errors
        }
      }
      return {
        serviceId: row.service_id,
        isUp: row.is_up === 1,
        upEndpoints: row.up_endpoints,
        totalEndpoints: row.total_endpoints,
        consecutiveFailures: row.consecutive_failures,
        sinceAt: row.since_at,
        lastCheckedAt: row.last_checked_at,
        lastError: row.last_error,
        uptime24h: uptimeMap.get(row.service_id) ?? 0,
        endpointStatuses,
      }
    }),
    events: events.map(event => ({
      id: event.id,
      serviceId: event.service_id,
      fromUp: event.from_up === 1,
      toUp: event.to_up === 1,
      message: event.message,
      createdAt: event.created_at,
    })),
  })
}
