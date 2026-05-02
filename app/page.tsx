import { profiles, routers, middlewares, entryPoints, domains } from '@/lib/db'
import { ThemeToggle } from './_components/ThemeToggle'
import { ProfileSwitcher } from './_components/ProfileSwitcher'
import { MainTabs } from './_components/MainTabs'
import { ensureHealthMonitorStarted } from '@/lib/router-health'
import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { signOutUser } from '@/app/_actions/auth'

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  ensureHealthMonitorStarted()
  const session = await auth()

  const params = await searchParams
  const requestedName = params.profile

  const allProfiles = profiles.listWithStats()
  const defaultName = process.env.PROFILE_NAME ?? 'default'
  const profile = (requestedName ? profiles.getByName(requestedName) : null)
    ?? profiles.getByName(defaultName)
    ?? allProfiles[0]

  if (!profile) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">No profiles found.</div>
  }

  const routerRows = routers.list(profile.id)
  const middlewareRows = middlewares.list(profile.id)
  const entryPointRows = entryPoints.list(profile.id)
  const domainRows = domains.list(profile.id)

  const epNames = entryPointRows.map(ep => ep.name)
  const mwNames = middlewareRows.map(mw => mw.name)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Routr</h1>
            <p className="text-muted-foreground text-xs">Traefik dynamic config GUI</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-muted-foreground max-w-[220px] truncate">
              {session?.user?.email ?? session?.user?.name ?? 'Signed in'}
            </span>
            <form action={signOutUser}>
              <Button type="submit" variant="outline" size="sm">Sign out</Button>
            </form>
            <ProfileSwitcher profiles={allProfiles} currentProfile={profile.name} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{routerRows.length} routers</span>
          <span>·</span>
          <span>{middlewareRows.length} middlewares</span>
          <span>·</span>
          <span>{entryPointRows.length} entry points</span>
        </div>

        <MainTabs
          profileId={profile.id}
          profileName={profile.name}
          profileToken={profile.token}
          routers={routerRows}
          middlewares={middlewareRows}
          entryPoints={entryPointRows}
          domains={domainRows}
          entryPointNames={epNames}
          middlewareNames={mwNames}
          initialTab="routers"
        />
      </main>
    </div>
  )
}
