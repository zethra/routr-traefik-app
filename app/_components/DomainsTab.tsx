'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { DomainDialog } from './DomainDialog'
import { deleteDomain } from '@/app/_actions/domains'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type DomainRow = {
  id: string
  domain: string
  cert_resolver: string
  created_at: string
}

type Props = {
  profileId: string
  domains: DomainRow[]
}

export function DomainsTab({ profileId, domains }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>Add Domain</Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Routers whose hostname matches a domain here automatically receive a wildcard TLS certificate via the configured resolver. No per-router TLS configuration needed.
      </p>

      {domains.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No domains configured.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Domain</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[240px]">Resolver</TableHead>
                <TableHead className="px-4 py-3 w-[130px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm font-mono truncate">{d.domain}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      {d.cert_resolver}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(d.id, d.domain)}
                        disabled={isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DomainDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
    </div>
  )
}
