'use server'

import { revalidatePath } from 'next/cache'
import { certResolvers } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'

export async function createCertResolver(name: string) {
  await requireAuth()
  certResolvers.create(name)
  revalidatePath('/')
}

export async function deleteCertResolver(id: string) {
  await requireAuth()
  certResolvers.delete(id)
  revalidatePath('/')
}
