'use client'

import { useState } from 'react'
import { ChevronLeft, Globe, Box, Network, Layers } from 'lucide-react'
import { DomainRow, ServiceRow, EntryPointRow, MiddlewareRow } from '@/lib/db'
import { Button } from '@/components/ui/button'

type TabValue = 'domains' | 'entrypoints' | 'middlewares' | 'services'

type Props = {
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
  domains: DomainRow[]
  services: ServiceRow[]
  entryPoints: EntryPointRow[]
  middlewares: MiddlewareRow[]
}

const iconMap: Record<TabValue, any> = {
  domains: Globe,
  services: Box,
  entrypoints: Network,
  middlewares: Layers,
}

export function AppSidebar({ activeTab, onTabChange, domains, services, entryPoints, middlewares }: Props) {
  const [isOpen, setIsOpen] = useState(true)

  const navItems: Array<{ id: TabValue; label: string; count: number }> = [
    { id: 'domains', label: 'Domains', count: domains.length },
    { id: 'services', label: 'Services', count: services.length },
    { id: 'entrypoints', label: 'Ingresses', count: entryPoints.length },
    { id: 'middlewares', label: 'Middleware', count: middlewares.length },
  ]

  return (
    <aside className={`border-r bg-background flex-shrink-0 h-screen sticky top-0 overflow-hidden transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-20'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header with Logo */}
        <div className="border-b p-4 flex items-center justify-between">
          {isOpen && (
            <h2 className="font-semibold text-base tracking-tight">Routr</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-0' : 'rotate-180'}`} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto hidden md:flex md:flex-col">
          {navItems.map(item => {
            const Icon = iconMap[item.id]
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`text-left rounded-md text-sm transition-colors flex items-center justify-center gap-3 whitespace-nowrap ${
                  isOpen ? 'w-full px-3 py-2 justify-start' : 'h-9 w-9 flex-shrink-0'
                } ${
                  activeTab === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {isOpen && (
                  <>
                    <span className="font-medium flex-1">{item.label}</span>
                    <span className="text-xs opacity-70">({item.count})</span>
                  </>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
