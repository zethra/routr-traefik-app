'use client'

import { navItems, TabValue } from './constants'

type Props = {
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
  counts: {
    domains: number
    services: number
    entrypoints: number
    middlewares: number
  }
}

export function MobileNavbar({ activeTab, onTabChange, counts }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-border flex justify-around items-center h-20 z-40">
      {navItems.map((item) => {
        const Icon = item.icon
        const count = counts[item.id as keyof typeof counts]

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as TabValue)}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-4 flex-1 relative ${
              activeTab === item.id
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">
                {count}
              </span>
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
