import React from 'react'

type Props = {
  icon: React.ReactNode
  count: number
  badgeClassName?: string
  showBadge?: boolean
}

export function AppNavIcon({ icon, count, badgeClassName, showBadge = true }: Props) {
  return (
    <div className="relative">
      {icon}
      {showBadge && (
        <span className={`absolute -top-0.5 -right-0.5 text-[8px] font-bold rounded-full h-3 w-3 flex items-center justify-center ${
          badgeClassName || 'bg-primary text-primary-foreground'
        }`}>
          {count}
        </span>
      )}
    </div>
  )
}
