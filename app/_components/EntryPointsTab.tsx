'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { EntryPointDialog } from './EntryPointDialog'
import { EntryPointRow } from '@/lib/db'
import { deleteEntryPoint } from '@/app/_actions/entrypoints'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Props = {
  profileId: string
  entryPoints: EntryPointRow[]
}

export function EntryPointsTab({ profileId, entryPoints }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove entry point "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteEntryPoint(id)
        toast.success('Entry point removed')
      } catch {
        toast.error('Failed to remove entry point')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>Add Entry Point</Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Entry point names defined here are used to populate the selector when creating routers.
        They must match entry points in your Traefik static configuration.
      </p>

      {entryPoints.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No entry points defined.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Name</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[140px]">Port</TableHead>
                <TableHead className="px-4 py-3 w-[130px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entryPoints.map(ep => (
                <TableRow key={ep.id}>
                  <TableCell className="px-4 py-3 font-medium text-sm font-mono">{ep.name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-xs font-mono">
                    {ep.port != null ? `:${ep.port}` : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(ep.id, ep.name)}
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

      <EntryPointDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
    </div>
  )
}
