'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProfile } from '@/app/_actions/profiles'
import { CopyButton } from './CopyButton'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (name: string) => void
}

export function ProfileDialog({ open, onClose, onCreated }: Props) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)

  function handleClose() {
    setName('')
    setCreatedToken(null)
    setCreatedName(null)
    onClose()
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error('Name is required'); return }
    startTransition(async () => {
      try {
        const profile = await createProfile(name.trim())
        setCreatedToken(profile.token)
        setCreatedName(profile.name)
        onCreated?.(profile.name)
      } catch {
        toast.error('Failed to create profile')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Profile</DialogTitle>
        </DialogHeader>

        {createdToken ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Profile <span className="font-medium text-foreground">{createdName}</span> created. Save this token — it won't be shown again.
            </p>
            <div className="space-y-1">
              <Label>API Token</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                  {createdToken}
                </code>
                <CopyButton text={createdToken} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Traefik endpoint: <code className="font-mono">/api/{createdName}?token={createdToken}</code>
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="prof-name">Name</Label>
              <Input
                id="prof-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="home, staging, …"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {createdToken ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Creating…' : 'Create'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
