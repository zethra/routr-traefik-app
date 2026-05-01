'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { DomainDialog } from './DomainDialog'
import { deleteDomain } from '@/app/_actions/domains'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'

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
        <div className="space-y-2">
          {domains.map(d => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border p-4">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm font-mono">{d.domain}</span>
                <span className="text-muted-foreground text-xs ml-2">→ wildcard cert via</span>
                <span className="ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  {d.cert_resolver}
                </span>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(d.id, d.domain)}
                disabled={isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <DomainDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
    </div>
  )
}
