'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { RouterRow, DomainRow } from '@/lib/db'
import { extractHostnames } from '@/lib/utils'
import { parseRuleIntoDomain } from '@/lib/serviceUtils'
import { X, Route } from 'lucide-react'

type Props = {
  routeToEdit: RouterRow | null
  availableEntryPoints: string[]
  availableMiddlewares: string[]
  availableDomains: DomainRow[]
  onClose: () => void
  onSubmit: (data: {
    routeMode: 'domain' | 'custom'
    customRule: string
    selectedEPs: string[]
    selectedMWs: string[]
    routeEnabled: boolean
  }) => void
}

function toggleItem<T>(items: T[], setItems: (items: T[]) => void, item: T) {
  if (items.includes(item)) {
    setItems(items.filter(i => i !== item))
  } else {
    setItems([...items, item])
  }
}

export function ServiceRouteForm({
  routeToEdit,
  availableEntryPoints,
  availableMiddlewares,
  availableDomains,
  onClose,
  onSubmit,
}: Props) {
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

  const handleSubmit = () => {
    onSubmit({
      routeMode,
      customRule,
      selectedEPs,
      selectedMWs,
      routeEnabled,
    })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold">{routeToEdit ? `Edit: ${routeToEdit.name}` : '✨ Create New Route'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Configure how this route is accessed</p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
  )
}
