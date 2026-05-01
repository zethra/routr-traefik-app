'use server'

import { revalidatePath } from 'next/cache'
import { profiles } from '@/lib/db'
import type { ProfileRow } from '@/lib/db'

export async function createProfile(name: string): Promise<ProfileRow> {
  const profile = profiles.create(name)
  revalidatePath('/')
  return profile
}

export async function deleteProfile(id: string) {
  profiles.delete(id)
  revalidatePath('/')
}

export async function regenerateToken(id: string): Promise<string> {
  const token = profiles.regenerateToken(id)
  revalidatePath('/')
  return token
}
