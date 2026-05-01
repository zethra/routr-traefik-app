'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCertResolver } from '@/app/_actions/certresolvers'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
}

export function CertResolverDialog({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')

  function handleClose() {
    setName('')
    onClose()
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      try {
        await createCertResolver(name.trim())
        toast.success('Cert resolver added')
        handleClose()
      } catch {
        toast.error('Failed to add cert resolver')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Cert Resolver</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="cr-name">Name</Label>
            <Input
              id="cr-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="letsencrypt, staging, …"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <p className="text-muted-foreground text-xs">
              Must match a <code className="font-mono">certificatesResolvers</code> entry in your Traefik static config
            </p>
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
