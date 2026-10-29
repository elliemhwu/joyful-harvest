import { db, getRewardsConfig, setKv } from './db'
import type { PackManifest, RewardsConfig, Unit } from './types'

// For now the "backend" is static JSON next to the app (public/packs,
// public/config). Swapping in a real server later only changes BASE.
const BASE = import.meta.env.BASE_URL

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json() as Promise<T>
}

export interface SyncResult { units: string[]; rewards: boolean }

/** Downloads any new or updated units and the reward config. */
export async function syncFromServer(): Promise<SyncResult> {
  const manifest = await fetchJson<PackManifest>('packs/index.json')
  const result: SyncResult = { units: [], rewards: false }

  for (const entry of manifest.units) {
    const stored = await db.units.get(entry.id)
    if (stored && stored.version >= entry.version) continue
    await saveUnit(await fetchJson<Unit>(entry.url))
    result.units.push(entry.title)
  }

  if (manifest.rewards && manifest.rewards.version > (await getRewardsConfig()).version) {
    await setKv('rewards', await fetchJson<RewardsConfig>(manifest.rewards.url))
    result.rewards = true
  }
  return result
}

function saveUnit(unit: Unit) {
  return db.units.put({ id: unit.id, version: unit.version, data: unit, savedAt: Date.now() })
}

/** Offline route: a unit or rewards file sent by AirDrop / Quick Share / LINE. */
export async function importFile(file: File): Promise<string> {
  const json = JSON.parse(await file.text())
  if (Array.isArray(json.paragraphs)) {
    await saveUnit(json as Unit)
    return `已匯入單元：${json.title}`
  }
  if (Array.isArray(json.rewards)) {
    await setKv('rewards', json as RewardsConfig)
    return '已更新獎勵設定'
  }
  throw new Error('這不是 Joyful Harvest 的檔案')
}

export function isOnline() {
  return navigator.onLine
}
