import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { signInWithOIDC } from '@/app/_actions/auth'

type LoginPageProps = {
  searchParams: Promise<Record<string, string>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()
  if (session?.user) {
    redirect('/')
  }

  const params = await searchParams
  const callbackUrl = params.callbackUrl || '/'

  const oidcConfigured = Boolean(
    process.env.AUTH_SECRET &&
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-background/80 p-6 shadow-lg">
        <h1 className="text-xl font-semibold tracking-tight">Sign in to Routr</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your OpenID Connect provider (Pocket ID, Authentik, etc.).</p>

        {oidcConfigured ? (
          <form action={signInWithOIDC.bind(null, callbackUrl)} className="mt-5">
            <Button type="submit" className="w-full">Sign in with OIDC</Button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-destructive">
            OIDC is not configured. Set AUTH_SECRET, OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET.
          </p>
        )}
      </div>
    </div>
  )
}
