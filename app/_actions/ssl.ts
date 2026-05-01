'use server'

import tls from 'tls'

export type SSLResult = {
  valid: boolean
  daysLeft: number | null
  issuer: string | null
  error?: string
}

function probeTLS(host: string, servername: string, port: number): Promise<SSLResult> {
  return new Promise((resolve) => {
    let settled = false
    let socket: tls.TLSSocket | null = null

    const settle = (result: SSLResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      socket?.destroy()
      settle({ valid: false, daysLeft: null, issuer: null, error: 'Timeout' })
    }, 5000)

    socket = tls.connect(
      { host, port, servername, rejectUnauthorized: false },
      () => {
        const cert = socket!.getPeerCertificate()
        const authorized = socket!.authorized
        socket!.destroy()

        if (!cert?.valid_to) {
          settle({ valid: false, daysLeft: null, issuer: null, error: 'No certificate' })
          return
        }

        const expiry = new Date(cert.valid_to)
        const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        settle({
          valid: authorized && daysLeft > 0,
          daysLeft,
          issuer: (Array.isArray(cert.issuer?.O) ? cert.issuer.O[0] : cert.issuer?.O) ?? null,
        })
      }
    )

    socket.on('error', (err) => {
      settle({ valid: false, daysLeft: null, issuer: null, error: err.message })
    })
  })
}

export async function checkSSL(hostname: string): Promise<SSLResult> {
  const port = Number(process.env.SSL_CHECK_PORT ?? '443') || 443
  const internalHost = process.env.SSL_CHECK_INTERNAL_HOST?.trim()

  // First try external hostname. If unreachable in Docker/hairpin setups, fall back to internal Traefik host.
  const primary = await probeTLS(hostname, hostname, port)
  if (primary.valid || !internalHost) return primary

  const fallback = await probeTLS(internalHost, hostname, port)
  if (fallback.valid) return fallback

  return {
    ...primary,
    error: [primary.error, `fallback(${internalHost}): ${fallback.error ?? 'unknown'}`]
      .filter(Boolean)
      .join(' | '),
  }
}
