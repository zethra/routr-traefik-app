'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RouterDialog } from './RouterDialog'
import { cloneRouter, deleteRouter, deleteRouters, setRoutersEnabled, toggleRouter } from '@/app/_actions/routers'
import { checkSSL } from '@/app/_actions/ssl'
import type { SSLResult } from '@/app/_actions/ssl'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldAlert, ShieldX, Loader2, Lock,
  ArrowUpDown,
  Globe, Power, Pencil, Trash2, Search, Plus, RefreshCw, Copy,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, Sparkles,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type RouterRow = {
  id: string
  name: string
  rule: string
  service_url: string
  entry_points: string
  middlewares: string
  priority: number | null
  enabled: number
}

type DomainRow = {
  id: string
  domain: string
  cert_resolver: string
}

type Props = {
  profileId: string
  routers: RouterRow[]
  entryPointNames: string[]
  middlewareNames: string[]
  domains: DomainRow[]
}

type SSLState = { status: 'checking' | 'done'; result?: SSLResult }
type ServiceEndpoint = { url: string; weight: number }
type SortField = 'name' | 'hostname' | 'endpoint' | 'type' | 'tls' | 'health'

type HealthStatus = {
  routerId: string
  isUp: boolean
  upEndpoints: number
  totalEndpoints: number
  consecutiveFailures: number
  sinceAt: string
  lastCheckedAt: string
  lastError: string | null
  uptime24h: number
}

type HealthEvent = {
  id: string
  routerId: string
  fromUp: boolean
  toUp: boolean
  message: string
  createdAt: string
}

