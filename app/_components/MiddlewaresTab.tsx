'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { MiddlewareDialog } from './MiddlewareDialog'
import { deleteMiddleware, toggleMiddleware } from '@/app/_actions/middlewares'
import { toast } from 'sonner'

type MiddlewareRow = {
  id: string
  name: string
  type: string
  config: string
  enabled: number
}

type Props = {
  profileId: string
  middlewares: MiddlewareRow[]
}

export function MiddlewaresTab({ profileId, middlewares }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MiddlewareRow | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete middleware "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteMiddleware(id)
        toast.success('Middleware deleted')
      } catch {
        toast.error('Failed to delete middleware')
      }
    })
  }

  function handleToggle(id: string, current: number) {
    startTransition(async () => {
      await toggleMiddleware(id, current === 0)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>Add Middleware</Button>
      </div>

      {middlewares.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No middlewares yet.</p>
      ) : (
        <div className="space-y-2">
          {middlewares.map(m => (
            <div key={m.id} className="flex items-start gap-3 rounded-lg border p-4">
              <Switch
                checked={m.enabled === 1}
                onCheckedChange={() => handleToggle(m.id, m.enabled)}
                disabled={isPending}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{m.name}</span>
                  <Badge variant="outline" className="text-xs">{m.type}</Badge>
                  {!m.enabled && <Badge variant="secondary" className="text-xs">disabled</Badge>}
                </div>
                <pre className="text-muted-foreground text-xs mt-1 font-mono truncate max-w-sm">
                  {m.config}
                </pre>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditTarget(m)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id, m.name)} disabled={isPending}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MiddlewareDialog open={addOpen} onClose={() => setAddOpen(false)} profileId={profileId} />
      {editTarget && (
        <MiddlewareDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          middleware={editTarget}
          profileId={profileId}
        />
      )}
    </div>
  )
}
