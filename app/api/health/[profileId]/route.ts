import { profiles, routerHealth } from '@/lib/db'
import { ensureHealthMonitorStarted, runProfileHealthChecks } from '@/lib/router-health'

export async function GET(_req: Request, ctx: RouteContext<'/api/health/[profileId]'>) {
  const { profileId } = await ctx.params
  const profile = profiles.get(profileId)

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }

  ensureHealthMonitorStarted()
  await runProfileHealthChecks(profile.id)

  const statusRows = routerHealth.listStatus(profile.id)
  const uptimeRows = routerHealth.listUptimePercent(profile.id, 24)
  const events = routerHealth.listRecentEvents(profile.id, 20)

  const uptimeMap = new Map(uptimeRows.map(row => [row.router_id, row.uptime_percent]))

  return Response.json({
    generatedAt: new Date().toISOString(),
    statuses: statusRows.map(row => ({
      routerId: row.router_id,
      isUp: row.is_up === 1,
      upEndpoints: row.up_endpoints,
      totalEndpoints: row.total_endpoints,
      consecutiveFailures: row.consecutive_failures,
      sinceAt: row.since_at,
      lastCheckedAt: row.last_checked_at,
      lastError: row.last_error,
      uptime24h: uptimeMap.get(row.router_id) ?? 0,
    })),
    events: events.map(event => ({
      id: event.id,
      routerId: event.router_id,
      fromUp: event.from_up === 1,
      toUp: event.to_up === 1,
      message: event.message,
      createdAt: event.created_at,
    })),
  })
}
