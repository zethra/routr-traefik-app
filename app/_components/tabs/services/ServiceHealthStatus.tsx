'use client'

type EndpointStatus = {
  url: string
  up: boolean
  latencyMs: number | null
  error: string | null
}

export type ServiceHealthStatusData = {
  serviceId: string
  isUp: boolean
  upEndpoints: number
  totalEndpoints: number
  consecutiveFailures: number
  sinceAt: string
  lastCheckedAt: string
  lastError: string | null
  uptime24h: number
  endpointStatuses: EndpointStatus[]
}

type Props = {
  status?: ServiceHealthStatusData
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

export function ServiceHealthStatus({ status }: Props) {
  if (!status) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
        <span className="text-muted-foreground">Probing health...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {!status.isUp ? (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-400">Down</span>
            </>
          ) : status.endpointStatuses && status.endpointStatuses.some(e => !e.up) ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-300">Degraded</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Healthy</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{status.upEndpoints}/{status.totalEndpoints}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted/80 overflow-hidden">
        <div
          className={`h-full rounded-full transition-colors ${
            !status.isUp ? 'bg-red-500' : status.endpointStatuses && status.endpointStatuses.some(e => !e.up) ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${Math.max(3, clampPercent(status.uptime24h))}%` }}
        />
      </div>
      <p className="text-[9px] text-muted-foreground">{clampPercent(status.uptime24h).toFixed(1)}% uptime</p>
    </div>
  )
}
