'use client'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  preview: string
  onLogoChange: (base64: string) => void
  onLogoRemove: () => void
  disabled?: boolean
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ServiceLogoUpload({ preview, onLogoChange, onLogoRemove, disabled }: Props) {
  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      toast.error('Image must be less than 500KB')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image')
      return
    }
    try {
      const base64 = await fileToBase64(file)
      onLogoChange(base64)
    } catch {
      toast.error('Failed to upload image')
    }
  }

  if (preview) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-0 h-12 w-12 flex items-center justify-center rounded hover:bg-muted transition-colors">
            <img
              src={preview}
              alt="Logo"
              className="h-12 w-12 rounded object-contain pointer-events-none"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => document.getElementById('logo-input')?.click()}
              disabled={disabled}
            >
              <Upload className="h-3.5 w-3.5 mr-2" />
              Change
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onLogoRemove}
              disabled={disabled}
              className="text-destructive"
            >
              <X className="h-3.5 w-3.5 mr-2" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          id="logo-input"
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          disabled={disabled}
          className="hidden"
        />
      </>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-12 w-12 p-0 border-dashed"
            onClick={() => document.getElementById('logo-input')?.click()}
          >
            <Upload className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add logo</TooltipContent>
      </Tooltip>
      <input
        id="logo-input"
        type="file"
        accept="image/*"
        onChange={handleLogoChange}
        disabled={disabled}
        className="hidden"
      />
    </TooltipProvider>
  )
}
