'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RouterDialog } from './RouterDialog'
import { deleteRouter, toggleRouter } from '@/app/_actions/routers'
import { checkSSL } from '@/app/_actions/ssl'
import type { SSLResult } from '@/app/_actions/ssl'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldAlert, ShieldX, Loader2, Lock,
  Globe, Power, Pencil, Trash2, Search, Plus, RefreshCw,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

export function RoutersTab({ profileId, routers, entryPointNames, middlewareNames, domains }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RouterRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sslMap, setSslMap] = useState<Record<string, SSLState>>({})
  const [sslChecking, setSslChecking] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const filtered = routers.filter(r => {
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      (extractHostname(r.rule) ?? '').toLowerCase().includes(q) ||
      r.service_url.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

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
        <div className="flex-1" />
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Create Router
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-[180px]">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-[100px]">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-[150px]">Entry Points</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-[150px]">Middlewares</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Rule</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide w-[180px]">TLS</th>
              <th className="px-4 py-3 w-[110px]" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  {search ? 'No routers match your search.' : 'No routers yet.'}
                </td>
              </tr>
            ) : (
              paginated.map((r, i) => {
                const eps: string[] = JSON.parse(r.entry_points)
                const mws: string[] = JSON.parse(r.middlewares)
                const hostname = extractHostname(r.rule)
                const isLast = i === paginated.length - 1
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-muted/30 transition-colors ${!isLast ? 'border-b' : ''} ${!r.enabled ? 'opacity-50' : ''}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.name}</span>
                      {r.priority != null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">p{r.priority}</span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-border bg-muted text-foreground">
                        <Globe className="h-3 w-3" />
                        {matchDomain(hostname ?? '', domains) ? 'HTTPS' : 'HTTP'}
                      </span>
                    </td>

                    {/* Entry Points */}
                    <td className="px-4 py-3">
                      {eps.length === 0 ? (
                        <Pill label="None" variant="muted" />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {eps.map(ep => <Pill key={ep} label={ep} />)}
                        </div>
                      )}
                    </td>

                    {/* Middlewares */}
                    <td className="px-4 py-3">
                      {mws.length === 0 ? (
                        <Pill label="None" variant="muted" />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {mws.map(mw => <Pill key={mw} label={mw} />)}
                        </div>
                      )}
                    </td>

                    {/* Rule */}
                    <td className="px-4 py-3">
                      <span className="text-blue-400 font-mono text-xs">
                        {hostname ?? r.rule}
                      </span>
                    </td>

                    {/* TLS */}
                    <td className="px-4 py-3">
                      {(() => {
                        const matched = hostname ? matchDomain(hostname, domains) : null
                        if (matched) return (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30">
                            <Lock className="h-3 w-3" />
                            {matched.cert_resolver}
                            <SSLIcon state={sslMap[r.id]} />
                          </span>
                        )
                        if (hostname) return (
                          <span className="inline-flex items-center gap-1">
                            <SSLIcon state={sslMap[r.id]} />
                          </span>
                        )
                        return null
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
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
                          onClick={() => setEditTarget(r)}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.name)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
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
