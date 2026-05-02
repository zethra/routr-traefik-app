'use server'

import { revalidatePath } from 'next/cache'
import { profiles } from '@/lib/db'
import type { ProfileRow } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'

export async function createProfile(name: string): Promise<ProfileRow> {
  await requireAuth()
  const profile = profiles.create(name)
  revalidatePath('/')
  return profile
}

export async function deleteProfile(id: string) {
  await requireAuth()
  profiles.delete(id)
  revalidatePath('/')
}

export async function regenerateToken(id: string): Promise<string> {
  await requireAuth()
  const token = profiles.regenerateToken(id)
  revalidatePath('/')
  return token
}
