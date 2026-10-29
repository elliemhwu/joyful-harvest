import Dexie, { type EntityTable } from 'dexie'
import type { Card } from 'ts-fsrs'
import type { RewardsConfig, Unit } from './types'

// Every record is per-student on this device. When accounts arrive, these
// rows sync up as-is with a studentId attached server-side.

export interface StoredUnit { id: string; version: number; data: Unit; savedAt: number }
export interface CardRow extends Card { itemId: string; unitId: string }
export interface ParagraphRow { id: string; unitId: string; completedAt: number; score?: number; taps?: number }
export interface DayRow { date: string; cards: number; paragraphs: number }
export interface EarnedRow { rewardId: string; earnedAt: number; redeemedAt?: number }
export interface KnownRow { itemId: string }
export interface KvRow { key: string; value: unknown }

export const db = new Dexie('harvest') as Dexie & {
  units: EntityTable<StoredUnit, 'id'>
  cards: EntityTable<CardRow, 'itemId'>
  paragraphs: EntityTable<ParagraphRow, 'id'>
  days: EntityTable<DayRow, 'date'>
  earned: EntityTable<EarnedRow, 'rewardId'>
  known: EntityTable<KnownRow, 'itemId'>
  kv: EntityTable<KvRow, 'key'>
}

db.version(1).stores({
  units: 'id',
  cards: 'itemId, unitId, due',
  paragraphs: 'id, unitId',
  days: 'date',
  earned: 'rewardId',
  known: 'itemId',
  kv: 'key',
})

export interface Settings {
  name: string
  theme: string
  level: number
}

export const DEFAULT_SETTINGS: Settings = { name: '', theme: 'matcha', level: 2 }

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return row ? (row.value as T) : fallback
}

export function setKv(key: string, value: unknown) {
  return db.kv.put({ key, value })
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getKv<Partial<Settings>>('settings', {})) }
}

export async function updateSettings(patch: Partial<Settings>) {
  await setKv('settings', { ...(await getSettings()), ...patch })
}

export function getRewardsConfig() {
  return getKv<RewardsConfig>('rewards', { version: 0, rewards: [] })
}

export function todayKey(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function logActivity(kind: 'cards' | 'paragraphs', amount = 1) {
  const date = todayKey()
  await db.transaction('rw', db.days, async () => {
    const row = (await db.days.get(date)) ?? { date, cards: 0, paragraphs: 0 }
    row[kind] += amount
    await db.days.put(row)
  })
}

// Persistent storage keeps iOS/Android from evicting her packs and progress.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Not supported: data still works, it's just evictable.
  }
}
