'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DomainRow, ServiceRow, EntryPointRow, MiddlewareRow } from '@/lib/db'
import { iconMap, TabValue } from './config'
import { AppBrand } from './AppBrand'
import { AppNavIcon } from './AppNavIcon'

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

  const tabItems: Array<{ id: TabValue; label: string; count: number }> = [
    { id: 'domains', label: 'Domains', count: domains.length },
    { id: 'services', label: 'Services', count: services.length },
    { id: 'entrypoints', label: 'Ingresses', count: entryPoints.length },
    { id: 'middlewares', label: 'Middleware', count: middlewares.length },
  ]

  return (
    <aside className={`border-r bg-card flex-shrink-0 h-screen overflow-hidden transition-all duration-700 flex flex-col ${
      isOpen ? 'w-64' : 'w-20'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header - visible when expanded */}
        {isOpen && (
          <div className="border-b px-4 py-5 flex items-center justify-between">
            <AppBrand />
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
          {tabItems.map(item => {
            const Icon = iconMap[item.id]
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`text-left rounded-md text-sm transition-colors flex items-center justify-center whitespace-nowrap ${
                  isOpen ? 'w-full px-3 py-2 justify-start gap-3' : 'h-9 w-9 flex-shrink-0'
                } ${
                  activeTab === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
                title={!isOpen ? item.label : undefined}
              >
                <AppNavIcon
                  icon={<Icon className="h-5 w-5" />}
                  count={item.count}
                  showBadge={isOpen}
                  badgeClassName={activeTab === item.id ? "dark:bg-black dark:text-white bg-white text-black" : "bg-primary text-primary-foreground"}
                />
                {isOpen && (
                  <span className="font-bold flex-1">{item.label}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
