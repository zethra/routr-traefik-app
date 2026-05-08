'use client'

import { useState } from 'react'
import { RouterRow, MiddlewareRow, EntryPointRow, DomainRow, ServiceRow } from '@/lib/db'
import { AppNavigation } from './navigation/AppNavigation'
import { AppSidebar } from './navigation/AppSidebar'
import { AppMobileNavbar } from './navigation/AppMobileNavbar'
import { DomainsTab } from '../tabs/domains/DomainsTab'
import { ServiceTab } from '../tabs/services/ServiceTab'
import { EntryPointsTab } from '../tabs/entrypoints/EntryPointsTab'
import { MiddlewaresTab } from '../tabs/middleware/MiddlewaresTab'
import { TabValue } from './navigation/config'

type Props = {
  session: any
  allProfiles: any[]
  currentProfile: string
  profileId: string
  routers: RouterRow[]
  middlewares: MiddlewareRow[]
  entryPoints: EntryPointRow[]
  domains: DomainRow[]
  services: ServiceRow[]
  entryPointNames: string[]
  middlewareNames: string[]
}

export function AppLayout({
  session,
  allProfiles,
  currentProfile,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Desktop layout */}
      <div className={`hidden md:flex md:flex-col md:flex-1 transition-all duration-700 ${
        sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
      }`}>
        {/* Top navigation - shown when sidebar collapsed */}
        {sidebarCollapsed && (
          <AppNavigation
            isCollapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            session={session}
            allProfiles={allProfiles}
            currentProfile={currentProfile}
            showLogoAndCollapse={true}
          />
        )}

        {/* Sidebar and content row */}
        <div className="flex flex-1">
          {/* Desktop sidebar - on left, shows as icons when collapsed */}
          <div className="flex flex-col flex-shrink-0">
            <AppSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              domains={domains}
              services={services}
              entryPoints={entryPoints}
              middlewares={middlewares}
              isCollapsed={sidebarCollapsed}
              onCollapse={setSidebarCollapsed}
            />
          </div>

          {/* Main content column */}
          <div className="flex flex-col flex-1">
            {/* Top navigation - shown when sidebar expanded */}
            {!sidebarCollapsed && (
              <AppNavigation
                isCollapsed={sidebarCollapsed}
                onCollapse={setSidebarCollapsed}
                session={session}
                allProfiles={allProfiles}
                currentProfile={currentProfile}
                showLogoAndCollapse={false}
              />
            )}

          {/* Page content */}
        <div className="flex-1 flex flex-col pt-16 relative z-0 overflow-hidden">
          {/* Page content */}
          <main className="flex-1 min-h-0 px-4 py-4 md:py-6 relative overflow-hidden">
            <div className="max-w-6xl mx-auto h-full min-h-0 flex flex-col">
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
            </div>
          </main>
        </div>
      </div>
        </div>
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex-1 overflow-auto px-4 py-4">
        <div>
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
        </div>
      </div>

      {/* Mobile navbar - only visible on mobile */}
      <AppMobileNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          domains: domains.length,
          services: services.length,
          entrypoints: entryPoints.length,
          middlewares: middlewares.length,
        }}
      />

      {/* Bottom padding for mobile to account for fixed navbar */}
      <div className="md:hidden h-20" />
    </div>
  )
}
