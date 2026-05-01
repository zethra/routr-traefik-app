'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RouterDialog } from './RouterDialog'
import { cloneRouter, deleteRouter, deleteRouters, setRoutersEnabled, toggleRouter } from '@/app/_actions/routers'
import { checkSSL } from '@/app/_actions/ssl'
import type { SSLResult } from '@/app/_actions/ssl'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldAlert, ShieldX, Loader2, Lock,
  Globe, Power, Pencil, Trash2, Search, Plus, RefreshCw, Copy,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles,
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

function extractHostname(rule: string): string | null {
  const match = rule.match(/Host\(`([^`]+)`\)/)
  return match ? match[1] : null
}

function Pill({ label, variant = 'default' }: { label: string; variant?: 'default' | 'blue' | 'muted' }) {
  const cls = variant === 'blue'
    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
    : variant === 'muted'
    ? 'bg-muted text-muted-foreground border border-border'
    : 'bg-muted text-foreground border border-border'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function SSLIcon({ state }: { state?: SSLState }) {
  if (!state || state.status === 'checking') {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
  }
  const { result } = state
  if (!result?.valid) return <ShieldX className="h-3.5 w-3.5 text-destructive" />
  if (result.daysLeft !== null && result.daysLeft <= 14) {
    return <span title={`Expires in ${result.daysLeft}d`}><ShieldAlert className="h-3.5 w-3.5 text-amber-500" /></span>
  }
  return <span title={`Valid · ${result.daysLeft}d`}><ShieldCheck className="h-3.5 w-3.5 text-green-500" /></span>
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
    return (
      r.name.toLowerCase().includes(q) ||
      (extractHostname(r.rule) ?? '').toLowerCase().includes(q) ||
      r.service_url.toLowerCase().includes(q)
    )
  })

  const validRouterIds = new Set(routers.map(r => r.id))
  const validSelectedIds = selectedIds.filter(id => validRouterIds.has(id))
  const validSelectedSet = new Set(validSelectedIds)
  const selectedRouters = routers.filter(r => validSelectedSet.has(r.id))
  const hasSelectedEnabled = selectedRouters.some(r => r.enabled === 1)
  const hasSelectedDisabled = selectedRouters.some(r => r.enabled === 0)
  const disableBulkEnable = isPending || !hasSelectedDisabled
  const disableBulkDisable = isPending || !hasSelectedEnabled

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
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
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm"
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
          className="text-muted-foreground h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${sslChecking ? 'animate-spin' : ''}`} />
          SSL
        </Button>
        {validSelectedIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="group inline-flex h-9 items-center gap-2 rounded-lg border border-blue-500/35 bg-gradient-to-r from-blue-600/15 via-cyan-500/10 to-blue-600/15 px-3 text-sm font-medium text-blue-200 shadow-sm transition-all hover:border-blue-400/60 hover:from-blue-600/20 hover:to-cyan-500/20 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
              <Sparkles className="h-3.5 w-3.5 text-blue-300 transition-transform group-hover:scale-110" />
              <span>Actions</span>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[11px] leading-none text-blue-100 ring-1 ring-blue-400/30">
                {validSelectedIds.length}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-blue-300/90 transition-transform group-data-[popup-open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-xl border border-blue-500/20 bg-popover/95 p-1.5 shadow-xl backdrop-blur">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 text-[11px] uppercase tracking-[0.08em]">
                  Bulk Operations
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={handleBulkEnable} disabled={disableBulkEnable}>
                  <Power className={`h-3.5 w-3.5 ${disableBulkEnable ? 'text-muted-foreground' : 'text-emerald-500'}`} />
                  Enable
                  <DropdownMenuShortcut>ON</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkDisable} disabled={disableBulkDisable}>
                  <Power className={`h-3.5 w-3.5 ${disableBulkDisable ? 'text-muted-foreground' : 'text-amber-500'}`} />
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
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create Router
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4 py-3 w-[44px]">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={checked => togglePageSelection(checked === true)}
                  aria-label="Select all routers on this page"
                  className="align-middle"
                />
              </TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[180px]">Router</TableHead>
              <TableHead className="w-[240px] pl-4 pr-1 py-3 text-xs uppercase tracking-wide text-muted-foreground">Hostname</TableHead>
              <TableHead className="w-[40px] px-0 py-3" />
              <TableHead className="w-[240px] pl-3 pr-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Services</TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[100px]">Type</TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[150px]">Entry Points</TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[150px]">Middlewares</TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[180px]">TLS</TableHead>
              <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                  {search ? 'No routers match your search.' : 'No routers yet.'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r, i) => {
                const eps: string[] = JSON.parse(r.entry_points)
                const mws: string[] = JSON.parse(r.middlewares)
                const hostname = extractHostname(r.rule)
                const isLast = i === paginated.length - 1
                const isSelected = selectedIds.includes(r.id)
                return (
                  <TableRow
                    key={r.id}
                    className={`hover:bg-muted/30 transition-colors ${!isLast ? 'border-b' : ''} ${!r.enabled ? 'opacity-50' : ''}`}
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
                      {r.priority != null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">p{r.priority}</span>
                      )}
                    </TableCell>

                    {/* Rule */}
                    <TableCell className="w-[240px] pl-4 pr-1 py-3 whitespace-nowrap">
                      {hostname ? (
                        <a
                          href={`https://${hostname}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-mono text-xs"
                          title={`Open https://${hostname}`}
                        >
                          {hostname}
                        </a>
                      ) : (
                        <span className="text-blue-400 font-mono text-xs">
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
                      <a
                        href={r.service_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-mono text-xs"
                        title={`Open ${r.service_url}`}
                      >
                        {serviceTarget(r.service_url)}
                      </a>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-border bg-muted text-foreground">
                        <Globe className="h-3 w-3" />
                        {matchDomain(hostname ?? '', domains) ? 'HTTPS' : 'HTTP'}
                      </span>
                    </TableCell>

                    {/* Entry Points */}
                    <TableCell className="px-4 py-3">
                      {eps.length === 0 ? (
                        <Pill label="None" variant="muted" />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {eps.map(ep => <Pill key={ep} label={ep} />)}
                        </div>
                      )}
                    </TableCell>

                    {/* Middlewares */}
                    <TableCell className="px-4 py-3">
                      {mws.length === 0 ? (
                        <Pill label="None" variant="muted" />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {mws.map(mw => <Pill key={mw} label={mw} />)}
                        </div>
                      )}
                    </TableCell>

                    {/* TLS */}
                    <TableCell className="px-4 py-3">
                      {(() => {
                        const matched = hostname ? matchDomain(hostname, domains) : null
                        if (matched) return (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30">
                            <Lock className="h-3 w-3" />
                            Encrypted
                            <SSLIcon state={sslMap[r.id]} />
                          </span>
                        )
                        if (hostname) return (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30">
                            <Lock className="h-3 w-3" />
                            <SSLIcon state={sslMap[r.id]} />
                          </span>
                        )
                        return null
                      })()}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggle(r.id, r.enabled)}
                          disabled={isPending}
                          className={`p-1.5 rounded hover:bg-muted transition-colors ${r.enabled ? 'text-green-500' : 'text-muted-foreground'}`}
                          title={r.enabled ? 'Disable' : 'Enable'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleClone(r.id, r.name)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Clone"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditTarget(r)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.name)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1) }}>
            <SelectTrigger className="h-7 w-16 text-xs">
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
          <button onClick={() => setPage(1)} disabled={safePage === 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronsLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-2">Page {safePage} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
          <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronsRight className="h-3.5 w-3.5" /></button>
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
