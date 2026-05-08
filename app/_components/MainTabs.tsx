'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RouterRow, MiddlewareRow, EntryPointRow, DomainRow, ServiceRow } from '@/lib/db'
import { MiddlewaresTab } from './MiddlewaresTab'
import { EntryPointsTab } from './EntryPointsTab'
import { DomainsTab } from './DomainsTab'
import { ServiceTab } from './services/ServiceTab'

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
  initialTab?: TabValue
}

export function MainTabs({
  profileId,
  routers,
  middlewares,
  entryPoints,
  domains,
  services,
  entryPointNames,
  middlewareNames,
  initialTab = 'services',
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
      <TabsList className="mb-4">
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="entrypoints">Ingresses</TabsTrigger>
        <TabsTrigger value="middlewares">Middleware</TabsTrigger>
      </TabsList>

      <TabsContent value="domains">
        <DomainsTab profileId={profileId} domains={domains} routers={routers} />
      </TabsContent>

      <TabsContent value="services">
        <ServiceTab
          profileId={profileId}
          services={services}
          routers={routers}
          availableEntryPoints={entryPointNames}
          availableMiddlewares={middlewareNames}
          availableDomains={domains}
        />
      </TabsContent>

      <TabsContent value="entrypoints">
        <EntryPointsTab profileId={profileId} entryPoints={entryPoints} />
      </TabsContent>

      <TabsContent value="middlewares">
        <MiddlewaresTab profileId={profileId} middlewares={middlewares} />
      </TabsContent>
    </Tabs>
  )
}
