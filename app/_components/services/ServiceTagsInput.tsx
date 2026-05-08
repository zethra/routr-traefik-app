'use client'

import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { X } from 'lucide-react'

type Props = {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  label?: string
  variant?: 'input' | 'display'
}

export function ServiceTagsInput({ tags, onTagsChange, label = 'Tags', variant = 'input' }: Props) {
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed])
      setTagInput('')
    }
  }

  const handleRemoveTag = (idx: number) => {
    onTagsChange(tags.filter((_, i) => i !== idx))
  }

  if (variant === 'display') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {tags.map((tag, idx) => (
          <Badge key={idx} className="text-xs">
            {tag}
          </Badge>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex items-center gap-2 flex-wrap">
        {tags.map((tag, idx) => (
          <Badge key={idx} className="text-xs flex items-center gap-1">
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(idx)}
              className="ml-1 hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Popover>
          <PopoverTrigger className="h-6 px-2 rounded border border-input bg-background hover:bg-accent text-sm font-medium inline-flex items-center justify-center cursor-pointer">
            +
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="space-y-2">
              <Input
                placeholder="Enter tag name..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    handleAddTag()
                  }
                }}
                className="h-8 text-xs"
              />
              {tagInput.trim() && (
                <Button
                  size="sm"
                  onClick={handleAddTag}
                  className="w-full text-xs h-7"
                >
                  Add
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
