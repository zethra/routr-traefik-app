'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ServiceRow, RouterRow, DomainRow } from '@/lib/db'
import { extractHostnames } from '@/lib/utils'
import { parseEndpoints, parseRuleIntoDomain, ParsedEndpoint, ParsedDomainRule } from '@/lib/serviceUtils'
import { createService, updateService } from '@/app/_actions/services'
import { createRouter, updateRouter, deleteRouter } from '@/app/_actions/routers'
import { toast } from 'sonner'
import { X, Route } from 'lucide-react'
import { ServiceDetails } from './ServiceDetails'

type Props = {
  open: boolean
  onClose: () => void
  profileId: string
  service?: ServiceRow
  routers: RouterRow[]
  availableEntryPoints: string[]
  availableMiddlewares: string[]
  availableDomains: DomainRow[]
}

export function ServiceDialog({
  open,
  onClose,
  profileId,
  service: editService,
  routers,
  availableEntryPoints,
  availableMiddlewares,
  availableDomains,
}: Props) {
  const isEdit = !!editService
  const [isPending, startTransition] = useTransition()
  const [routeToEdit, setRouteToEdit] = useState<RouterRow | null>(null)
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null)
  const [deleteRouteName, setDeleteRouteName] = useState<string>('')

  // Service form state
  const [name, setName] = useState(editService?.name ?? '')
  const [tags, setTags] = useState<string[]>(() => {
    const tag = editService?.tag
    return tag ? tag.split(',').map(t => t.trim()).filter(Boolean) : []
  })
  const [logo, setLogo] = useState(editService?.logo ?? '')
  const [logoPreview, setLogoPreview] = useState(editService?.logo ?? '')
  const [endpoints, setEndpoints] = useState<ParsedEndpoint[]>(() =>
    editService ? parseEndpoints(editService.endpoints) : []
  )

  // Route form state
  const hasDomains = availableDomains.length > 0
  const initialParsed = routeToEdit && hasDomains ? parseRuleIntoDomain(routeToEdit.rule, availableDomains, extractHostnames) : null
  const [routeMode, setRouteMode] = useState<'domain' | 'custom'>(
    initialParsed ? 'domain' : hasDomains ? 'domain' : 'custom'
  )
  const [subdomain, setSubdomain] = useState(initialParsed?.subdomain ?? '')
  const [aliases, setAliases] = useState<string[]>(initialParsed?.aliases ?? [])
  const [selectedDomain, setSelectedDomain] = useState(initialParsed?.domain ?? availableDomains[0]?.domain ?? '')
  const [customRule, setCustomRule] = useState(routeToEdit?.rule ?? '')
  const [selectedEPs, setSelectedEPs] = useState<string[]>(
    routeToEdit ? JSON.parse(routeToEdit.entry_points) : availableEntryPoints.includes('websecure') ? ['websecure'] : []
  )
  const [selectedMWs, setSelectedMWs] = useState<string[]>(
    routeToEdit ? JSON.parse(routeToEdit.middlewares) : []
  )
  const [routeEnabled, setRouteEnabled] = useState(routeToEdit ? routeToEdit.enabled === 1 : true)

  const matchingRouters = editService ? routers.filter(r => r.service_id === editService.id) : []

  const computedHostname = selectedDomain
    ? subdomain.trim() ? `${subdomain.trim()}.${selectedDomain}` : selectedDomain
    : ''
  const computedAliasHostnames = selectedDomain
    ? aliases.map(alias => alias.trim()).filter(Boolean).map(alias => `${alias}.${selectedDomain}`)
    : []
  const computedHostnames = Array.from(new Set([computedHostname, ...computedAliasHostnames].filter(Boolean)))
  const computedRule = computedHostnames.length > 0
    ? `Host(${computedHostnames.map(hostname => `\`${hostname}\``).join(', ')})`
    : ''
  const activeRule = routeMode === 'domain' ? computedRule : customRule

  function handleClose() {
    setName(editService?.name ?? '')
    setTags(editService?.tag ? editService.tag.split(',').map(t => t.trim()).filter(Boolean) : [])
    setLogo(editService?.logo ?? '')
    setLogoPreview(editService?.logo ?? '')
    setEndpoints(editService ? parseEndpoints(editService.endpoints) : [])
    setRouteToEdit(null)
    setShowRouteForm(false)
    onClose()
  }

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  function handleServiceSubmit() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (endpoints.length === 0) {
      toast.error('At least one endpoint is required')
      return
    }

    const endpointsArray = endpoints.map(ep => ep.url)

    startTransition(async () => {
      try {
        const tagsString = tags.length > 0 ? tags.join(', ') : null
        if (isEdit) {
          await updateService(editService.id, name.trim(), endpointsArray, logo.trim() || null, tagsString)
          toast.success('Service updated')
        } else {
          await createService(profileId, name.trim(), endpointsArray, logo.trim() || null, tagsString)
          toast.success('Service created')
          handleClose()
        }
      } catch {
        toast.error(isEdit ? 'Failed to update service' : 'Failed to create service')
      }
    })
  }

  function handleRouteSubmit() {
    if (!activeRule.trim() || !editService) {
      toast.error('Hostname is required')
      return
    }
    if (routeMode === 'domain' && !selectedDomain) {
      toast.error('Select a domain')
      return
    }

    startTransition(async () => {
      try {
        const routeName = routeMode === 'domain' ? computedHostname : customRule.trim()
        const data = {
          name: routeName,
          rule: activeRule.trim(),
          service_id: editService.id,
          entry_points: selectedEPs,
          middlewares: selectedMWs,
          enabled: routeEnabled,
        }
        if (routeToEdit) {
          await updateRouter(routeToEdit.id, data)
          toast.success('Route updated')
        } else {
          await createRouter(profileId, data)
          toast.success('Route created')
        }
        setRouteToEdit(null)
        setShowRouteForm(false)
      } catch {
        toast.error('Failed to save route')
      }
    })
  }

  function handleDeleteRoute(id: string) {
    const route = matchingRouters.find(r => r.id === id)
    if (!route) return
    setDeleteRouteId(id)
    setDeleteRouteName(route.name)
  }

  function confirmDeleteRoute() {
    if (!deleteRouteId) return
    startTransition(async () => {
      try {
        await deleteRouter(deleteRouteId)
        toast.success('Route removed')
        setDeleteRouteId(null)
      } catch {
        toast.error('Failed to remove route')
      }
    })
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={o => !o && handleClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit Service - ${editService.name}` : 'Create Service'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
          {/* Service Details - Logo, Name, Tags, Endpoints, Routes */}
          <ServiceDetails
            service={{
              id: editService?.id || '',
              profile_id: profileId,
              name,
              logo,
              tag: tags.length > 0 ? tags.join(', ') : null,
              endpoints: JSON.stringify(endpoints),
              created_at: editService?.created_at || new Date().toISOString(),
              updated_at: editService?.updated_at || new Date().toISOString(),
              enabled: editService?.enabled ?? 1,
            }}
            routers={isEdit ? matchingRouters : []}
            editable={true}
            onLogoChange={(base64) => {
              setLogo(base64)
              setLogoPreview(base64)
            }}
            onLogoRemove={() => {
              setLogo('')
              setLogoPreview('')
            }}
            onNameChange={setName}
            onTagsChange={setTags}
            onEndpointsChange={setEndpoints}
            onRouteEdit={(route) => {
              setRouteToEdit(route)
              setShowRouteForm(true)
            }}
            onRouteDelete={handleDeleteRoute}
          />

          {/* Route Form - only for editing */}
          {isEdit && (
            <>
              <div className="border-t my-3" />

                {/* Route Form */}
                {(showRouteForm || routeToEdit) && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold">{routeToEdit ? `Edit: ${routeToEdit.name}` : '✨ Create New Route'}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Configure how this route is accessed</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRouteToEdit(null)
                            setShowRouteForm(false)
                          }}
                          className="p-1 hover:bg-muted rounded transition-colors"
                          aria-label="Close route form"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>

                      <div className="border-t border-border/40 pt-3" />

                      {/* Hostname */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Hostname</Label>
                          {hasDomains && (
                            <button
                              type="button"
                              onClick={() => setRouteMode(routeMode === 'domain' ? 'custom' : 'domain')}
                              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              {routeMode === 'domain' ? '→ Custom' : '→ Domain'}
                            </button>
                          )}
                        </div>

                        {routeMode === 'domain' ? (
                          <div className="space-y-2">
                            <div className="flex gap-2 items-end">
                              <Input
                                value={subdomain}
                                onChange={e => setSubdomain(e.target.value)}
                                placeholder="subdomain"
                                className="h-8 text-xs flex-1"
                              />
                              <span className="text-sm font-semibold text-muted-foreground">.&nbsp;</span>
                              <Select value={selectedDomain} onValueChange={(v) => v && setSelectedDomain(v)}>
                                <SelectTrigger className="h-8 text-xs flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableDomains.map(d => (
                                    <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {computedHostname && (
                              <div className="px-2 py-1.5 rounded bg-primary/10 border border-primary/20 flex items-center gap-2">
                                <Route className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                <p className="text-xs font-mono text-primary">{computedHostname}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Input
                            value={customRule}
                            onChange={e => setCustomRule(e.target.value)}
                            placeholder="Host(`example.com`)"
                            className="h-8 text-xs font-mono"
                          />
                        )}
                      </div>

                      <div className="border-t border-border/40" />

                      {/* Ingress & Middleware */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Entry Points</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {availableEntryPoints.map(ep => (
                              <button
                                key={ep}
                                type="button"
                                onClick={() => toggleItem(selectedEPs, setSelectedEPs, ep)}
                                title="Entry point"
                                className={`px-2 h-7 rounded border transition-colors text-xs font-medium ${
                                  selectedEPs.includes(ep)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border bg-muted/30 hover:bg-muted/50'
                                }`}
                              >
                                {ep}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="font-medium block">Middleware</span>
                          <div className="flex flex-wrap gap-1">
                            {availableMiddlewares.map(mw => (
                              <button
                                key={mw}
                                type="button"
                                onClick={() => toggleItem(selectedMWs, setSelectedMWs, mw)}
                                title="Middleware"
                                className={`px-2 h-7 rounded border transition-colors text-xs font-medium ${
                                  selectedMWs.includes(mw)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border bg-muted/30 hover:bg-muted/50'
                                }`}
                              >
                                {mw}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Enabled */}
                      <div className="flex items-center gap-2">
                        <Switch id="enabled" checked={routeEnabled} onCheckedChange={setRouteEnabled} size="sm" />
                        <Label htmlFor="enabled" className="text-xs cursor-pointer">Enabled</Label>
                      </div>
                    </CardContent>
                  </Card>
                )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {routeToEdit || showRouteForm ? (
            <Button onClick={handleRouteSubmit} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <Button onClick={handleServiceSubmit} disabled={isPending}>
              {isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

        {/* Delete Route Confirmation */}
        {deleteRouteId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <Card className="w-96">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="font-semibold">Remove route?</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Remove route <span className="font-mono font-semibold">"{deleteRouteName}"</span>? This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDeleteRouteId(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={confirmDeleteRoute} disabled={isPending}>
                    {isPending ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Dialog>
    </TooltipProvider>
  )
}
