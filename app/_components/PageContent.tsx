'use client'

import { useState } from 'react'
import { RouterRow, MiddlewareRow, EntryPointRow, DomainRow, ServiceRow } from '@/lib/db'
import { MainTabs } from './MainTabs'
import { AppSidebar } from './AppSidebar'

type TabValue = 'domains' | 'entrypoints' | 'middlewares' | 'services'

type Props = {
  profileId: string
  routers: RouterRow[]
  middlewares: MiddlewareRow[]
  entryPoints: EntryPointRow[]
  domains: DomainRow[]
  services: ServiceRow[]
  entryPointNames: string[]
  middlewareNames: string[]
}

export function PageContent({
  profileId,
  routers,
  middlewares,
  entryPoints,
  domains,
  services,
  entryPointNames,
  middlewareNames,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>('services')

  return (
    <div className="flex flex-1 overflow-hidden">
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        domains={domains}
        services={services}
        entryPoints={entryPoints}
        middlewares={middlewares}
      />
      <main className="flex-1 overflow-auto px-4 py-6">
        <MainTabs
          profileId={profileId}
          routers={routers}
          middlewares={middlewares}
          entryPoints={entryPoints}
          domains={domains}
          services={services}
          entryPointNames={entryPointNames}
          middlewareNames={middlewareNames}
          activeTab={activeTab}
        />
      </main>
    </div>
  )
}
