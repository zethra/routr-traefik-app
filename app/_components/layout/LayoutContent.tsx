'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { RouterRow, MiddlewareRow, EntryPointRow, DomainRow, ServiceRow } from '@/lib/db'
import { MainTabs } from '../MainTabs'
import { AppSidebar } from './AppSidebar'
import { MobileNavbar } from './MobileNavbar'
import { ThemeToggle } from '../ThemeToggle'
import { ProfileSwitcher } from '../ProfileSwitcher'
import { AppLogo } from './AppLogo'
import { Button } from '@/components/ui/button'
import { signOutUser } from '@/app/_actions/auth'

type TabValue = 'domains' | 'entrypoints' | 'middlewares' | 'services'

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

export function LayoutContent({
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

  const HeaderContent = () => (
    <header className="border-b bg-card">
      <div className="max-w-full mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <AppLogo />
          </div>
          {sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden md:flex"
              onClick={() => setSidebarCollapsed(false)}
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          )}
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden md:flex"
              onClick={() => setSidebarCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:inline text-xs text-muted-foreground max-w-[220px] truncate">
            {session?.user?.email ?? session?.user?.name ?? 'Signed in'}
          </span>
          <form action={signOutUser}>
            <Button type="submit" variant="outline" size="sm">Sign out</Button>
          </form>
          <ProfileSwitcher profiles={allProfiles} currentProfile={currentProfile} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )

  const DesktopSidebarContent = () => (
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
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile bottom navbar */}
      <MobileNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          domains: domains.length,
          services: services.length,
          entrypoints: entryPoints.length,
          middlewares: middlewares.length,
        }}
      />

      {/* Header - always show on desktop */}
      <div className={`hidden md:block ${!sidebarCollapsed ? 'z-0' : 'z-40'}`}>
        <HeaderContent />
      </div>

      {/* Main content area */}
      <div className="flex flex-1">
        {/* Desktop sidebar - in layout */}
        <div className="hidden md:flex md:flex-col md:flex-shrink-0">
          <DesktopSidebarContent />
        </div>

        {/* Content */}
        <div className={`flex-1 flex flex-col ${!sidebarCollapsed ? 'md:ml-64' : ''}`}>
          {/* Page content */}
          <main className="flex-1 overflow-auto px-4 py-4 md:py-6">
            <div className="max-w-6xl mx-auto">
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
            </div>
          </main>
        </div>
      </div>

      {/* Bottom padding for mobile to account for fixed navbar */}
      <div className="md:hidden h-20" />
    </div>
  )
}
