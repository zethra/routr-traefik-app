'use client'

import { ServiceRow, RouterRow } from '@/lib/db'
import { parseEndpoints } from '@/lib/serviceUtils'
import { LogoUpload } from './shared/LogoUpload'
import { TagsInput } from './shared/TagsInput'
import { ServiceEndpointsTable } from './ServiceEndpointsTable'
import { ServiceRoutesTable } from './ServiceRoutesTable'

type Props = {
  service: ServiceRow
  routers?: RouterRow[]
  editable?: boolean
  showHeader?: boolean
  canAddRoute?: boolean
  onLogoChange?: (base64: string) => void
  onLogoRemove?: () => void
  onNameChange?: (name: string) => void
  onTagsChange?: (tags: string[]) => void
  onEndpointsChange?: (endpoints: Array<{ url: string; weight: number }>) => void
  onRouteEdit?: (route: RouterRow) => void
  onRouteDelete?: (id: string) => void
}

export function ServiceDetails({
  service,
  routers = [],
  editable = false,
  showHeader = true,
  canAddRoute = true,
  onLogoChange,
  onLogoRemove,
  onNameChange,
  onTagsChange,
  onEndpointsChange,
  onRouteEdit,
  onRouteDelete,
}: Props) {
  const endpoints = parseEndpoints(service.endpoints)
  const tags = service.tag ? service.tag.split(',').map(t => t.trim()).filter(Boolean) : []
  const matchingRouters = routers.filter(r => r.service_id === service.id && r.enabled === 1)

  return (
    <div className="space-y-4">
      {/* Logo + Name */}
      {showHeader && (
        <div className="flex gap-3 items-end">
          {editable ? (
            <LogoUpload
              preview={service.logo || ''}
              onLogoChange={onLogoChange || (() => {})}
              onLogoRemove={onLogoRemove || (() => {})}
            />
          ) : service.logo ? (
            <img
              src={service.logo}
              alt={service.name}
              className="h-12 w-12 rounded object-contain bg-muted flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
          )}
          <div className="flex-1 space-y-1">
            {editable ? (
              <>
                <label htmlFor="service-name" className="text-xs">
                  Name
                </label>
                <input
                  id="service-name"
                  type="text"
                  value={service.name}
                  onChange={(e) => onNameChange?.(e.target.value)}
                  placeholder="e.g. Plex"
                  className="w-full px-2 py-1.5 text-sm rounded border border-input bg-background"
                />
              </>
            ) : (
              <h3 className="font-semibold text-base">{service.name}</h3>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">Tags ({tags.length})</p>
        <TagsInput
          tags={tags}
          onTagsChange={onTagsChange || (() => {})}
          label=""
          variant={editable ? 'input' : 'display'}
        />
      </div>

      {/* Endpoints */}
      <div className="space-y-2">
        <ServiceEndpointsTable
          endpoints={endpoints}
          onEndpointsChange={onEndpointsChange || (() => {})}
          variant={editable ? 'input' : 'display'}
        />
      </div>

      {/* Routes */}
      {matchingRouters.length > 0 || editable ? (
        <div className="space-y-2">
          <ServiceRoutesTable
            routes={matchingRouters}
            onRouteEdit={onRouteEdit}
            onRouteDelete={(id) => onRouteDelete?.(id)}
            variant={editable ? 'input' : 'display'}
            canAddRoute={canAddRoute}
          />
        </div>
      ) : null}
    </div>
  )
}
