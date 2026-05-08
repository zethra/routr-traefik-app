'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ServiceRow, RouterRow } from '@/lib/db'
import { extractDomain } from '@/lib/utils'
import { deleteService, toggleService } from '@/app/_actions/services'
import { toast } from 'sonner'
import { MoreHorizontal, ChevronDown } from 'lucide-react'
import { ServiceHealthStatus, ServiceHealthStatusData } from './ServiceHealthStatus'
import { ServiceDetails } from './ServiceDetails'

type Props = {
  service: ServiceRow
  routers: RouterRow[]
  status?: ServiceHealthStatusData
  onEdit: (service: ServiceRow) => void
}

export function ServiceCard({
  service,
  routers,
  status,
  onEdit,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [isExpanded, setIsExpanded] = useState(false)

  const matchingRouters = routers.filter(r => r.service_id === service.id && r.enabled === 1)

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove service "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteService(id)
        toast.success('Service removed')
      } catch {
        toast.error('Failed to remove service')
      }
    })
  }

  function handleToggle(id: string, enabled: number) {
    startTransition(async () => {
      try {
        await toggleService(id, enabled === 0)
      } catch {
        toast.error('Failed to update service')
      }
    })
  }

  return (
    <Card className={`flex flex-col border-0 bg-muted/30 ${service.enabled === 0 ? 'opacity-50' : ''}`}>
      {/* Compact Header */}
      <CardHeader className="py-1 px-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center justify-center h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          {service.logo ? (
            <img
              src={service.logo}
              alt={service.name}
              className="h-8 w-8 rounded object-contain flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
          )}
          <h3 className="font-semibold text-sm truncate">{service.name}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {matchingRouters.length > 0 && (
            <a
              href={`https://${extractDomain(matchingRouters[0].rule)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-white hover:bg-white/20 transition-colors"
              title="Visit service"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={`Actions for ${service.name}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(service)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToggle(service.id, service.enabled)}
                disabled={isPending}
              >
                {service.enabled === 1 ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => handleDelete(service.id, service.name)}
                disabled={isPending}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* Health Status - Always visible */}
      <div className="px-4 pt-1 pb-0">
        <ServiceHealthStatus status={status} />
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <CardContent className="space-y-3 pt-2 pb-2 border-t border-border/50">
          <ServiceDetails
            service={service}
            routers={routers}
            editable={false}
            showHeader={false}
            onRouteEdit={() => onEdit(service)}
          />
        </CardContent>
      )}
    </Card>
  )
}
