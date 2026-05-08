import { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
}

export function AppTabLayout({ title, children }: Props) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/70 mb-10">
        <div className="h-full overflow-y-auto bg-gradient-to-b from-background via-background to-muted/10 p-2 md:p-4">
          <div className="space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
