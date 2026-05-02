'use server'

import { revalidatePath } from 'next/cache'
import { entryPoints } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'

export async function createEntryPoint(profileId: string, name: string, port?: number | null) {
  await requireAuth()
  entryPoints.create(profileId, name, port)
  revalidatePath('/')
}

export async function deleteEntryPoint(id: string) {
  await requireAuth()
  entryPoints.delete(id)
  revalidatePath('/')
}
