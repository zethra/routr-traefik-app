'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ProfileDialog } from './ProfileDialog'
import { SettingsDialog } from './SettingsDialog'
import { Plus, Settings } from 'lucide-react'
import type { ProfileWithStats } from '@/lib/db'

type Props = {
  profiles: ProfileWithStats[]
  currentProfile: string
}

const NEW_PROFILE_SENTINEL = '__new__'

export function ProfileSwitcher({ profiles, currentProfile }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function handleChange(value: string | null) {
    if (!value) return
    if (value === NEW_PROFILE_SENTINEL) {
      setCreateOpen(true)
      return
    }
    startTransition(() => {
      router.push(`/?profile=${encodeURIComponent(value)}`)
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Select value={currentProfile} onValueChange={handleChange}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.name} className="text-xs">{p.name}</SelectItem>
            ))}
            <SelectItem value={NEW_PROFILE_SENTINEL} className="text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Plus className="h-3 w-3" />
                New profile
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <ProfileDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={name => {
          setCreateOpen(false)
          router.push(`/?profile=${encodeURIComponent(name)}`)
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profiles={profiles}
        currentProfile={currentProfile}
      />
    </>
  )
}
