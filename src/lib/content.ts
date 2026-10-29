import type { StoredUnit } from './db'
import type { StudyItem, Unit } from './types'

export function itemMap(unit: Unit): Map<string, StudyItem> {
  return new Map<string, StudyItem>([
    ...unit.items.map(i => [i.id, i] as const),
    ...unit.grammar.map(g => [g.id, g] as const),
  ])
}

export function itemTitle(item: StudyItem) {
  return item.kind === 'grammar' ? item.name : item.text
}

/**
 * Whether a mark is highlighted for this student. Grammar and textbook
 * highlights always show; other words only above her level. Everything stays
 * tappable either way.
 */
export function itemMeta(item: StudyItem) {
  if (item.kind === 'grammar') return ''
  return [item.pos, item.level && `Level ${item.level}`].filter(Boolean).join(' · ')
}

export function isHighlighted(item: StudyItem, level: number, known: Set<string>) {
  if (known.has(item.id)) return false
  if (item.kind === 'grammar' || item.official) return true
  return (item.level ?? 6) > level
}

export function sortUnits(units: StoredUnit[]) {
  return [...units].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}

export const LEVELS: Record<number, string> = {
  1: '國小基礎',
  2: '國小高年級',
  3: '國中',
  4: '國中進階',
  5: '高中',
  6: '高中進階',
}
