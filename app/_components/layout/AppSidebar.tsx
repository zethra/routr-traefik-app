'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DomainRow, ServiceRow, EntryPointRow, MiddlewareRow } from '@/lib/db'
import { iconMap, TabValue } from '../constants'
import { AppLogo } from './AppLogo'

type Props = {
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
  domains: DomainRow[]
  services: ServiceRow[]
  entryPoints: EntryPointRow[]
  middlewares: MiddlewareRow[]
  isCollapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

export function AppSidebar({ activeTab, onTabChange, domains, services, entryPoints, middlewares, isCollapsed = false, onCollapse }: Props) {
  const [isOpen, setIsOpen] = useState(!isCollapsed)

  useEffect(() => {
    setIsOpen(!isCollapsed)
  }, [isCollapsed])

  const navItems: Array<{ id: TabValue; label: string; count: number }> = [
    { id: 'domains', label: 'Domains', count: domains.length },
    { id: 'services', label: 'Services', count: services.length },
    { id: 'entrypoints', label: 'Ingresses', count: entryPoints.length },
    { id: 'middlewares', label: 'Middleware', count: middlewares.length },
  ]

  return (
    <aside className={`border-r bg-card flex-shrink-0 h-screen overflow-hidden transition-all duration-700 flex flex-col ${
      isOpen ? 'fixed top-0 left-0 w-64 z-50' : 'sticky top-0 w-20 z-0'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header - visible when expanded */}
        {isOpen && (
          <div className="border-b px-4 py-5 flex items-center justify-between">
            <AppLogo />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onCollapse?.(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Navigation - starts below header */}
        <nav className={`flex-1 space-y-3 pb-3 overflow-y-auto flex flex-col pt-3 ${
          isOpen ? 'px-3' : 'px-0 items-center'
        }`}>
          {navItems.map(item => {
            const Icon = iconMap[item.id]
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`text-left rounded-md text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  isOpen ? 'w-full px-3 py-2 justify-start' : 'h-9 w-9 flex-shrink-0'
                } ${
                  activeTab === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {isOpen && (
                  <>
                    <span className="font-medium flex-1">{item.label}</span>
                    <Badge
                      variant={activeTab === item.id ? "default" : "secondary"}
                      className={`text-xs w-5 h-5 flex items-center justify-center ${
                        activeTab === item.id
                          ? 'dark:bg-background dark:text-primary bg-muted text-primary'
                          : 'dark:bg-white dark:text-black bg-black text-white'
                      }`}
                    >
                      {item.count}
                    </Badge>
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
