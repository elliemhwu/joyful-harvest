import type { PackManifest, RewardsConfig, Unit } from '../lib/types'

const BASE = import.meta.env.BASE_URL

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `${res.status}`)
  return data as T
}

const post = <T>(path: string, body: unknown) =>
  call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function status() {
  return call<{ ready: boolean; mock: boolean }>('api/tutor/status')
}

export type FileRole = 'textbook' | 'vocabulary' | 'handbook'
export interface UploadFile { name: string; role: FileRole; mediaType: string; data: string }

export function extract(req: { unitId: string; title: string; level: number; notes: string; files: UploadFile[] }) {
  return post<{ unit: Unit; notes: string }>('api/tutor/extract', req)
}

export function publishUnit(unit: Unit) {
  return post<{ version: number }>('api/tutor/publish', { unit })
}

export function publishRewards(rewards: RewardsConfig) {
  return post<{ version: number }>('api/tutor/publish', { rewards })
}

export async function loadPublished() {
  const index = await call<PackManifest>('packs/index.json')
  const units = await Promise.all(index.units.map(u => call<Unit>(u.url)))
  const rewards = index.rewards ? await call<RewardsConfig>(index.rewards.url) : { version: 0, rewards: [] }
  return { units, rewards }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Lets the tutor AirDrop / LINE a unit or rewards file for offline import. */
export function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

const DRAFT_KEY = 'harvest-tutor-draft'

export function saveDraft(draft: { unit: Unit; notes: string } | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Drafts are a convenience; editing still works without storage.
  }
}

export function loadDraft(): { unit: Unit; notes: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
