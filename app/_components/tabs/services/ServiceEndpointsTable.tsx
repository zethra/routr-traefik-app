'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Trash2, Edit2, HelpCircle } from 'lucide-react'

type ParsedEndpoint = {
  url: string
  weight: number
}

type Props = {
  endpoints: ParsedEndpoint[]
  onEndpointsChange: (endpoints: ParsedEndpoint[]) => void
  variant?: 'input' | 'display'
}

export function ServiceEndpointsTable({ endpoints, onEndpointsChange, variant = 'input' }: Props) {
  const [newUrl, setNewUrl] = useState('')
  const [newWeight, setNewWeight] = useState('1')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editWeight, setEditWeight] = useState('1')
  const [showAddForm, setShowAddForm] = useState(false)

  if (variant === 'display') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Endpoints ({endpoints.length})</p>
        {endpoints.length === 0 ? (
          <p className="text-xs text-muted-foreground">No endpoints configured</p>
        ) : (
          <div className="rounded border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="h-7 py-1 px-2 text-xs font-bold">Endpoint</TableHead>
                  <TableHead className="h-7 py-1 px-2 text-xs w-14 font-bold text-center">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep, idx) => (
                  <TableRow key={idx} className="h-7 hover:bg-muted/50">
                    <TableCell className="py-1 px-2 font-mono truncate min-w-0">
                      <a
                        href={ep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:underline"
                        title={ep.url}
                      >
                        {ep.url.replace(/^https?:\/\//, '')}
                      </a>
                    </TableCell>
                    <TableCell className="py-1 px-2 w-14 text-center font-bold">{ep.weight}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    )
  }

  const addEndpoint = () => {
    const url = newUrl.trim()
    const weight = parseInt(newWeight) || 1
    if (!url) return
    if (endpoints.some(ep => ep.url === url)) return
    if (weight < 1) return
    onEndpointsChange([...endpoints, { url, weight }])
    setNewUrl('')
    setNewWeight('1')
  }

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditUrl(endpoints[idx].url)
    setEditWeight(String(endpoints[idx].weight))
  }

  const saveEdit = (idx: number) => {
    const url = editUrl.trim()
    const weight = parseInt(editWeight) || 1
    if (!url || weight < 1) return
    if (endpoints.some((ep, i) => i !== idx && ep.url === url)) return
    const updated = [...endpoints]
    updated[idx] = { url, weight }
    onEndpointsChange(updated)
    setEditingIdx(null)
  }

  const removeEndpoint = (idx: number) => {
    onEndpointsChange(endpoints.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 justify-between">
        <div className="flex items-center gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Endpoints ({endpoints.length})</p>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Backend servers to route requests to</TooltipContent>
          </Tooltip>
        </div>
        <Button type="button" size="sm" onClick={() => setShowAddForm(!showAddForm)} className="h-6 px-2 text-xs" title="Add endpoint">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {endpoints.length > 0 && (
        <div className="rounded border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="h-7 py-1 px-2 text-xs font-bold">Endpoint</TableHead>
                <TableHead className="h-7 py-1 px-2 text-xs w-14 font-bold text-center">Priority</TableHead>
                <TableHead className="h-7 py-1 px-2 w-6 text-center" />
                <TableHead className="h-7 py-1 px-2 w-6 text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((ep, idx) => (
                <TableRow key={idx} className="h-7 hover:bg-muted/50">
                  <TableCell className="py-1 px-2 font-mono truncate min-w-0">
                    {editingIdx === idx ? (
                      <Input
                        value={editUrl}
                        onChange={e => setEditUrl(e.target.value)}
                        className="h-5 text-xs px-1 rounded-md"
                        autoFocus
                      />
                    ) : (
                      <a
                        href={ep.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:underline"
                        title={ep.url}
                      >
                        {ep.url.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-2 w-14 text-center">
                    {editingIdx === idx ? (
                      <Input
                        type="number"
                        min="1"
                        value={editWeight}
                        onChange={e => setEditWeight(e.target.value)}
                        className="h-5 text-xs px-1 w-full text-center rounded-md"
                      />
                    ) : (
                      ep.weight
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-1 w-6 text-center">
                    {editingIdx === idx ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEdit(idx)}
                        className="h-5 px-1 text-xs text-green-600 hover:text-green-600"
                      >
                        ✓
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(idx)}
                        className="h-5 px-1 text-xs"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-1 w-6 text-center">
                    {editingIdx === idx ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingIdx(null)}
                        className="h-5 px-1 text-xs text-muted-foreground hover:text-muted-foreground"
                      >
                        ✕
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEndpoint(idx)}
                        className="h-5 px-1 text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {showAddForm && (
        <div className="rounded border p-3 space-y-2 bg-muted/20">
          <div className="text-sm font-semibold">Add Endpoint</div>
          <div className="flex gap-2">
            <Input
              placeholder="http://10.10.100.101:32400"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEndpoint()}
              className="h-8 text-xs flex-1"
              autoFocus
            />
            <Input
              type="number"
              min="1"
              placeholder="p"
              title="Priority (higher = preferred)"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEndpoint()}
              className="h-8 text-xs w-14"
            />
            <Button
              size="sm"
              onClick={() => {
                addEndpoint()
                setNewUrl('')
                setNewWeight('1')
              }}
              disabled={!newUrl.trim()}
              className="h-8 px-2 text-xs"
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(false)}
              className="h-8 px-2 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
