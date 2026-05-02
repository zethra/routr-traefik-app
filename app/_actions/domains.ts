'use server'

import { revalidatePath } from 'next/cache'
import { domains } from '@/lib/db'
import { requireAuth } from '@/lib/auth-guard'

export async function createDomain(profileId: string, domain: string, certResolver: string) {
  await requireAuth()
  domains.create(profileId, domain, certResolver)
  revalidatePath('/')
}

export async function updateDomain(id: string, domain: string, certResolver: string) {
  await requireAuth()
  domains.update(id, domain, certResolver)
  revalidatePath('/')
}

export async function deleteDomain(id: string) {
  await requireAuth()
  domains.delete(id)
  revalidatePath('/')
}
