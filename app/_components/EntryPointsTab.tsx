'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { EntryPointDialog } from './EntryPointDialog'
import { deleteEntryPoint } from '@/app/_actions/entrypoints'
import { toast } from 'sonner'

type EntryPointRow = {
  id: string
  name: string
  port: number | null
  created_at: string
}

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
        <div className="space-y-2">
          {entryPoints.map(ep => (
            <div key={ep.id} className="flex items-center gap-3 rounded-lg border p-4">
              <span className="flex-1 font-medium text-sm font-mono">{ep.name}</span>
              {ep.port != null && (
                <span className="text-muted-foreground text-xs font-mono">:{ep.port}</span>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(ep.id, ep.name)}
                disabled={isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <EntryPointDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
    </div>
  )
}
