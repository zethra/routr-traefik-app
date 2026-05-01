import { profiles, routers, middlewares, entryPoints, domains } from '@/lib/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoutersTab } from './_components/RoutersTab'
import { MiddlewaresTab } from './_components/MiddlewaresTab'
import { EntryPointsTab } from './_components/EntryPointsTab'
import { DomainsTab } from './_components/DomainsTab'
import { ThemeToggle } from './_components/ThemeToggle'
import { ProfileSwitcher } from './_components/ProfileSwitcher'

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
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

        <Tabs defaultValue="routers">
          <TabsList className="mb-4">
            <TabsTrigger value="routers">Routers</TabsTrigger>
            <TabsTrigger value="middlewares">Middlewares</TabsTrigger>
            <TabsTrigger value="entrypoints">Entry Points</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
          </TabsList>

          <TabsContent value="routers">
            <RoutersTab
              profileId={profile.id}
              routers={routerRows}
              entryPointNames={epNames}
              middlewareNames={mwNames}
              domains={domainRows}
            />
          </TabsContent>

          <TabsContent value="middlewares">
            <MiddlewaresTab profileId={profile.id} middlewares={middlewareRows} />
          </TabsContent>

          <TabsContent value="entrypoints">
            <EntryPointsTab profileId={profile.id} entryPoints={entryPointRows} />
          </TabsContent>

          <TabsContent value="domains">
            <DomainsTab profileId={profile.id} domains={domainRows} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
