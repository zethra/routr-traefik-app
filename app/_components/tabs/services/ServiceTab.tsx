'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ServiceDialog } from './ServiceDialog'
import { ServiceCard } from './ServiceCard'
import { ServiceRow, RouterRow, DomainRow } from '@/lib/db'
import { extractDomain, parseSqlDate } from '@/lib/utils'
import { deleteService, toggleService } from '@/app/_actions/services'
import { toast } from 'sonner'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ServiceHealthStatusData } from './ServiceHealthStatus'
import { AppTabLayout } from '../../layout/AppTabLayout'
import { parseEndpoints } from '@/lib/serviceUtils'

type Props = {
  profileId: string
  services: ServiceRow[]
  routers: RouterRow[]
  availableEntryPoints: string[]
  availableMiddlewares: string[]
  availableDomains: DomainRow[]
}

type ServiceHealthEvent = {
  id: string
  serviceId: string
  fromUp: boolean
  toUp: boolean
  message: string
  createdAt: string
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

export function ServiceTab({
  profileId,
  services,
  routers,
  availableEntryPoints,
  availableMiddlewares,
  availableDomains,
}: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceRow | null>(null)
  const [selectedTagFilters, setSelectedTagFilters] = useState<Set<string>>(new Set())
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [healthMap, setHealthMap] = useState<Record<string, ServiceHealthStatusData>>({})
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

    const payload = await response.json() as { statuses: ServiceHealthStatusData[]; events: ServiceHealthEvent[] }

    const nextHealthMap = Object.fromEntries(payload.statuses.map((status: ServiceHealthStatusData) => [status.serviceId, status]))
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
  const allTagsSet = new Set<string>()
  services.forEach(s => {
    if (s.tag) {
      s.tag.split(',').map(t => t.trim()).forEach(t => allTagsSet.add(t))
    }
  })
  const allTags = [...allTagsSet].sort()

  const filteredServices = services.filter(service => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || (
      service.name.toLowerCase().includes(q) ||
      parseEndpoints(service.endpoints).some(ep => ep.url.toLowerCase().includes(q))
    )
    const serviceTags = service.tag ? service.tag.split(',').map(t => t.trim()).filter(Boolean) : []
    const matchesTag = selectedTagFilters.size === 0 || serviceTags.some(tag => selectedTagFilters.has(tag))
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
    .filter((status): status is ServiceHealthStatusData => status !== undefined)
  const upServices = knownHealthStatuses.filter(status => status.isUp).length
  const downServices = knownHealthStatuses.filter(status => !status.isUp).length
  const avgUptime24h = knownHealthStatuses.length > 0
    ? knownHealthStatuses.reduce((sum, status) => sum + status.uptime24h, 0) / knownHealthStatuses.length
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
    <AppTabLayout title="Services">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-none md:max-w-md">
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
          Create
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
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Filter by tag:</span>
            <DropdownMenu open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted transition-colors">
                <span className="text-sm">Tags</span>
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-1 items-start">
            {sortedServices.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                routers={routers}
                status={healthMap[service.id]}
                onEdit={setEditTarget}
              />
            ))}
          </div>
        </div>
      )}

      {addOpen && (
        <ServiceDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          profileId={profileId}
          routers={routers}
          availableEntryPoints={availableEntryPoints}
          availableMiddlewares={availableMiddlewares}
          availableDomains={availableDomains}
        />
      )}
      {editTarget && (
        <ServiceDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          profileId={profileId}
          service={editTarget}
          routers={routers}
          availableEntryPoints={availableEntryPoints}
          availableMiddlewares={availableMiddlewares}
          availableDomains={availableDomains}
        />
      )}
    </AppTabLayout>
  )
}
