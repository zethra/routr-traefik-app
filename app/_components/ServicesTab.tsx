'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ServiceDialog } from './ServiceDialog'
import { deleteService, toggleService, updateService } from '@/app/_actions/services'
import { toast } from 'sonner'
import { EyeOff, MoreHorizontal, Pencil, Plus, Search, Trash2, RefreshCw } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Toggle } from '@/components/ui/toggle'

type ServiceRow = {
  id: string
  name: string
  endpoints: string
  logo: string | null
  tag: string | null
  enabled: number
  profile_id: string
  created_at: string
  updated_at: string
}

type Props = {
  profileId: string
  services: ServiceRow[]
}

type EndpointStatus = {
  url: string
  up: boolean
  latencyMs: number | null
  error: string | null
}

type ServiceHealthStatus = {
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

type ServiceHealthEvent = {
  id: string
  serviceId: string
  fromUp: boolean
  toUp: boolean
  message: string
  createdAt: string
}

function parseEndpoints(endpoints: string): string[] {
  const trimmed = endpoints.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item): string[] => {
        if (typeof item === 'string') {
          const url = item.trim()
          return url ? [url] : []
        }
        if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
          const url = item.url.trim()
          return url ? [url] : []
        }
        return []
      })
    }
  } catch {
    // Backward compatibility with older single-url values
  }

  return trimmed ? [trimmed] : []
}

