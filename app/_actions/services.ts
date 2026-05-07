'use server'

import { services } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-guard'

export async function createService(profileId: string, name: string, endpoints: string[], logo?: string | null, tag?: string | null) {
  await requireAuth()
  services.create(profileId, { name, endpoints, logo, tag })
  revalidatePath('/')
}

export async function updateService(id: string, name: string, endpoints: string[], logo?: string | null, tag?: string | null) {
  await requireAuth()
  try {
    services.update(id, { name, endpoints, logo, tag })
    revalidatePath('/')
  } catch (error) {
    console.error('Failed to update service:', error)
    throw error
  }
}

export async function deleteService(id: string) {
  await requireAuth()
  services.delete(id)
  revalidatePath('/')
}

export async function toggleService(id: string, enabled: boolean) {
  await requireAuth()
  services.toggleEnabled(id, enabled)
  revalidatePath('/')
}
