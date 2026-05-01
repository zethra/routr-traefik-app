'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CertResolverDialog } from './CertResolverDialog'
import { deleteCertResolver } from '@/app/_actions/certresolvers'
import { toast } from 'sonner'

type CertResolverRow = {
  id: string
  name: string
  created_at: string
}

type Props = {
  certResolvers: CertResolverRow[]
}

export function TLSTab({ certResolvers }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove cert resolver "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteCertResolver(id)
        toast.success('Cert resolver removed')
      } catch {
        toast.error('Failed to remove cert resolver')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>Add Cert Resolver</Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Define resolver names here to reference them in routers. Each name must match a{' '}
        <code className="font-mono">certificatesResolvers</code> key in your Traefik static config.
      </p>

      {certResolvers.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No cert resolvers defined.</p>
      ) : (
        <div className="space-y-2">
          {certResolvers.map(cr => (
            <div key={cr.id} className="flex items-center gap-3 rounded-lg border p-4">
              <span className="flex-1 font-medium text-sm font-mono">{cr.name}</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(cr.id, cr.name)}
                disabled={isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <CertResolverDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