function formatCreated(value: string): string {
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function parseSqlDate(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`
  return new Date(withZone)
}

function formatDurationSince(value: string): string {
  const date = parseSqlDate(value)
  const ms = Date.now() - date.getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'

  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h ${totalMinutes % 60}m`
  const totalDays = Math.floor(totalHours / 24)
  return `${totalDays}d ${totalHours % 24}h`
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function TagDropdown({ service, allServices, onClose }: { service: ServiceRow; allServices: ServiceRow[]; onClose: () => void }) {
  const [newTag, setNewTag] = useState('')
  const [isPending, startTransition] = useTransition()

  const existingTags = [...new Set(allServices.filter(s => s.tag).map(s => s.tag!))]
    .sort()

  const handleSelectTag = (tag: string) => {
    startTransition(async () => {
      try {
        await updateService(service.id, service.name, parseEndpoints(service.endpoints), service.logo, tag)
        toast.success('Service updated')
        onClose()
      } catch {
        toast.error('Failed to update service')
      }
    })
  }

  const handleCreateTag = () => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    handleSelectTag(trimmed)
    setNewTag('')
  }

  return (
    <div className="absolute top-full left-0 mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
      {existingTags.map(tag => (
        <button
          key={tag}
          onClick={() => handleSelectTag(tag)}
          disabled={isPending}
          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          {tag}
        </button>
      ))}
      <div className="border-t border-border my-1" />
      <div className="px-2 py-2 flex gap-1">
        <input
          type="text"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
          placeholder="New tag…"
          disabled={isPending}
          className="flex-1 px-2 py-1 text-xs bg-muted border border-border rounded placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
        />
        <button
          onClick={handleCreateTag}
          disabled={!newTag.trim() || isPending}
          className="px-2 py-1 text-xs bg-foreground text-background rounded hover:bg-foreground/90 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function ServicesTab({ profileId, services }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceRow | null>(null)
  const [openTagDropdown, setOpenTagDropdown] = useState<string | null>(null)
  const [selectedTagFilters, setSelectedTagFilters] = useState<Set<string>>(new Set())
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [healthMap, setHealthMap] = useState<Record<string, ServiceHealthStatus>>({})
  const [healthRefreshing, setHealthRefreshing] = useState(false)
  const hasHydratedHealthRef = useRef(false)
  const seenHealthEventIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    hasHydratedHealthRef.current = false
    seenHealthEventIdsRef.current = new Set()
  }, [profileId])

  const refreshHealth = useCallback(async (force = false) => {
    const endpoint = force ? `/api/health/${profileId}?force=1` : `/api/health/${profileId}`
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (!response.ok) return

    const payload = await response.json() as { statuses: ServiceHealthStatus[]; events: ServiceHealthEvent[] }

    const nextHealthMap = Object.fromEntries(payload.statuses.map((status: ServiceHealthStatus) => [status.serviceId, status]))
    setHealthMap(nextHealthMap)

    const orderedEvents = [...payload.events].reverse()

    if (!hasHydratedHealthRef.current) {
      for (const event of orderedEvents) seenHealthEventIdsRef.current.add(event.id)
      hasHydratedHealthRef.current = true
      return
    }

    for (const event of orderedEvents) {
      if (seenHealthEventIdsRef.current.has(event.id)) continue
      seenHealthEventIdsRef.current.add(event.id)

      const service = services.find(s => s.id === event.serviceId)
      const serviceName = service?.name ?? 'Service'
      const duration = formatDurationSince(event.createdAt)

      if (event.toUp) {
        toast.success(`${serviceName} recovered`, { description: `State changed ${duration} ago` })
      } else {
        toast.error(`${serviceName} is down`, { description: `State changed ${duration} ago` })
      }
    }
  }, [profileId, services])

  useEffect(() => {
    let cancelled = false

    async function initHealth() {
      try {
        if (cancelled) return
        await refreshHealth(true)
      } catch {
        // Ignore errors on initial check
      }
    }

    void initHealth()
  }, [profileId])

  useEffect(() => {
    let cancelled = false

    async function pollHealth() {
      try {
        if (cancelled) return
        await refreshHealth(false)
      } catch {
        // Ignore transient polling errors.
      }
    }

    const interval = setInterval(() => { void pollHealth() }, 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [refreshHealth])

  // Get all unique tags
  const allTags = [...new Set(services.filter(s => s.tag).map(s => s.tag!))].sort()

  const filteredServices = services.filter(service => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || (
      service.name.toLowerCase().includes(q) ||
      parseEndpoints(service.endpoints).some(ep => ep.toLowerCase().includes(q))
    )
    const matchesTag = selectedTagFilters.size === 0 || (service.tag && selectedTagFilters.has(service.tag))
    return matchesSearch && matchesTag
  })

  const sortedServices = [...filteredServices].sort((a, b) => a.name.localeCompare(b.name))

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove service "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteService(id)
        toast.success('Service removed')
      } catch {
        toast.error('Failed to remove service')
      }
    })
  }

  function handleToggle(id: string, enabled: number) {
    startTransition(async () => {
      try {
        await toggleService(id, enabled === 0)
      } catch {
        toast.error('Failed to update service')
      }
    })
  }

  const knownHealthStatuses = services
    .map(service => healthMap[service.id])
    .filter((status): status is ServiceHealthStatus => status !== undefined)
  const upServices = knownHealthStatuses.filter(status => status.isUp).length
  const downServices = knownHealthStatuses.filter(status => !status.isUp).length
  const avgUptime24h = knownHealthStatuses.length > 0
    ? knownHealthStatuses.reduce((sum, status) => sum + clampPercent(status.uptime24h), 0) / knownHealthStatuses.length
    : 0

  function handleRefreshHealth() {
    setHealthRefreshing(true)
    refreshHealth(true)
      .catch(() => {
        toast.error('Failed to refresh health checks')
      })
      .finally(() => {
        setHealthRefreshing(false)
      })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-b from-background via-background to-muted/10 p-3 md:p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm rounded-xl border-border/70 bg-background/70"
            placeholder="Search services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefreshHealth}
          disabled={healthRefreshing}
          className="h-9 w-9 rounded-xl border border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"
          title="Refresh health"
          aria-label="Refresh health"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${healthRefreshing ? 'animate-spin' : ''}`} />
        </Button>
        <div className="flex-1" />
        <Button size="sm" className="h-9 gap-1.5 rounded-xl border border-border/70 bg-foreground text-background hover:bg-foreground/90" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create Service
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-600/20 px-2.5 py-1 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {upServices} up
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-600/20 px-2.5 py-1 text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
          {downServices} down
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-foreground">
          Avg uptime {avgUptime24h.toFixed(1)}%
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        Services group backend endpoints for load balancing. Routers reference services to route traffic to multiple servers.
      </p>

      {services.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No services configured.</p>
      ) : filteredServices.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No services match your search.</p>
      ) : (
        <div className="rounded-xl border border-border/70 bg-background/60 shadow-[0_12px_40px_rgba(0,0,0,0.25)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-2 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[50px]">Logo</TableHead>
                <TableHead className="px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground">Name</TableHead>
                <TableHead className="px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[100px]">
                  <DropdownMenu open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                    <DropdownMenuTrigger className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      <span>Tag</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {allTags.map(tag => (
                        <DropdownMenuItem
                          key={tag}
                          onClick={() => {
                            const newSelected = new Set(selectedTagFilters)
                            if (newSelected.has(tag)) {
                              newSelected.delete(tag)
                            } else {
                              newSelected.add(tag)
                            }
                            setSelectedTagFilters(newSelected)
                          }}
                          className={selectedTagFilters.has(tag) ? 'bg-foreground/10' : ''}
                        >
                          {tag}
                        </DropdownMenuItem>
                      ))}
                      {selectedTagFilters.size > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setSelectedTagFilters(new Set())}
                            className="text-xs"
                          >
                            Clear filters
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Health</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[110px]">Added</TableHead>
                <TableHead className="px-4 py-3 w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedServices.map(service => {
                const endpoints = parseEndpoints(service.endpoints)
                return (
                  <TableRow key={service.id} className={`hover:bg-muted/35 transition-colors ${service.enabled === 0 ? 'opacity-50' : ''}`}>
                    <TableCell className="px-2 py-3">
                      {service.logo ? (
                        <img
                          src={service.logo}
                          alt={service.name}
                          className="h-8 w-8 rounded object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <span className="font-medium text-sm">{service.name}</span>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setOpenTagDropdown(openTagDropdown === service.id ? null : service.id)}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                            service.tag
                              ? 'bg-muted border-border text-muted-foreground'
                              : 'bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {service.tag ?? 'Add tag'}
                        </button>
                        {openTagDropdown === service.id && (
                          <TagDropdown
                            service={service}
                            allServices={services}
                            onClose={() => setOpenTagDropdown(null)}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {(() => {
                        const status = healthMap[service.id]
                        if (!status) {
                          return (
                            <div className="space-y-1 py-1">
                              <div className="flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs border border-border bg-muted text-muted-foreground w-fit">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                                Probing
                              </div>
                              {endpoints.length > 0 && (
                                <div className="space-y-1">
                                  {endpoints.map((ep, idx) => (
                                    <div key={idx} className="text-[10px] font-mono text-muted-foreground truncate">
                                      {ep.replace(/^https?:\/\//, '')}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        }

                        const uptime = clampPercent(status.uptime24h)
                        const hasDownEndpoints = status.endpointStatuses && status.endpointStatuses.some(e => !e.up)
                        const isDegraded = status.isUp && hasDownEndpoints
                        const isDown = !status.isUp

                        return (
                          <div className="space-y-2 py-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {isDown ? (
                                  <>
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-xs font-semibold text-red-400">Down</span>
                                  </>
                                ) : isDegraded ? (
                                  <>
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                    <span className="text-xs font-semibold text-amber-300">Degraded</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                    <span className="text-xs font-semibold text-emerald-300">Healthy</span>
                                  </>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{status.upEndpoints}/{status.totalEndpoints}</span>
                            </div>

                            {status.endpointStatuses && status.endpointStatuses.length > 0 && (
                              <div className="space-y-1">
                                {status.endpointStatuses.map((ep, idx) => (
                                  <div key={idx} className={`flex items-center gap-2 px-2 py-1 rounded-md border text-[10px] transition-colors ${
                                    ep.up
                                      ? 'bg-emerald-500/10 border-emerald-500/30'
                                      : 'bg-red-500/10 border-red-500/30'
                                  }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${ep.up ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    <div className="flex-1 min-w-0 truncate font-mono text-muted-foreground">
                                      {ep.url.replace(/^https?:\/\//, '')}
                                    </div>
                                    {ep.latencyMs && (
                                      <span className={`flex-shrink-0 ${ep.up ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {ep.latencyMs}ms
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="space-y-0.5">
                              <div className="h-1 w-full rounded-full bg-muted/80 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-colors ${
                                    isDown ? 'bg-red-500' : isDegraded ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`}
                                  style={{ width: `${Math.max(3, uptime)}%` }}
                                />
                              </div>
                              <p className="text-[9px] text-muted-foreground">
                                {uptime.toFixed(1)}% uptime
                              </p>
                            </div>
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatCreated(service.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Toggle
                          size="sm"
                          pressed={service.enabled === 1}
                          onPressedChange={() => handleToggle(service.id, service.enabled)}
                          disabled={isPending}
                          className="h-8 w-8"
                          aria-label="Toggle service"
                        >
                          <EyeOff className="h-4 w-4" />
                        </Toggle>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            aria-label={`Open actions for ${service.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setEditTarget(service)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDelete(service.id, service.name)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ServiceDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
      {editTarget && (
        <ServiceDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          profileId={profileId}
          service={editTarget}
        />
      )}
    </div>
  )
}
