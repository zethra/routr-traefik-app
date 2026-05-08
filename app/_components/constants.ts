import { Globe, Box, Network, Layers } from 'lucide-react'

export type TabValue = 'domains' | 'entrypoints' | 'middlewares' | 'services'

export const iconMap: Record<TabValue, any> = {
  domains: Globe,
  services: Box,
  entrypoints: Network,
  middlewares: Layers,
}

export const navItems: Array<{ id: TabValue; label: string; icon: any }> = [
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'services', label: 'Services', icon: Box },
  { id: 'entrypoints', label: 'Ingresses', icon: Network },
  { id: 'middlewares', label: 'Middleware', icon: Layers },
]
