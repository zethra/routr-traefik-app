import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall back to execCommand for insecure contexts or blocked clipboard API.
    }
  }

  if (typeof document === 'undefined') return false

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function formatCreated(value: string): string {
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function parseSqlDate(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`
  return new Date(withZone)
}

export function extractDomain(rule: string): string | null {
  const hostMatch = rule.match(/Host\(['"`]([^'"`]+)['"`]\)/i)
  return hostMatch ? hostMatch[1] : null
}

export function extractHostnames(rule: string): string[] {
  const match = rule.match(/Host\((.*)\)/)
  if (!match) return []
  return Array.from(match[1].matchAll(/`([^`]+)`/g), m => m[1].trim()).filter(Boolean)
}