function parseHostnames(rule: string): string[] {
  const match = rule.match(/Host\((.*)\)/)
  if (!match) return []
  return Array.from(match[1].matchAll(/`([^`]+)`/g), m => m[1].trim()).filter(Boolean)
}

function extractHostname(rule: string): string | null {
  return parseHostnames(rule)[0] ?? null
}

function SSLIcon({ state }: { state?: SSLState }) {
  if (!state || state.status === 'checking') {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
  }
  const { result } = state
  if (!result?.valid) return <ShieldX className="h-3.5 w-3.5 text-destructive" />
  if (result.daysLeft !== null && result.daysLeft <= 14) {
    return <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
  }
  return <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
}

const PAGE_SIZES = [10, 25, 50]

function matchDomain(hostname: string, domainRows: DomainRow[]): DomainRow | null {
  return domainRows.find(d => hostname === d.domain || hostname.endsWith(`.${d.domain}`)) ?? null
}

function serviceTarget(serviceUrl: string): string {
  try {
    return new URL(serviceUrl).host
  } catch {
    return serviceUrl
      .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
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
    // Backward compatibility for older single-url values.
  }

  return [{ url: trimmed, weight: 1 }]
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

export function RoutersTab({ profileId, routers, entryPointNames, middlewareNames, domains }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RouterRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sslMap, setSslMap] = useState<Record<string, SSLState>>({})
  const [sslChecking, setSslChecking] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [healthMap, setHealthMap] = useState<Record<string, HealthStatus>>({})
  const hasHydratedHealthRef = useRef(false)
  const seenHealthEventIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    hasHydratedHealthRef.current = false
    seenHealthEventIdsRef.current = new Set()
  }, [profileId])

  function triggerSSLCheck() {
    const checkable = routers.filter(r => extractHostname(r.rule) !== null)
    if (checkable.length === 0) return
    setSslChecking(true)
    setSslMap(prev => {
      const next = { ...prev }
      for (const r of checkable) next[r.id] = { status: 'checking' }
      return next
    })
    let remaining = checkable.length
    for (const r of checkable) {
      const hostname = extractHostname(r.rule)!
      checkSSL(hostname).then(result => {
        setSslMap(prev => ({ ...prev, [r.id]: { status: 'done', result } }))
        if (--remaining === 0) setSslChecking(false)
      })
    }
  }

  // Initial SSL probe on first mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { triggerSSLCheck() }, [])

  useEffect(() => {
    let cancelled = false

    async function pollHealth() {
      try {
        const response = await fetch(`/api/health/${profileId}`, { cache: 'no-store' })
        if (!response.ok) return

        const payload = await response.json() as { statuses: HealthStatus[]; events: HealthEvent[] }
        if (cancelled) return

        const nextHealthMap = Object.fromEntries(payload.statuses.map(status => [status.routerId, status]))
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

          const router = routers.find(r => r.id === event.routerId)
          const routerName = router?.name ?? 'Router'
          const duration = formatDurationSince(event.createdAt)

          if (event.toUp) {
            toast.success(`${routerName} recovered`, { description: `State changed ${duration} ago` })
          } else {
            toast.error(`${routerName} is down`, { description: `State changed ${duration} ago` })
          }
        }
      } catch {
        // Ignore transient polling errors.
      }
    }

    void pollHealth()
    const interval = setInterval(() => { void pollHealth() }, 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [profileId, routers])

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete router "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteRouter(id)
        toast.success('Router deleted')
      } catch {
        toast.error('Failed to delete router')
      }
    })
  }

  function handleToggle(id: string, current: number) {
    startTransition(async () => { await toggleRouter(id, current === 0) })
  }

  function handleClone(routerId: string, routerName: string) {
    startTransition(async () => {
      try {
        await cloneRouter(profileId, routerId)
        toast.success(`Cloned "${routerName}"`)
      } catch {
        toast.error('Failed to clone router')
      }
    })
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds(prev => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter(x => x !== id)
    })
  }

  const filtered = routers.filter(r => {
    const q = search.toLowerCase()
    const endpoints = parseServiceEndpoints(r.service_url)
    const hostnames = parseHostnames(r.rule)
    return (
      r.name.toLowerCase().includes(q) ||
      hostnames.some(hostname => hostname.toLowerCase().includes(q)) ||
      endpoints.some(endpoint => endpoint.url.toLowerCase().includes(q))
    )
  })

  function toggleSort(field: SortField) {
    setPage(1)
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  function sortValue(row: RouterRow, field: SortField): string | number {
    const hostname = extractHostname(row.rule) ?? row.rule
    const endpoints = parseServiceEndpoints(row.service_url)
    const primaryEndpoint = endpoints[0]?.url ?? ''

    switch (field) {
      case 'name':
        return row.name.toLowerCase()
      case 'hostname':
        return hostname.toLowerCase()
      case 'endpoint':
        return serviceTarget(primaryEndpoint).toLowerCase()
      case 'type':
        return matchDomain(hostname, domains) ? 'https' : 'http'
      case 'health': {
        const status = healthMap[row.id]
        if (!status) return 0
        return status.isUp ? 200 + status.uptime24h : 100 - status.consecutiveFailures
      }
      case 'tls': {
        const matched = matchDomain(hostname, domains)
        if (!matched) return 0
        const state = sslMap[row.id]
        if (!state || state.status === 'checking') return 1
        if (!state.result?.valid) return 2
        if (state.result.daysLeft !== null && state.result.daysLeft <= 14) return 3
        return 4
      }
    }
  }

  const filteredSorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortField)
    const bv = sortValue(b, sortField)
    const factor = sortDirection === 'asc' ? 1 : -1

    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * factor
    }

    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * factor
  })

  const validRouterIds = new Set(routers.map(r => r.id))
  const validSelectedIds = selectedIds.filter(id => validRouterIds.has(id))
  const validSelectedSet = new Set(validSelectedIds)
  const selectedRouters = routers.filter(r => validSelectedSet.has(r.id))
  const hasSelectedEnabled = selectedRouters.some(r => r.enabled === 1)
  const hasSelectedDisabled = selectedRouters.some(r => r.enabled === 0)
  const disableBulkEnable = isPending || !hasSelectedDisabled
  const disableBulkDisable = isPending || !hasSelectedEnabled

  const knownHealthStatuses = filtered
    .map(router => healthMap[router.id])
    .filter((status): status is HealthStatus => status !== undefined)
  const upRouters = knownHealthStatuses.filter(status => status.isUp).length
  const downRouters = knownHealthStatuses.filter(status => !status.isUp).length
  const avgUptime24h = knownHealthStatuses.length > 0
    ? knownHealthStatuses.reduce((sum, status) => sum + clampPercent(status.uptime24h), 0) / knownHealthStatuses.length
    : 0

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filteredSorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const paginatedIds = paginated.map(r => r.id)
  const selectedOnPage = paginatedIds.filter(id => validSelectedIds.includes(id)).length
  const allOnPageSelected = paginatedIds.length > 0 && selectedOnPage === paginatedIds.length

  function togglePageSelection(checked: boolean) {
    setSelectedIds(prev => {
      if (checked) {
        return Array.from(new Set([...prev, ...paginatedIds]))
      }
      const toRemove = new Set(paginatedIds)
      return prev.filter(id => !toRemove.has(id))
    })
  }

  function handleBulkDelete() {
    if (validSelectedIds.length === 0) return
    if (!confirm(`Delete ${validSelectedIds.length} selected router(s)?`)) return
    startTransition(async () => {
      try {
        await deleteRouters(validSelectedIds)
        setSelectedIds([])
        toast.success(`Deleted ${validSelectedIds.length} router(s)`)
      } catch {
        toast.error('Failed to delete selected routers')
      }
    })
  }

  function handleBulkEnable() {
    if (validSelectedIds.length === 0 || disableBulkEnable) return
    startTransition(async () => {
      try {
        await setRoutersEnabled(validSelectedIds, true)
        toast.success(`Enabled ${validSelectedIds.length} router(s)`)
      } catch {
        toast.error('Failed to enable selected routers')
      }
    })
  }

  function handleBulkDisable() {
    if (validSelectedIds.length === 0 || disableBulkDisable) return
    startTransition(async () => {
      try {
        await setRoutersEnabled(validSelectedIds, false)
        toast.success(`Disabled ${validSelectedIds.length} router(s)`)
      } catch {
        toast.error('Failed to disable selected routers')
      }
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-b from-background via-background to-muted/10 p-3 md:p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm rounded-xl border-border/70 bg-background/70"
            placeholder="Search..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerSSLCheck}
          disabled={sslChecking}
          className="h-9 rounded-xl border border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${sslChecking ? 'animate-spin' : ''}`} />
          SSL
        </Button>
        {validSelectedIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="group inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:scale-110" />
              <span>Actions</span>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-foreground ring-1 ring-border/70">
                {validSelectedIds.length}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-xl border border-border/70 bg-popover/95 p-1.5 shadow-xl backdrop-blur">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 text-[11px] uppercase tracking-[0.08em]">
                  Bulk Operations
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={handleBulkEnable} disabled={disableBulkEnable}>
                  <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  Enable
                  <DropdownMenuShortcut>ON</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkDisable} disabled={disableBulkDisable}>
                  <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  Disable
                  <DropdownMenuShortcut>OFF</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                  <DropdownMenuShortcut>DEL</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="flex-1" />
        <Button size="sm" className="h-9 gap-1.5 rounded-xl border border-border/70 bg-foreground text-background hover:bg-foreground/90" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create Router
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-600/20 px-2.5 py-1 text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {upRouters} up
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-600/20 px-2.5 py-1 text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
          {downRouters} down
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-foreground">
          Avg uptime {avgUptime24h.toFixed(1)}%
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/70 bg-background/60 shadow-[0_12px_40px_rgba(0,0,0,0.25)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4 py-3 w-[44px]">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={checked => togglePageSelection(checked === true)}
                  aria-label="Select all routers on this page"
                  className="align-middle"
                />
              </TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[180px]">
                <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Router
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-[240px] pl-4 pr-1 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                <button type="button" onClick={() => toggleSort('hostname')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Hostname
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-[40px] px-0 py-3" />
              <TableHead className="w-[240px] pl-3 pr-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                <button type="button" onClick={() => toggleSort('endpoint')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Endpoint
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[100px]">
                <button type="button" onClick={() => toggleSort('type')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Type
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[180px]">
                <button type="button" onClick={() => toggleSort('tls')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  TLS
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[190px]">
                <button type="button" onClick={() => toggleSort('health')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Health
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 w-[150px]"/>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                  {search ? 'No routers match your search.' : 'No routers yet.'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r, i) => {
                const hostname = extractHostname(r.rule)
                const aliases = parseHostnames(r.rule).slice(1)
                const endpoints = parseServiceEndpoints(r.service_url)
                const primaryEndpoint = endpoints[0]
                const isLast = i === paginated.length - 1
                const isSelected = selectedIds.includes(r.id)
                return (
                  <TableRow
                    key={r.id}
                    className={`hover:bg-muted/35 transition-colors ${!isLast ? 'border-b border-border/60' : ''} ${!r.enabled ? 'opacity-50' : ''}`}
                  >
                    <TableCell className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={checked => toggleSelection(r.id, checked === true)}
                        aria-label={`Select router ${r.name}`}
                        className="align-middle"
                      />
                    </TableCell>

                    {/* Name */}
                    <TableCell className="px-4 py-3">
                      <span className="font-medium">{r.name}</span>
                    </TableCell>

                    {/* Rule */}
                    <TableCell className="w-[240px] pl-4 pr-1 py-3 whitespace-nowrap">
                      {hostname ? (
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`https://${hostname}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-foreground hover:text-foreground/80 underline underline-offset-2 font-mono text-xs"
                            title={`Open https://${hostname}`}
                          >
                            {hostname}
                          </a>
                          {aliases.length > 0 && (
                            <span
                              className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              title={aliases.join('\n')}
                            >
                              +{aliases.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">
                          {r.rule}
                        </span>
                      )}
                    </TableCell>

                    {/* Arrow */}
                    <TableCell className="w-[40px] pr-1 py-3 text-center text-muted-foreground font-mono text-xs">
                      -&gt;
                    </TableCell>

                    {/* Services */}
                    <TableCell className="w-[240px] pl-3 pr-4 py-3 whitespace-nowrap">
                      {primaryEndpoint?.url ? (
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={primaryEndpoint.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-foreground hover:text-foreground/80 underline underline-offset-2 font-mono text-xs"
                            title={`Open ${primaryEndpoint.url} (weight ${primaryEndpoint.weight})`}
                          >
                            {serviceTarget(primaryEndpoint.url)}
                          </a>
                          {endpoints.length > 1 && (
                            <span
                              className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              title={endpoints.slice(1).map(endpoint => `${endpoint.url} (weight ${endpoint.weight})`).join('\n')}
                            >
                              +{endpoints.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No service</span>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-border bg-muted text-foreground">
                        <Globe className="h-3 w-3" />
                        {matchDomain(hostname ?? '', domains) ? 'HTTPS' : 'HTTP'}
                      </span>
                    </TableCell>

                    {/* TLS */}
                    <TableCell className="px-4 py-3">
                      {(() => {
                        const matched = hostname ? matchDomain(hostname, domains) : null
                        const sslState = sslMap[r.id]
                        const tooltip = sslState?.status === 'done' && sslState.result?.valid && sslState.result.daysLeft !== null
                          ? `Valid for ${sslState.result.daysLeft} days`
                          : null

                        const encryptedBadge = (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground border border-border">
                            <Lock className="h-3 w-3" />
                            Encrypted
                            <SSLIcon state={sslState} />
                          </span>
                        )

                        if (matched) return (
                          tooltip ? (
                            <Tooltip>
                              <TooltipTrigger className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground border border-border">
                                <Lock className="h-3 w-3" />
                                Encrypted
                                <SSLIcon state={sslState} />
                              </TooltipTrigger>
                              <TooltipContent>
                                {tooltip}
                              </TooltipContent>
                            </Tooltip>
                          ) : encryptedBadge
                        )
                        if (hostname) return (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-foreground border border-border">
                            <Lock className="h-3 w-3" />
                            <SSLIcon state={sslState} />
                          </span>
                        )
                        return null
                      })()}
                    </TableCell>

                    {/* Health */}
                    <TableCell className="px-4 py-3">
                      {(() => {
                        const status = healthMap[r.id]
                        if (!status) {
                          return (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-border bg-muted text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                Probing
                              </span>
                              <p className="text-[11px] text-muted-foreground">Gathering first checks</p>
                            </div>
                          )
                        }

                        const uptime = clampPercent(status.uptime24h)
                        const endpointRatio = status.totalEndpoints > 0
                          ? `${status.upEndpoints}/${status.totalEndpoints} endpoints`
                          : 'No endpoints'
                        const since = formatDurationSince(status.sinceAt)

                        if (status.isUp) {
                          return (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-emerald-500/30 bg-emerald-600/20 text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                Up
                              </span>
                              <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-foreground/85"
                                  style={{ width: `${Math.max(6, uptime)}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                {uptime.toFixed(1)}% / 24h · {endpointRatio}
                              </p>
                            </div>
                          )
                        }

                        return (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-red-500/30 bg-red-600/20 text-red-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-300 animate-pulse" />
                              Down
                            </span>
                            <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-foreground/35"
                                style={{ width: `${Math.max(6, uptime)}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-tight" title={status.lastError ?? undefined}>
                              {since} down · {endpointRatio}
                            </p>
                          </div>
                        )
                      })()}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            aria-label={`Open actions for ${r.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleToggle(r.id, r.enabled)} disabled={isPending}>
                              <Power className="h-3.5 w-3.5 text-muted-foreground" />
                              {r.enabled ? 'Disable' : 'Enable'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleClone(r.id, r.name)} disabled={isPending}>
                              <Copy className="h-3.5 w-3.5" />
                              Clone
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditTarget(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDelete(r.id, r.name)}
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className="h-7 w-16 rounded-lg border-border/70 bg-background/70 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(s => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>Total {filtered.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(1)} disabled={safePage === 1} className="p-1 rounded-md hover:bg-muted disabled:opacity-30"><ChevronsLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1 rounded-md hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-2">Page {safePage} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1 rounded-md hover:bg-muted disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
          <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="p-1 rounded-md hover:bg-muted disabled:opacity-30"><ChevronsRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <RouterDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        profileId={profileId}
        availableEntryPoints={entryPointNames}
        availableMiddlewares={middlewareNames}
        availableDomains={domains}
      />
      {editTarget && (
        <RouterDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          router={editTarget}
          profileId={profileId}
          availableEntryPoints={entryPointNames}
          availableMiddlewares={middlewareNames}
          availableDomains={domains}
          />
      )}
    </div>
  )
}
