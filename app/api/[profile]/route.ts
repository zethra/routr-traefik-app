import type { NextRequest } from 'next/server'
import { profiles, routers, middlewares, domains, services } from '@/lib/db'
import { buildTraefikConfig } from '@/lib/traefik'

export async function GET(req: NextRequest, ctx: RouteContext<'/api/[profile]'>) {
  try {
    const { profile: profileName } = await ctx.params

    const profile = profiles.getByName(profileName)
    if (!profile) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const token = req.nextUrl.searchParams.get('token')
    if (token !== profile.token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = buildTraefikConfig(
      routers.list(profile.id),
      middlewares.list(profile.id),
      domains.list(profile.id),
      services.list(profile.id),
    )
    return Response.json(config)
  } catch (error) {
    console.error('Failed to build Traefik config', error)
    return Response.json({
      http: {
        routers: {},
        services: {},
      },
    })
  }
}
