'use server'

import { revalidatePath } from 'next/cache'
import { domains } from '@/lib/db'

export async function createDomain(profileId: string, domain: string, certResolver: string) {
  domains.create(profileId, domain, certResolver)
  revalidatePath('/')
}

export async function deleteDomain(id: string) {
  domains.delete(id)
  revalidatePath('/')
}
