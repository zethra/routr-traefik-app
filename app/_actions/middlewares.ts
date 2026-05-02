'use server'

import { revalidatePath } from 'next/cache'
import { middlewares } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'

export async function createMiddleware(profileId: string, data: {
  name: string
  type: string
  config: Record<string, unknown>
}) {
  await requireAuth()
  middlewares.create(profileId, data)
  revalidatePath('/')
}

export async function updateMiddleware(id: string, data: {
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
}) {
  await requireAuth()
  middlewares.update(id, data)
  revalidatePath('/')
}

export async function deleteMiddleware(id: string) {
  await requireAuth()
  middlewares.delete(id)
  revalidatePath('/')
}

export async function toggleMiddleware(id: string, enabled: boolean) {
  await requireAuth()
  middlewares.toggleEnabled(id, enabled)
  revalidatePath('/')
}
