'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DomainRow } from '@/lib/db'
import { createDomain, updateDomain } from '@/app/_actions/domains'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onClose: () => void
  profileId: string
  domain?: DomainRow
}

export function DomainDialog({ open, onClose, profileId, domain: editDomain }: Props) {
  const isEdit = !!editDomain
  const [isPending, startTransition] = useTransition()
  const [domain, setDomain] = useState(editDomain?.domain ?? '')
  const [certResolver, setCertResolver] = useState(editDomain?.cert_resolver ?? '')

  function resetFields() {
    setDomain(editDomain?.domain ?? '')
    setCertResolver(editDomain?.cert_resolver ?? '')
  }

  function handleClose() {
    resetFields()
    onClose()
  }

  function handleSubmit() {
    if (!domain.trim()) { toast.error('Domain is required'); return }
    if (!certResolver.trim()) { toast.error('Cert resolver is required'); return }
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateDomain(editDomain.id, domain.trim().toLowerCase(), certResolver.trim())
          toast.success('Domain updated')
        } else {
          await createDomain(profileId, domain.trim().toLowerCase(), certResolver.trim())
          toast.success('Domain added')
        }
        handleClose()
      } catch {
        toast.error(isEdit ? 'Failed to update domain' : 'Failed to add domain')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Domain' : 'Add Domain'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="d-domain">Domain</Label>
            <Input
              id="d-domain"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="zethra.net"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <p className="text-muted-foreground text-xs">
              Routers matching <code className="font-mono">*.{domain || 'yourdomain.com'}</code> will get a wildcard cert automatically
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-resolver">Cert Resolver</Label>
            <Input
              id="d-resolver"
              value={certResolver}
              onChange={e => setCertResolver(e.target.value)}
              placeholder="letsencrypt"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <p className="text-muted-foreground text-xs">
              Must match a <code className="font-mono">certificatesResolvers</code> key in your Traefik static config
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save' : 'Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
