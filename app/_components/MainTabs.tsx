'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoutersTab } from './RoutersTab'
import { MiddlewaresTab } from './MiddlewaresTab'
import { EntryPointsTab } from './EntryPointsTab'
import { DomainsTab } from './DomainsTab'
import { ServicesTab } from './ServicesTab'

type RouterRow = {
  id: string
  name: string
  rule: string
  service_url: string
  service_id: string | null
  entry_points: string
  middlewares: string
  priority: number | null
  enabled: number
}

type MiddlewareRow = {
  id: string
  name: string
  type: string
  config: string
  enabled: number
}

type EntryPointRow = {
  id: string
  name: string
  port: number | null
  created_at: string
}

type DomainRow = {
  id: string
  domain: string
  cert_resolver: string
  created_at: string
}

type ServiceRow = {
  id: string
  name: string
  endpoints: string
  logo: string | null
  tag: string | null
  enabled: number
  profile_id: string
  created_at: string
  updated_at: string
}

type TabValue = 'domains' | 'entrypoints' | 'middlewares' | 'routers' | 'services'

type Props = {
  profileId: string
  profileName: string
  profileToken: string
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
  profileName,
  profileToken,
  routers,
  middlewares,
  entryPoints,
  domains,
  services,
  entryPointNames,
  middlewareNames,
  initialTab = 'routers',
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
      <TabsList className="mb-4">
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="routers">Routes</TabsTrigger>
        <TabsTrigger value="entrypoints">Ingresses</TabsTrigger>
        <TabsTrigger value="middlewares">Middleware</TabsTrigger>
      </TabsList>

      <TabsContent value="domains">
        <DomainsTab profileId={profileId} domains={domains} routers={routers} />
      </TabsContent>

      <TabsContent value="services">
        <ServicesTab profileId={profileId} services={services} routers={routers} onNavigate={setActiveTab} />
      </TabsContent>

      <TabsContent value="routers">
        <RoutersTab
          profileId={profileId}
          profileName={profileName}
          profileToken={profileToken}
          routers={routers}
          entryPointNames={entryPointNames}
          middlewareNames={middlewareNames}
          domains={domains}
          services={services}
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
