'use server'

import { revalidatePath } from 'next/cache'
import { routers } from '@/lib/db'

function normalizeRule(rule: string): string {
  const trimmed = rule.trim()
  return trimmed.includes('(') ? trimmed : `Host(\`${trimmed}\`)`
}

export async function createRouter(profileId: string, data: {
  name: string
  rule: string
  service_url: string
  entry_points: string[]
  middlewares: string[]
  priority?: number | null
}) {
  routers.create(profileId, { ...data, rule: normalizeRule(data.rule) })
  revalidatePath('/')
}

export async function updateRouter(id: string, data: {
  name: string
  rule: string
  service_url: string
  entry_points: string[]
  middlewares: string[]
  priority?: number | null
  enabled: boolean
}) {
  routers.update(id, { ...data, rule: normalizeRule(data.rule) })
  revalidatePath('/')
}

export async function deleteRouter(id: string) {
  routers.delete(id)
  revalidatePath('/')
}

export async function deleteRouters(ids: string[]) {
  for (const id of ids) routers.delete(id)
  revalidatePath('/')
}

function nextCloneName(existingNames: string[], sourceName: string): string {
  const base = `${sourceName}-copy`
  if (!existingNames.includes(base)) return base

  let i = 2
  while (existingNames.includes(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

export async function cloneRouter(profileId: string, id: string) {
  const source = routers.get(id)
  if (!source) throw new Error('Router not found')

  const existingNames = routers.list(profileId).map(r => r.name)
  const cloneName = nextCloneName(existingNames, source.name)

  routers.create(profileId, {
    name: cloneName,
    rule: normalizeRule(source.rule),
    service_url: source.service_url,
    entry_points: JSON.parse(source.entry_points),
    middlewares: JSON.parse(source.middlewares),
    priority: source.priority,
    enabled: source.enabled === 1,
  })

  revalidatePath('/')
}

export async function toggleRouter(id: string, enabled: boolean) {
  routers.toggleEnabled(id, enabled)
  revalidatePath('/')
}
