'use server'

import { revalidatePath } from 'next/cache'
import { middlewares } from '@/lib/db'

export async function createMiddleware(profileId: string, data: {
  name: string
  type: string
  config: Record<string, unknown>
}) {
  middlewares.create(profileId, data)
  revalidatePath('/')
}

export async function updateMiddleware(id: string, data: {
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
}) {
  middlewares.update(id, data)
  revalidatePath('/')
}

export async function deleteMiddleware(id: string) {
  middlewares.delete(id)
  revalidatePath('/')
}

export async function toggleMiddleware(id: string, enabled: boolean) {
  middlewares.toggleEnabled(id, enabled)
  revalidatePath('/')
}
