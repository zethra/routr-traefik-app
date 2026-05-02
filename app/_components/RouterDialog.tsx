'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createRouter, updateRouter } from '@/app/_actions/routers'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

type RouterData = {
  id: string
  name: string
  rule: string
  service_url: string
  entry_points: string
  middlewares: string
  priority: number | null
  enabled: number
}

type Domain = { id: string; domain: string }
type ServiceEndpoint = { url: string; weight: number }

type ParsedDomainRule = {
  subdomain: string
  domain: string
  aliases: string[]
}

type Props = {
  open: boolean
  onClose: () => void
  router?: RouterData
  profileId: string
  availableEntryPoints: string[]
  availableMiddlewares: string[]
  availableDomains: Domain[]
}

function parseHostnamesFromRule(rule: string): string[] {
  const match = rule.match(/Host\((.*)\)/)
  if (!match) return []
  return Array.from(match[1].matchAll(/`([^`]+)`/g), m => m[1].trim()).filter(Boolean)
}

function toSubdomain(hostname: string, domain: string): string | null {
  if (hostname === domain) return ''
  if (hostname.endsWith(`.${domain}`)) return hostname.slice(0, -(domain.length + 1))
  return null
}

function parseRuleIntoDomain(rule: string, domains: Domain[]): ParsedDomainRule | null {
  const hostnames = parseHostnamesFromRule(rule)
  const primaryHostname = hostnames[0]
  if (!primaryHostname) return null

  for (const d of domains) {
    const primarySubdomain = toSubdomain(primaryHostname, d.domain)
    if (primarySubdomain === null) continue

    const aliases = hostnames
      .slice(1)
      .map(hostname => toSubdomain(hostname, d.domain))
      .filter((subdomain): subdomain is string => subdomain !== null && subdomain.length > 0)

    return { subdomain: primarySubdomain, domain: d.domain, aliases }
  }

  return null
}

function normalizeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1
}

function parseServiceEndpoints(value: string): ServiceEndpoint[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item): ServiceEndpoint[] => {
        if (typeof item === 'string') {
          const url = item.trim()
          return url ? [{ url, weight: 1 }] : []
        }
        if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
          const url = item.url.trim()
          if (!url) return []

          const rawWeight = 'weight' in item ? Number(item.weight) : 1
          return [{ url, weight: normalizeWeight(rawWeight) }]
        }
        return []
      })
    }
  } catch {
    // Keep backward compatibility with older single-url values.
  }

  return [{ url: trimmed, weight: 1 }]
}

function serializeServiceEndpoints(endpoints: ServiceEndpoint[]): string {
  const clean = endpoints
    .map(endpoint => ({
      url: endpoint.url.trim(),
      weight: normalizeWeight(endpoint.weight),
    }))
    .filter(endpoint => endpoint.url)

  if (clean.length === 0) return ''
  return JSON.stringify(clean)
}

export function RouterDialog({ open, onClose, router, profileId, availableEntryPoints, availableMiddlewares, availableDomains }: Props) {
  const isEdit = !!router
  const [isPending, startTransition] = useTransition()

  const hasDomains = availableDomains.length > 0

  const initialParsed = router && hasDomains ? parseRuleIntoDomain(router.rule, availableDomains) : null

  const [mode, setMode] = useState<'domain' | 'custom'>(
    initialParsed ? 'domain' : hasDomains ? 'domain' : 'custom'
  )
  const [subdomain, setSubdomain] = useState(initialParsed?.subdomain ?? '')
  const [aliases, setAliases] = useState<string[]>(initialParsed?.aliases ?? [])
  const [selectedDomain, setSelectedDomain] = useState(() => {
    if (initialParsed?.domain) return initialParsed.domain
    if (!isEdit && typeof window !== 'undefined' && availableDomains.length > 0) {
      const stored = localStorage.getItem('routr:lastDomain')
      if (stored && availableDomains.some(d => d.domain === stored)) return stored
    }
    return availableDomains[0]?.domain ?? ''
  })
  const [customRule, setCustomRule] = useState(router?.rule ?? '')

  const [name, setName] = useState(router?.name ?? '')
  const [serviceEndpoints, setServiceEndpoints] = useState<ServiceEndpoint[]>(() => {
    const initial = parseServiceEndpoints(router?.service_url ?? '')
    return initial.length > 0 ? initial : [{ url: '', weight: 1 }]
  })
  const [selectedEPs, setSelectedEPs] = useState<string[]>(
    router ? JSON.parse(router.entry_points) : []
  )
  const [selectedMWs, setSelectedMWs] = useState<string[]>(
    router ? JSON.parse(router.middlewares) : []
  )
  const [enabled, setEnabled] = useState(router ? router.enabled === 1 : true)

  const computedHostname = selectedDomain
    ? subdomain.trim() ? `${subdomain.trim()}.${selectedDomain}` : selectedDomain
    : ''
  const computedAliasHostnames = selectedDomain
    ? aliases
      .map(alias => alias.trim())
      .filter(Boolean)
      .map(alias => `${alias}.${selectedDomain}`)
    : []
  const computedHostnames = Array.from(new Set([computedHostname, ...computedAliasHostnames].filter(Boolean)))
  const computedRule = computedHostnames.length > 0
    ? `Host(${computedHostnames.map(hostname => `\`${hostname}\``).join(', ')})`
    : ''

  const activeRule = mode === 'domain' ? computedRule : customRule

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  function selectDomain(domain: string) {
    setSelectedDomain(domain)
    localStorage.setItem('routr:lastDomain', domain)
  }

  function handleModeSwitch(next: 'domain' | 'custom') {
    if (next === 'custom' && mode === 'domain') setCustomRule(computedRule)
    if (next === 'domain' && mode === 'custom') {
      const parsed = parseRuleIntoDomain(customRule, availableDomains)
      if (parsed) {
        setSubdomain(parsed.subdomain)
        setAliases(parsed.aliases)
        selectDomain(parsed.domain)
      }
    }
    setMode(next)
  }

  function handleClose() {
    if (!isEdit) {
      setName(''); setServiceEndpoints([{ url: '', weight: 1 }])
      setSubdomain('')
      setAliases([])
      const stored = localStorage.getItem('routr:lastDomain')
      setSelectedDomain((stored && availableDomains.some(d => d.domain === stored)) ? stored : (availableDomains[0]?.domain ?? ''))
      setCustomRule('')
      setSelectedEPs([]); setSelectedMWs([])
      setEnabled(true)
      setMode(hasDomains ? 'domain' : 'custom')
    }
    onClose()
  }

  function updateServiceEndpointUrl(index: number, value: string) {
    setServiceEndpoints(prev => prev.map((item, i) => (i === index ? { ...item, url: value } : item)))
  }

  function updateServiceEndpointWeight(index: number, value: string) {
    const parsed = Number.parseInt(value, 10)
    setServiceEndpoints(prev => prev.map((item, i) => (i === index ? { ...item, weight: normalizeWeight(parsed) } : item)))
  }

  function addServiceEndpoint() {
    setServiceEndpoints(prev => [...prev, { url: '', weight: 1 }])
  }

  function removeServiceEndpoint(index: number) {
    setServiceEndpoints(prev => {
      if (prev.length === 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  function moveServiceEndpoint(index: number, direction: -1 | 1) {
    setServiceEndpoints(prev => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev

      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function updateAlias(index: number, value: string) {
    setAliases(prev => prev.map((item, i) => (i === index ? value : item)))
  }

  function addAlias() {
    setAliases(prev => [...prev, ''])
  }

  function removeAlias(index: number) {
    setAliases(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    const serializedServices = serializeServiceEndpoints(serviceEndpoints)

    if (!name.trim() || !activeRule.trim() || !serializedServices) {
      toast.error('Name, hostname and at least one endpoint URL are required')
      return
    }
    if (mode === 'domain' && !selectedDomain) {
      toast.error('Select a domain')
      return
    }
    startTransition(async () => {
      try {
        const data = {
          name: name.trim(),
          rule: activeRule.trim(),
          service_url: serializedServices,
          entry_points: selectedEPs,
          middlewares: selectedMWs,
          enabled,
        }
        if (isEdit) {
          await updateRouter(router.id, data)
          toast.success('Router updated')
        } else {
          await createRouter(profileId, data)
          toast.success('Router created')
        }
        handleClose()
      } catch {
        toast.error('Failed to save router')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Router' : 'Add Router'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="r-name">Name</Label>
            <Input id="r-name" value={name} onChange={e => setName(e.target.value)} placeholder="Plex" />
          </div>

          {/* Hostname */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Hostname</Label>
              {hasDomains && (
                <button
                  type="button"
                  onClick={() => handleModeSwitch(mode === 'domain' ? 'custom' : 'domain')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mode === 'domain' ? 'Custom rule' : 'Use domain'}
                </button>
              )}
            </div>

            {mode === 'domain' ? (
              <div className="space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                  <Input
                    value={subdomain}
                    onChange={e => setSubdomain(e.target.value)}
                    placeholder="plex"
                    className="flex-1"
                  />
                  <span className="hidden sm:inline text-muted-foreground text-sm shrink-0">.</span>
                  <Select value={selectedDomain} onValueChange={v => { if (v) selectDomain(v) }}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select domain…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDomains.map(d => (
                        <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {computedHostname && (
                  <p className="text-muted-foreground text-xs font-mono">
                    → Host(`{computedHostname}`)
                  </p>
                )}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Aliases</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addAlias} className="h-7 px-2 text-xs">
                      + Add alias
                    </Button>
                  </div>
                  {aliases.length > 0 ? (
                    <div className="space-y-1.5">
                      {aliases.map((alias, index) => (
                        <div key={`alias-${index}`} className="flex items-center gap-2">
                          <Input
                            value={alias}
                            onChange={e => updateAlias(index, e.target.value)}
                            placeholder="grafana"
                            className="flex-1"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">.{selectedDomain}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAlias(index)}
                            className="h-8 w-8 text-red-400 hover:text-destructive"
                            aria-label={`Remove alias ${index + 1}`}
                            title={`Remove alias ${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No aliases configured.</p>
                  )}
                </div>
              </div>
            ) : (
              <Input
                value={customRule}
                onChange={e => setCustomRule(e.target.value)}
                placeholder="Host(`example.com`)"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Endpoints</Label>
              <Button type="button" variant="outline" size="sm" onClick={addServiceEndpoint} className="h-7 px-2 text-xs">
                + Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {serviceEndpoints.map((endpoint, index) => (
                <div key={`svc-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_4.75rem_auto] items-center gap-2">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveServiceEndpoint(index, -1)}
                      disabled={index === 0}
                      className="h-4 w-6"
                      aria-label={`Move endpoint ${index + 1} up`}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveServiceEndpoint(index, 1)}
                      disabled={index === serviceEndpoints.length - 1}
                      className="h-4 w-6"
                      aria-label={`Move endpoint ${index + 1} down`}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    id={`r-svc-${index}`}
                    value={endpoint.url}
                    onChange={e => updateServiceEndpointUrl(index, e.target.value)}
                    placeholder="http://backend:8080"
                    className="min-w-0"
                  />
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={endpoint.weight}
                    onChange={e => updateServiceEndpointWeight(index, e.target.value)}
                    className="w-full"
                    aria-label={`Weight for endpoint ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeServiceEndpoint(index)}
                    disabled={serviceEndpoints.length === 1}
                    className="h-8 w-8 text-red-400 hover:text-destructive"
                    title={`Remove endpoint ${index + 1}`}
                    aria-label={`Remove endpoint ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Endpoints support weights for load balancing. Reorder them with arrows.</p>
          </div>

          <div className="space-y-1">
            <Label>Ingresses</Label>
            {availableEntryPoints.length === 0 ? (
              <p className="text-muted-foreground text-xs">No ingresses defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableEntryPoints.map(ep => (
                  <button
                    key={ep}
                    type="button"
                    onClick={() => toggleItem(selectedEPs, setSelectedEPs, ep)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEPs.includes(ep)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {ep}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Middlewares</Label>
            {availableMiddlewares.length === 0 ? (
              <p className="text-muted-foreground text-xs">No middlewares defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableMiddlewares.map(mw => (
                  <button
                    key={mw}
                    type="button"
                    onClick={() => toggleItem(selectedMWs, setSelectedMWs, mw)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedMWs.includes(mw)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {mw}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="r-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="r-enabled">Enabled</Label>
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
