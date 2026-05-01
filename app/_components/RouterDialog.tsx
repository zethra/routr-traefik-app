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

type Props = {
  open: boolean
  onClose: () => void
  router?: RouterData
  profileId: string
  availableEntryPoints: string[]
  availableMiddlewares: string[]
  availableDomains: Domain[]
}

function parseRuleIntoDomain(rule: string, domains: Domain[]): { subdomain: string; domain: string } | null {
  const match = rule.match(/Host\(`([^`]+)`\)/)
  if (!match) return null
  const hostname = match[1]
  for (const d of domains) {
    if (hostname === d.domain) return { subdomain: '', domain: d.domain }
    if (hostname.endsWith(`.${d.domain}`)) {
      return { subdomain: hostname.slice(0, -(d.domain.length + 1)), domain: d.domain }
    }
  }
  return null
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
  const [serviceUrl, setServiceUrl] = useState(router?.service_url ?? '')
  const [selectedEPs, setSelectedEPs] = useState<string[]>(
    router ? JSON.parse(router.entry_points) : []
  )
  const [selectedMWs, setSelectedMWs] = useState<string[]>(
    router ? JSON.parse(router.middlewares) : []
  )
  const [priority, setPriority] = useState<string>(router?.priority?.toString() ?? '')
  const [enabled, setEnabled] = useState(router ? router.enabled === 1 : true)

  const computedHostname = selectedDomain
    ? subdomain.trim() ? `${subdomain.trim()}.${selectedDomain}` : selectedDomain
    : ''
  const computedRule = computedHostname ? `Host(\`${computedHostname}\`)` : ''

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
      if (parsed) { setSubdomain(parsed.subdomain); selectDomain(parsed.domain) }
    }
    setMode(next)
  }

  function handleClose() {
    if (!isEdit) {
      setName(''); setServiceUrl('')
      setSubdomain('')
      const stored = localStorage.getItem('routr:lastDomain')
      setSelectedDomain((stored && availableDomains.some(d => d.domain === stored)) ? stored : (availableDomains[0]?.domain ?? ''))
      setCustomRule('')
      setSelectedEPs([]); setSelectedMWs([])
      setPriority(''); setEnabled(true)
      setMode(hasDomains ? 'domain' : 'custom')
    }
    onClose()
  }

  function handleSubmit() {
    if (!name.trim() || !activeRule.trim() || !serviceUrl.trim()) {
      toast.error('Name, hostname and service URL are required')
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
          service_url: serviceUrl.trim(),
          entry_points: selectedEPs,
          middlewares: selectedMWs,
          priority: priority ? parseInt(priority) : null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center gap-1.5">
                  <Input
                    value={subdomain}
                    onChange={e => setSubdomain(e.target.value)}
                    placeholder="plex"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground text-sm shrink-0">.</span>
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
              </div>
            ) : (
              <Input
                value={customRule}
                onChange={e => setCustomRule(e.target.value)}
                placeholder="Host(`example.com`)"
              />
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="r-svc">Service URL</Label>
            <Input id="r-svc" value={serviceUrl} onChange={e => setServiceUrl(e.target.value)} placeholder="http://backend:8080" />
          </div>

          <div className="space-y-1">
            <Label>Entry Points</Label>
            {availableEntryPoints.length === 0 ? (
              <p className="text-muted-foreground text-xs">No entry points defined yet.</p>
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

          <div className="space-y-1">
            <Label htmlFor="r-priority">Priority (optional)</Label>
            <Input id="r-priority" type="number" value={priority} onChange={e => setPriority(e.target.value)} placeholder="100" />
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
