'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createService, updateService } from '@/app/_actions/services'
import { toast } from 'sonner'
import { X, Upload } from 'lucide-react'

type ServiceRow = {
  id: string
  name: string
  endpoints: string
  logo: string | null
  tag: string | null
  profile_id: string
  enabled: number
  created_at: string
  updated_at: string
}

type Props = {
  open: boolean
  onClose: () => void
  profileId: string
  service?: ServiceRow
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ServiceDialog({ open, onClose, profileId, service: editService }: Props) {
  const isEdit = !!editService
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(editService?.name ?? '')
  const [tag, setTag] = useState(editService?.tag ?? '')
  const [logo, setLogo] = useState(editService?.logo ?? '')
  const [logoPreview, setLogoPreview] = useState(editService?.logo ?? '')
  const [endpoints, setEndpoints] = useState<string[]>(() => {
    if (!editService) return []
    try {
      const parsed = JSON.parse(editService.endpoints)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [newEndpoint, setNewEndpoint] = useState('')

  function resetFields() {
    setName(editService?.name ?? '')
    setTag(editService?.tag ?? '')
    setLogo(editService?.logo ?? '')
    setLogoPreview(editService?.logo ?? '')
    setNewEndpoint('')
    if (editService) {
      try {
        const parsed = JSON.parse(editService.endpoints)
        setEndpoints(Array.isArray(parsed) ? parsed : [])
      } catch {
        setEndpoints([])
      }
    } else {
      setEndpoints([])
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    if (file.size > 500 * 1024) {
      toast.error('Image must be less than 500KB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image')
      return
    }

    try {
      const base64 = await fileToBase64(file)
      setLogo(base64)
      setLogoPreview(base64)
    } catch {
      toast.error('Failed to upload image')
    }
  }

  function removeLogo() {
    setLogo('')
    setLogoPreview('')
  }

  function handleClose() {
    resetFields()
    onClose()
  }

  function addEndpoint() {
    const trimmed = newEndpoint.trim()
    if (!trimmed) {
      toast.error('Endpoint URL cannot be empty')
      return
    }
    if (endpoints.includes(trimmed)) {
      toast.error('Endpoint already added')
      return
    }
    setEndpoints([...endpoints, trimmed])
    setNewEndpoint('')
  }

  function removeEndpoint(index: number) {
    setEndpoints(endpoints.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (endpoints.length === 0) { toast.error('At least one endpoint is required'); return }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateService(editService.id, name.trim(), endpoints, logo.trim() || null, tag.trim() || null)
          toast.success('Service updated')
        } else {
          await createService(profileId, name.trim(), endpoints, logo.trim() || null, tag.trim() || null)
          toast.success('Service added')
        }
        handleClose()
      } catch {
        toast.error(isEdit ? 'Failed to update service' : 'Failed to add service')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Service' : 'Add Service'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Plex Media Server"
              onKeyDown={e => e.key === 'Enter' && addEndpoint()}
            />
            <p className="text-muted-foreground text-xs">
              A name for this service (e.g., application name)
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="s-tag">Tag</Label>
            <Input
              id="s-tag"
              list="service-tag-suggestions"
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="e.g. Media, Infrastructure…"
            />
            <datalist id="service-tag-suggestions">
              <option value="Media" />
              <option value="Infrastructure" />
              <option value="Networking" />
              <option value="Monitoring" />
              <option value="Security" />
              <option value="Storage" />
              <option value="Databases" />
            </datalist>
            <p className="text-muted-foreground text-xs">
              Tag for organizing and filtering (optional)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-logo">Logo</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label
                  htmlFor="s-logo"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 hover:bg-muted/60 cursor-pointer text-sm font-medium transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {logoPreview ? 'Change Image' : 'Upload Image'}
                </label>
                <input
                  id="s-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
              {logoPreview && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="inline-flex items-center gap-1 px-2 py-2 rounded-md hover:bg-destructive/10 text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-16 w-16 rounded object-contain bg-muted"
              />
            )}
            <p className="text-muted-foreground text-xs">
              Upload a logo image (max 500KB)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Endpoints</Label>
            <div className="space-y-2">
              {endpoints.length > 0 && (
                <div className="rounded border border-border/50 bg-background/50 p-3 space-y-1.5">
                  {endpoints.map((endpoint, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                      <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
                        {endpoint}
                      </code>
                      <button
                        type="button"
                        onClick={() => removeEndpoint(idx)}
                        className="inline-flex p-0.5 hover:bg-destructive/10 text-destructive rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newEndpoint}
                  onChange={e => setNewEndpoint(e.target.value)}
                  placeholder="http://10.10.100.101:32400"
                  onKeyDown={e => e.key === 'Enter' && addEndpoint()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addEndpoint}
                  disabled={!newEndpoint.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              URLs for backend servers (load balanced in order)
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
