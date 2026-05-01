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

export async function toggleRouter(id: string, enabled: boolean) {
  routers.toggleEnabled(id, enabled)
  revalidatePath('/')
}
