import { profiles, routers, middlewares, entryPoints, domains, services } from '@/lib/db'
import { ThemeToggle } from './_components/ThemeToggle'
import { ProfileSwitcher } from './_components/ProfileSwitcher'
import { LayoutContent } from './_components/layout/LayoutContent'
import { ensureHealthMonitorStarted } from '@/lib/router-health'
import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { signOutUser } from '@/app/_actions/auth'

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  ensureHealthMonitorStarted()
  const session = process.env.SKIP_AUTH === 'true'
    ? { user: { email: 'dev@localhost', name: 'Developer' } }
    : await auth()

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
  const serviceRows = services.list(profile.id)

  const epNames = entryPointRows.map(ep => ep.name)
  const mwNames = middlewareRows.map(mw => mw.name)

  return (
    <LayoutContent
      session={session}
      allProfiles={allProfiles}
      currentProfile={profile.name}
      profileId={profile.id}
      routers={routerRows}
      middlewares={middlewareRows}
      entryPoints={entryPointRows}
      domains={domainRows}
      services={serviceRows}
      entryPointNames={epNames}
      middlewareNames={mwNames}
    />
  )
}
