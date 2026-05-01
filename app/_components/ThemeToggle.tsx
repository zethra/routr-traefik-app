'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

const noopSubscribe = () => () => {}

function useIsHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isHydrated = useIsHydrated()

  if (!isHydrated || !resolvedTheme) return <div className="w-9 h-9" />

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
