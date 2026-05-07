'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { createRouter, updateRouter } from '@/app/_actions/routers'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type RouterData = {
  id: string
  name: string
  rule: string
  service_id: string | null
  entry_points: string
  middlewares: string
  priority: number | null
  enabled: number
}

type Domain = { id: string; domain: string }
type Service = { id: string; name: string; endpoints: string }

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
  availableServices: Service[]
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

export function RouterDialog({ open, onClose, router, profileId, availableEntryPoints, availableMiddlewares, availableDomains, availableServices }: Props) {
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
  const [selectedServiceId, setSelectedServiceId] = useState(router?.service_id ?? '')
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceOpen, setServiceOpen] = useState(false)

  const selectedService = selectedServiceId ? availableServices.find(s => s.id === selectedServiceId) : null
  const defaultEntryPoints = !isEdit && availableEntryPoints.includes('websecure') ? ['websecure'] : []
  const [selectedEPs, setSelectedEPs] = useState<string[]>(
    router ? JSON.parse(router.entry_points) : defaultEntryPoints
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
      setName('')
      setSelectedServiceId('')
      setServiceSearch('')
      setServiceOpen(false)
      setSubdomain('')
      setAliases([])
      const stored = localStorage.getItem('routr:lastDomain')
      setSelectedDomain((stored && availableDomains.some(d => d.domain === stored)) ? stored : (availableDomains[0]?.domain ?? ''))
      setCustomRule('')
      setSelectedEPs(defaultEntryPoints); setSelectedMWs([])
      setEnabled(true)
      setMode(hasDomains ? 'domain' : 'custom')
    }
    onClose()
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
    if (!name.trim() || !activeRule.trim() || !selectedServiceId) {
      toast.error('Name, hostname and a service are required')
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
          service_id: selectedServiceId,
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

          <div className="space-y-1.5">
            <Label htmlFor="r-service">Service</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setServiceOpen(!serviceOpen)}
                role="combobox"
                aria-expanded={serviceOpen}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-between hover:bg-accent hover:text-accent-foreground"
              >
                {selectedService ? selectedService.name : 'Select service…'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
              {serviceOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-md z-50">
                  <Command>
                    <CommandInput
                      placeholder="Search services..."
                      value={serviceSearch}
                      onValueChange={setServiceSearch}
                    />
                    <CommandEmpty>No service found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {availableServices
                          .filter(s =>
                            s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                            s.endpoints.toLowerCase().includes(serviceSearch.toLowerCase())
                          )
                          .map(service => {
                            const endpoints = (() => {
                              try {
                                const parsed = JSON.parse(service.endpoints)
                                return Array.isArray(parsed) ? parsed : []
                              } catch {
                                return []
                              }
                            })()
                            return (
                              <CommandItem
                                key={service.id}
                                value={service.id}
                                onSelect={currentValue => {
                                  setSelectedServiceId(currentValue)
                                  setServiceOpen(false)
                                  setServiceSearch('')
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedServiceId === service.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{service.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {endpoints.length} endpoint{endpoints.length === 1 ? '' : 's'}
                                  </div>
                                </div>
                              </CommandItem>
                            )
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            {selectedService && (
              <div className="rounded border border-border/50 bg-muted/20 p-2 text-xs space-y-1">
                <p className="font-medium">Endpoints:</p>
                {(() => {
                  try {
                    const parsed = JSON.parse(selectedService.endpoints)
                    return Array.isArray(parsed) && parsed.length > 0 ? (
                      <div className="space-y-0.5 ml-2">
                        {parsed.map((url: string, idx: number) => (
                          <div key={idx} className="text-muted-foreground font-mono">
                            {url}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No endpoints</p>
                    )
                  } catch {
                    return <p className="text-muted-foreground">Invalid endpoints</p>
                  }
                })()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Select a service for this router to use. Services are configured in the Services tab.</p>
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
