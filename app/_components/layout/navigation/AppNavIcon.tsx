import React from 'react'

type Props = {
  icon: React.ReactNode
  count: number
  badgeClassName?: string
}

export function AppNavIcon({ icon, count, badgeClassName }: Props) {
  return (
    <div className="relative">
      {icon}
      <span className={`absolute -top-0.5 -right-0.5 text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center ${
        badgeClassName || 'bg-primary text-primary-foreground'
      }`}>
        {count}
      </span>
    </div>
  )
}
