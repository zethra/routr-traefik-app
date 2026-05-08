import { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
}

export function AppTabContentLayout({ title, children }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-b from-background via-background to-muted/10 p-2 md:p-4">
        {children}
      </div>
    </div>
  )
}
