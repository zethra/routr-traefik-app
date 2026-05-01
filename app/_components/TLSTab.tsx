'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CertResolverDialog } from './CertResolverDialog'
import { deleteCertResolver } from '@/app/_actions/certresolvers'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Resolver Name</TableHead>
                <TableHead className="px-4 py-3 w-[130px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {certResolvers.map(cr => (
                <TableRow key={cr.id}>
                  <TableCell className="px-4 py-3 font-medium text-sm font-mono">{cr.name}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(cr.id, cr.name)}
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

      <CertResolverDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
