'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createMiddleware, updateMiddleware } from '@/app/_actions/middlewares'
import { toast } from 'sonner'

const MIDDLEWARE_TYPES = [
  { value: 'basicAuth', label: 'Basic Auth' },
  { value: 'redirectScheme', label: 'Redirect Scheme' },
  { value: 'stripPrefix', label: 'Strip Prefix' },
  { value: 'addPrefix', label: 'Add Prefix' },
  { value: 'headers', label: 'Headers' },
  { value: 'rateLimit', label: 'Rate Limit' },
  { value: 'forwardAuth', label: 'Forward Auth' },
  { value: 'ipAllowList', label: 'IP Allow List' },
]

const DEFAULT_CONFIGS: Record<string, string> = {
  basicAuth: JSON.stringify({ users: ['user:$apr1$...'] }, null, 2),
  redirectScheme: JSON.stringify({ scheme: 'https', permanent: true }, null, 2),
  stripPrefix: JSON.stringify({ prefixes: ['/api'] }, null, 2),
  addPrefix: JSON.stringify({ prefix: '/api' }, null, 2),
  headers: JSON.stringify({ customRequestHeaders: { 'X-Custom-Header': 'value' } }, null, 2),
  rateLimit: JSON.stringify({ average: 100, burst: 50 }, null, 2),
  forwardAuth: JSON.stringify({ address: 'http://auth-service:9000/verify' }, null, 2),
  ipAllowList: JSON.stringify({ sourceRange: ['127.0.0.1/32', '192.168.0.0/24'] }, null, 2),
}

type MiddlewareData = {
  id: string
  name: string
  type: string
  config: string
  enabled: number
}

type Props = {
  open: boolean
  onClose: () => void
  middleware?: MiddlewareData
  profileId: string
}

export function MiddlewareDialog({ open, onClose, middleware, profileId }: Props) {
  const isEdit = !!middleware
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(middleware?.name ?? '')
  const [type, setType] = useState(middleware?.type ?? '')
  const [config, setConfig] = useState(
    middleware ? JSON.stringify(JSON.parse(middleware.config), null, 2) : ''
  )
  const [enabled, setEnabled] = useState(middleware ? middleware.enabled === 1 : true)
  const [configError, setConfigError] = useState('')

  function handleTypeChange(val: string | null) {
    if (!val) return
    setType(val)
    if (!isEdit) setConfig(DEFAULT_CONFIGS[val] ?? '{}')
  }

  function handleClose() {
    if (!isEdit) { setName(''); setType(''); setConfig('') }
    setConfigError('')
    onClose()
  }

  function handleSubmit() {
    if (!name.trim() || !type) {
      toast.error('Name and type are required')
      return
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(config || '{}')
    } catch {
      setConfigError('Invalid JSON')
      return
    }
    setConfigError('')
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateMiddleware(middleware.id, { name: name.trim(), type, config: parsed, enabled })
          toast.success('Middleware updated')
        } else {
          await createMiddleware(profileId, { name: name.trim(), type, config: parsed })
          toast.success('Middleware created')
        }
        handleClose()
      } catch {
        toast.error('Failed to save middleware')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Middleware' : 'Add Middleware'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="mw-name">Name</Label>
            <Input id="mw-name" value={name} onChange={e => setName(e.target.value)} placeholder="my-middleware" />
          </div>

          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {MIDDLEWARE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="mw-config">Config (JSON)</Label>
            <Textarea
              id="mw-config"
              value={config}
              onChange={e => { setConfig(e.target.value); setConfigError('') }}
              className="font-mono text-sm"
              rows={6}
              placeholder="{}"
            />
            {configError && <p className="text-destructive text-xs">{configError}</p>}
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="mw-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="mw-enabled">Enabled</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
