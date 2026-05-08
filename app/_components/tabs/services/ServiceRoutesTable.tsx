'use client'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Edit2, Check, Plus } from 'lucide-react'
import { RouterRow } from '@/lib/db'
import { extractDomain } from '@/lib/utils'

type Props = {
  routes: RouterRow[]
  onRouteDelete?: (id: string) => void
  onRouteEdit?: (route: RouterRow) => void
  variant?: 'input' | 'display'
  canAddRoute?: boolean
}

export function ServiceRoutesTable({ routes, onRouteDelete, onRouteEdit, variant = 'input', canAddRoute = true }: Props) {
  if (variant === 'display') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Routes ({routes.length})</p>
        {routes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No routes configured</p>
        ) : (
          <div className="rounded border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="h-7 py-1 px-2 text-xs font-bold">Domain</TableHead>
                  <TableHead className="h-7 py-1 px-2 text-xs w-14 font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map(route => {
                  const domain = extractDomain(route.rule)
                  return (
                    <TableRow key={route.id} className="h-7 hover:bg-muted/50">
                      <TableCell className="py-1 px-2 font-mono text-xs truncate min-w-0">
                        <a
                          href={`https://${domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:underline"
                          title={domain || ''}
                        >
                          {domain || 'N/A'}
                        </a>
                      </TableCell>
                      <TableCell className="py-1 px-2 w-14 flex justify-end items-center">
                        {route.enabled === 1 && (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400 mr-2.5" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Routes ({routes.length})</p>
        <Button type="button" size="sm" onClick={() => onRouteEdit?.(undefined as any)} className="h-6 px-2 text-xs" title={canAddRoute ? "Add route" : "Create service first"} disabled={!canAddRoute}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {routes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No routes configured</p>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="rounded border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="h-7 py-1 px-2 text-xs font-bold">Domain</TableHead>
                  <TableHead className="h-7 py-1 px-2 text-xs w-14 font-bold text-center">Status</TableHead>
                  <TableHead className="h-7 py-1 px-2 w-6 text-center" />
                  <TableHead className="h-7 py-1 px-2 w-6 text-center" />
                </TableRow>
              </TableHeader>
            <TableBody>
              {routes.map(route => {
                const domain = extractDomain(route.rule)
                return (
                  <TableRow key={route.id} className="h-7">
                    <TableCell className="py-1 px-2 font-mono text-xs truncate min-w-0">
                      <a
                        href={`https://${domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:underline"
                        title={domain || ''}
                      >
                        {domain || 'N/A'}
                      </a>
                    </TableCell>
                    <TableCell className="py-1 px-2 w-14 flex justify-end items-center">
                      {route.enabled === 1 && (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mr-3" />
                      )}
                    </TableCell>
                    <TableCell className="py-1 px-1 w-6 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRouteEdit?.(route)}
                        className="h-5 px-1 text-xs"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                    <TableCell className="py-1 px-1 w-6 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRouteDelete?.(route.id)}
                        className="h-5 px-1 text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
