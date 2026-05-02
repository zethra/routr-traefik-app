import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'

const oidcConfigured = Boolean(
  process.env.OIDC_ISSUER &&
  process.env.OIDC_CLIENT_ID &&
  process.env.OIDC_CLIENT_SECRET
)

const providers: NextAuthConfig['providers'] = oidcConfigured
  ? [{
      id: 'oidc',
      name: 'OIDC',
      type: 'oidc',
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      authorization: { params: { scope: 'openid profile email groups' } },
    }]
  : []

export const authConfig: NextAuthConfig = {
  providers,
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
