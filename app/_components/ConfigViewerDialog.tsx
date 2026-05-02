'use client'

import { useCallback, useMemo, useState } from 'react'
import YAML from 'yaml'
import { Code2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CopyButton } from './CopyButton'

type Props = {
  profileName: string
  profileToken: string
}

type ConfigData = Record<string, unknown>

export function ConfigViewerDialog({ profileName, profileToken }: Props) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<'json' | 'yaml'>('json')
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<ConfigData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const endpointPath = useMemo(
    () => `/api/${encodeURIComponent(profileName)}?token=${encodeURIComponent(profileToken)}`,
    [profileName, profileToken]
  )

  const renderedConfig = useMemo(() => {
    if (!data) return ''
    if (format === 'yaml') return YAML.stringify(data)
    return JSON.stringify(data, null, 2)
  }, [data, format])

  const fetchConfig = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(endpointPath, { cache: 'no-store' })
      if (!response.ok) {
        setError(`Failed to load config (${response.status})`)
        return
      }

      const json = await response.json() as ConfigData
      setData(json)
    } catch {
      setError('Failed to load configuration output')
    } finally {
      setIsLoading(false)
    }
  }, [endpointPath])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      void fetchConfig()
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleOpenChange(true)}
        className="h-9 rounded-xl border border-border/70 bg-background/70"
      >
        <Code2 className="h-3.5 w-3.5" />
        Config
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-5xl sm:max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="p-4 pb-3 border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Config Output</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1 break-all">{endpointPath}</p>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={endpointPath} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchConfig()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4 pt-3">
            <div className="inline-flex items-center rounded-lg border border-border p-1 bg-muted/40">
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${format === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => setFormat('yaml')}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${format === 'yaml' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                YAML
              </button>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !data ? (
              <p className="text-sm text-muted-foreground">{isLoading ? 'Loading configuration…' : 'No configuration loaded.'}</p>
            ) : (
              <pre className="h-[52vh] min-h-0 overflow-auto rounded-lg border border-border/70 bg-background/70 p-3 text-[12px] leading-relaxed whitespace-pre">
                {renderedConfig}
              </pre>
            )}
          </div>

          <DialogFooter className="-mx-0 -mb-0 rounded-none border-t px-4 py-3">
            <CopyButton text={renderedConfig} />
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
