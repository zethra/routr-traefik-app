'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProfileDialog } from './ProfileDialog'
import { deleteProfile } from '@/app/_actions/profiles'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfileWithStats } from '@/lib/db'

type Props = {
  open: boolean
  onClose: () => void
  profiles: ProfileWithStats[]
  currentProfile: string
}

export function SettingsDialog({ open, onClose, profiles, currentProfile }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const canDelete = profiles.length > 1

  function copyEndpoint(p: ProfileWithStats) {
    navigator.clipboard.writeText(`/api/${p.name}?token=${p.token}`)
    setCopiedId(p.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleDelete(p: ProfileWithStats) {
    if (!canDelete) return
    if (!confirm(`Delete profile "${p.name}"? This will permanently remove all its routers, middlewares, entry points, and domains.`)) return
    const next = profiles.find(x => x.id !== p.id)!
    startTransition(async () => {
      try {
        await deleteProfile(p.id)
        if (p.name === currentProfile) router.push(`/?profile=${encodeURIComponent(next.name)}`)
        toast.success(`Deleted "${p.name}"`)
        onClose()
      } catch {
        toast.error('Failed to delete profile')
      }
    })
  }

  function handleSwitch(name: string) {
    router.push(`/?profile=${encodeURIComponent(name)}`)
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-1 p-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5 mb-2">Profiles</p>

            {profiles.map(p => {
              const isActive = p.name === currentProfile
              const endpoint = `/api/${p.name}?token=${p.token}`
              return (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 transition-colors overflow-hidden ${isActive ? 'bg-muted/40' : 'hover:bg-accent/40 cursor-pointer'}`}
                  onClick={!isActive ? () => handleSwitch(p.name) : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {isActive && <Badge variant="secondary" className="text-xs shrink-0">active</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={!canDelete || isPending}
                      title={canDelete ? `Delete "${p.name}"` : 'Cannot delete the last profile'}
                      onClick={e => { e.stopPropagation(); handleDelete(p) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    {p.router_count} routers · {p.middleware_count} middlewares · {p.entry_point_count} entry points · {p.domain_count} domains
                  </p>

                  <div
                    className="flex items-center gap-1.5 mt-2 bg-muted rounded px-2 py-1 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate min-w-0">
                      /api/{p.name}?token={p.token.slice(0, 8)}…
                    </code>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => copyEndpoint(p)}
                      title="Copy endpoint"
                    >
                      {copiedId === p.id
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={name => {
          setCreateOpen(false)
          router.push(`/?profile=${encodeURIComponent(name)}`)
          onClose()
        }}
      />
    </>
  )
}
