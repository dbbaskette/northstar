import type { BoardCard, CardPriority } from '@/api/boards'

export const PRIORITY_LABELS: Record<CardPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const PRIORITY_COLORS: Record<CardPriority, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#DC2626',
}

export const PRIORITY_ORDER: CardPriority[] = ['low', 'medium', 'high', 'urgent']

// pgtype values come back from Go either as the plain value, an
// older { Valid, String/Time } object, or null. Normalize both shapes.
function flatString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'Valid' in v && (v as { Valid: boolean }).Valid) {
    const obj = v as { String?: string; Time?: string }
    return obj.String ?? obj.Time ?? null
  }
  return null
}

export function cardPriority(card: BoardCard): CardPriority | null {
  const v = flatString(card.priority as unknown)
  if (v && (PRIORITY_ORDER as string[]).includes(v)) return v as CardPriority
  return null
}

export function cardDueDate(card: BoardCard): Date | null {
  const v = flatString(card.due_date as unknown)
  return v ? new Date(v) : null
}

export function cardCompletedAt(card: BoardCard): Date | null {
  const v = flatString(card.completed_at as unknown)
  return v ? new Date(v) : null
}

export function cardDescription(card: { description?: unknown }): string {
  const v = flatString(card.description)
  return v ?? ''
}
