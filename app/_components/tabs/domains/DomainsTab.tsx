'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DomainDialog } from './DomainDialog'
import { DomainRow, RouterRow } from '@/lib/db'
import { formatCreated, extractHostnames } from '@/lib/utils'
import { deleteDomain } from '@/app/_actions/domains'
import { toast } from 'sonner'
import { Calendar, Lock, MoreHorizontal, Network, Pencil, Plus, Route, Search, Trash2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AppTabLayout } from '../../layout/AppTabLayout'

type Props = {
  profileId: string
  domains: DomainRow[]
  routers: RouterRow[]
}

export function DomainsTab({ profileId, domains, routers }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DomainRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const domainStats = domains.map(domainRow => {
    const matchedHosts = routers
      .flatMap(router => extractHostnames(router.rule))
      .filter(host => host === domainRow.domain || host.endsWith(`.${domainRow.domain}`))

    const uniqueHosts = Array.from(new Set(matchedHosts))
    const matchedRoutes = routers.filter(router => {
      const hosts = extractHostnames(router.rule)
      return hosts.some(host => host === domainRow.domain || host.endsWith(`.${domainRow.domain}`))
    })

    const activeRoutes = matchedRoutes.filter(router => router.enabled === 1).length

    return {
      domain: domainRow,
      matchedRoutes: matchedRoutes.length,
      activeRoutes,
      hostPreview: uniqueHosts.slice(0, 2),
      extraHosts: Math.max(0, uniqueHosts.length - 2),
    }
  })

  const filteredDomainStats = domainStats.filter(({ domain: d, hostPreview }) => {
    const q = search.trim().toLowerCase()
    if (!q) return true

    return (
      d.domain.toLowerCase().includes(q) ||
      d.cert_resolver.toLowerCase().includes(q) ||
      hostPreview.some(host => host.toLowerCase().includes(q))
    )
  })

  const sortedDomainStats = [...filteredDomainStats].sort((a, b) => {
    if (b.matchedRoutes !== a.matchedRoutes) return b.matchedRoutes - a.matchedRoutes
    if (b.activeRoutes !== a.activeRoutes) return b.activeRoutes - a.activeRoutes
    return a.domain.domain.localeCompare(b.domain.domain)
  })

  function handleDelete(id: string, domain: string) {
    if (!confirm(`Remove domain "${domain}"?`)) return
    startTransition(async () => {
      try {
        await deleteDomain(id)
        toast.success('Domain removed')
      } catch {
        toast.error('Failed to remove domain')
      }
    })
  }

  return (
    <AppTabLayout title="Domains">
      <div className="space-y-4">
        <div className="relative">
          <div className="relative flex-1 max-w-none pr-24">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9 text-sm w-full"
              placeholder="Search domains..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" className="h-9 gap-1.5 absolute right-0 top-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create Domain</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

      <p className="text-muted-foreground text-xs">
        Routers whose hostname matches a domain here automatically receive a wildcard TLS certificate via the configured resolver. No per-router TLS configuration needed.
      </p>

      {domains.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No domains configured.</p>
      ) : filteredDomainStats.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No domains match your search.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Domain</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[180px]">Wildcard</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[240px]">Coverage</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[180px]">Resolver</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[130px]">Added</TableHead>
                <TableHead className="px-4 py-3 w-[120px]"/>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDomainStats.map(({ domain: d, matchedRoutes, activeRoutes, hostPreview, extraHosts }) => (
                <TableRow key={d.id}>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm font-mono truncate">{d.domain}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border border-border bg-muted text-muted-foreground font-mono">
                      <Network className="h-3 w-3" />
                      *.{d.domain}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Route className="h-3 w-3" />
                        <span>{activeRoutes}/{matchedRoutes} active routes</span>
                      </div>
                      {hostPreview.length > 0 ? (
                        <p className="text-xs font-mono text-muted-foreground truncate" title={[...hostPreview, extraHosts > 0 ? `+${extraHosts} more` : ''].filter(Boolean).join(', ')}>
                          {hostPreview.join(', ')}{extraHosts > 0 ? ` +${extraHosts}` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No matching host rules yet</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      {d.cert_resolver}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatCreated(d.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          aria-label={`Open actions for ${d.domain}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setEditTarget(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(d.id, d.domain)}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DomainDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
      {editTarget && (
        <DomainDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          profileId={profileId}
          domain={editTarget}
        />
      )}
      </div>
    </AppTabLayout>
  )
}
