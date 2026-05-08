'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/utils'
import { toast } from 'sonner'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(text)
    if (!ok) {
      toast.error('Could not copy to clipboard')
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )
}
