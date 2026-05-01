'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createEntryPoint } from '@/app/_actions/entrypoints'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
  profileId: string
}

export function EntryPointDialog({ open, onClose, profileId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [port, setPort] = useState('')

  function handleClose() {
    setName('')
    setPort('')
    onClose()
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    const portNum = port.trim() ? parseInt(port.trim(), 10) : null
    if (port.trim() && (isNaN(portNum!) || portNum! < 1 || portNum! > 65535)) {
      toast.error('Port must be between 1 and 65535')
      return
    }
    startTransition(async () => {
      try {
        await createEntryPoint(profileId, name.trim(), portNum)
        toast.success('Entry point added')
        handleClose()
      } catch {
        toast.error('Failed to add entry point')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Entry Point</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="ep-name">Name</Label>
            <Input
              id="ep-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="web, websecure, …"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <p className="text-muted-foreground text-xs">
              Must match an entry point defined in your Traefik static config
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-port">Port (optional)</Label>
            <Input
              id="ep-port"
              type="number"
              value={port}
              onChange={e => setPort(e.target.value)}
              placeholder="80, 443, …"
              min={1}
              max={65535}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Adding…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
