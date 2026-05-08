'use client'

import { useState } from 'react'
import { RouterRow, MiddlewareRow, EntryPointRow, DomainRow, ServiceRow } from '@/lib/db'
import { MainTabs } from './MainTabs'
import { AppSidebar } from './AppSidebar'
import { ThemeToggle } from './ThemeToggle'
import { ProfileSwitcher } from './ProfileSwitcher'
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - full height */}
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        domains={domains}
        services={services}
        entryPoints={entryPoints}
        middlewares={middlewares}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b">
          <div className="max-w-full mx-auto px-4 py-4 flex items-center justify-end gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground max-w-[220px] truncate">
              {session?.user?.email ?? session?.user?.name ?? 'Signed in'}
            </span>
            <form action={signOutUser}>
              <Button type="submit" variant="outline" size="sm">Sign out</Button>
            </form>
            <ProfileSwitcher profiles={allProfiles} currentProfile={currentProfile} />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto px-4 py-6">
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
  )
}
