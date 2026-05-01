'use server'

import { revalidatePath } from 'next/cache'
import { certResolvers } from '@/lib/db'

export async function createCertResolver(name: string) {
  certResolvers.create(name)
  revalidatePath('/')
}

export async function deleteCertResolver(id: string) {
  certResolvers.delete(id)
  revalidatePath('/')
}
