'use client'

import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '../../ThemeToggle'
import { ProfileSwitcher } from '../../settings/ProfileSwitcher'
import { AppBrand } from './AppBrand'
import { signOutUser } from '@/app/_actions/auth'

type Props = {
  isCollapsed: boolean
  onCollapse: (collapsed: boolean) => void
  session: any
  allProfiles: any[]
  currentProfile: string
  showLogoAndCollapse?: boolean
}

export function AppNavigation({ isCollapsed, onCollapse, session, allProfiles, currentProfile, showLogoAndCollapse = true }: Props) {
  return (
    <header className="border-b bg-card">
      <div className="max-w-full mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showLogoAndCollapse && (
            <>
              <div className="hidden md:block">
                <AppBrand />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden md:flex"
                onClick={() => onCollapse(!isCollapsed)}
              >
                <ChevronLeft className={`h-4 w-4 ${isCollapsed ? 'rotate-180' : ''}`} />
              </Button>
            </>
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
}
