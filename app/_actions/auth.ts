'use server'

import { signIn, signOut } from '@/auth'

export async function signInWithOIDC(callbackUrl = '/') {
  await signIn('oidc', { redirectTo: callbackUrl })
}

export async function signOutUser() {
  await signOut({ redirectTo: '/login' })
}
