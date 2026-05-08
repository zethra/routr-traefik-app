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
  activeTab: TabValue
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
  activeTab,
}: Props) {
  return (
    <>
      {activeTab === 'domains' && (
        <DomainsTab profileId={profileId} domains={domains} routers={routers} />
      )}

      {activeTab === 'services' && (
        <ServiceTab
          profileId={profileId}
          services={services}
          routers={routers}
          availableEntryPoints={entryPointNames}
          availableMiddlewares={middlewareNames}
          availableDomains={domains}
        />
      )}

      {activeTab === 'entrypoints' && (
        <EntryPointsTab profileId={profileId} entryPoints={entryPoints} />
      )}

      {activeTab === 'middlewares' && (
        <MiddlewaresTab profileId={profileId} middlewares={middlewares} />
      )}
    </>
  )
}
