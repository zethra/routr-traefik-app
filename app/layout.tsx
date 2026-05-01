import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from './_components/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Routr',
  description: 'Traefik dynamic config GUI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <ThemeProvider>
            {children}
            <Toaster richColors />
          </ThemeProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
