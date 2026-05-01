'use server'

import { revalidatePath } from 'next/cache'
import { entryPoints } from '@/lib/db'

export async function createEntryPoint(profileId: string, name: string, port?: number | null) {
  entryPoints.create(profileId, name, port)
  revalidatePath('/')
}

export async function deleteEntryPoint(id: string) {
  entryPoints.delete(id)
  revalidatePath('/')
}
