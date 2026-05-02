'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoutersTab } from './RoutersTab'
import { MiddlewaresTab } from './MiddlewaresTab'
import { EntryPointsTab } from './EntryPointsTab'
import { DomainsTab } from './DomainsTab'

type RouterRow = {
  id: string
  name: string
  rule: string
  service_url: string
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

type TabValue = 'domains' | 'entrypoints' | 'middlewares' | 'routers'

type Props = {
  profileId: string
  profileName: string
  profileToken: string
  routers: RouterRow[]
  middlewares: MiddlewareRow[]
  entryPoints: EntryPointRow[]
  domains: DomainRow[]
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
  entryPointNames,
  middlewareNames,
  initialTab = 'routers',
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
      <TabsList className="mb-4">
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="entrypoints">Ingresses</TabsTrigger>
        <TabsTrigger value="middlewares">Middleware</TabsTrigger>
        <TabsTrigger value="routers">Routes</TabsTrigger>
      </TabsList>

      <TabsContent value="domains">
        <DomainsTab profileId={profileId} domains={domains} routers={routers} />
      </TabsContent>

      <TabsContent value="entrypoints">
        <EntryPointsTab profileId={profileId} entryPoints={entryPoints} />
      </TabsContent>

      <TabsContent value="middlewares">
        <MiddlewaresTab profileId={profileId} middlewares={middlewares} />
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
        />
      </TabsContent>
    </Tabs>
  )
}
