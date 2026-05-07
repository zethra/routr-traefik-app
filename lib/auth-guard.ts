import { auth } from '@/auth'

export async function requireAuth() {
  if (process.env.SKIP_AUTH === 'true') {
    return { user: { email: 'dev@localhost', name: 'Developer' } }
  }

  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session
}
