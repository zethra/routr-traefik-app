'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { MiddlewareDialog } from './MiddlewareDialog'
import { MiddlewareRow } from '@/lib/db'
import { deleteMiddleware, toggleMiddleware } from '@/app/_actions/middlewares'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AppTabLayout } from '../../layout/AppTabLayout'

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
    <AppTabLayout title="Middleware">
      <div className="space-y-4">
        <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>Add Middleware</Button>
      </div>

      {middlewares.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 text-sm">No middlewares yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[90px]">Enabled</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[220px]">Name</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground w-[140px]">Type</TableHead>
                <TableHead className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">Config</TableHead>
                <TableHead className="px-4 py-3 w-[150px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {middlewares.map(m => (
                <TableRow key={m.id} className={!m.enabled ? 'opacity-60' : ''}>
                  <TableCell className="px-4 py-3">
                    <Switch
                      checked={m.enabled === 1}
                      onCheckedChange={() => handleToggle(m.id, m.enabled)}
                      disabled={isPending}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{m.name}</span>
                      {!m.enabled && <Badge variant="secondary" className="text-xs">disabled</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{m.type}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <pre className="text-muted-foreground text-xs font-mono truncate max-w-sm">
                      {m.config}
                    </pre>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditTarget(m)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id, m.name)} disabled={isPending}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </AppTabLayout>
  )
}
