'use server'

import { revalidatePath } from 'next/cache'
import { routers } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'

function normalizeRule(rule: string): string {
  const trimmed = rule.trim()
  return trimmed.includes('(') ? trimmed : `Host(\`${trimmed}\`)`
}

export async function createRouter(profileId: string, data: {
  name: string
  rule: string
  service_id: string
  entry_points: string[]
  middlewares: string[]
  priority?: number | null
}) {
  await requireAuth()
  routers.create(profileId, { ...data, rule: normalizeRule(data.rule) })
  revalidatePath('/')
}

export async function updateRouter(id: string, data: {
  name: string
  rule: string
  service_id: string
  entry_points: string[]
  middlewares: string[]
  priority?: number | null
  enabled: boolean
}) {
  await requireAuth()
  routers.update(id, { ...data, rule: normalizeRule(data.rule) })
  revalidatePath('/')
}

export async function deleteRouter(id: string) {
  await requireAuth()
  routers.delete(id)
  revalidatePath('/')
}

export async function deleteRouters(ids: string[]) {
  await requireAuth()
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
  await requireAuth()
  const source = routers.get(id)
  if (!source) throw new Error('Router not found')

  const existingNames = routers.list(profileId).map(r => r.name)
  const cloneName = nextCloneName(existingNames, source.name)

  routers.create(profileId, {
    name: cloneName,
    rule: normalizeRule(source.rule),
    service_id: source.service_id || '',
    entry_points: JSON.parse(source.entry_points),
    middlewares: JSON.parse(source.middlewares),
    priority: source.priority,
    enabled: source.enabled === 1,
  })

  revalidatePath('/')
}

export async function toggleRouter(id: string, enabled: boolean) {
  await requireAuth()
  routers.toggleEnabled(id, enabled)
  revalidatePath('/')
}

export async function setRoutersEnabled(ids: string[], enabled: boolean) {
  await requireAuth()
  for (const id of ids) routers.toggleEnabled(id, enabled)
  revalidatePath('/')
}
