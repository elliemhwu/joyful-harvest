import { useEffect, useState } from 'react'
import { LEVELS } from '../lib/content'
import type { Unit } from '../lib/types'
import { Icon } from '../ui'
import { extract, fileToBase64, type FileRole } from './api'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const ROLES: { id: FileRole; label: string }[] = [
  { id: 'textbook', label: 'Textbook / magazine' },
  { id: 'vocabulary', label: 'Unit vocabulary list' },
  { id: 'handbook', label: 'Vocabulary handbook' },
]

export default function Import({ existingIds, onDone }: {
  existingIds: string[]; onDone: (d: { unit: Unit; notes: string }) => void
}) {
  const [files, setFiles] = useState<{ file: File; role: FileRole }[]>([])
  const [unitId, setUnitId] = useState('')
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState(2)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startedAt])

  const addFiles = (list: FileList | null, role: FileRole) => {
    if (!list) return
    setFiles(f => [...f, ...[...list].map(file => ({ file, role }))])
  }

  const run = async () => {
    setError('')
    if (!/^[a-z0-9][a-z0-9-]*$/.test(unitId)) return setError('Unit id: lowercase letters, numbers and dashes (e.g. b3-unit-2)')
    if (!files.length) return setError('Add at least one scan or PDF')
    if (existingIds.includes(unitId) && !confirm(`${unitId} already exists. Publishing will replace it. Continue?`)) return
    setStartedAt(Date.now())
    setElapsed(0)
    try {
      const uploads = await Promise.all(files.map(async f => ({
        name: f.file.name, role: f.role, mediaType: f.file.type, data: await fileToBase64(f.file),
      })))
      onDone(await extract({ unitId, title, level, notes, files: uploads }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStartedAt(null)
    }
  }

  const busy = startedAt !== null
  const totalMb = files.reduce((n, f) => n + f.file.size, 0) / 1024 / 1024

  return (
    <div className="stack">
      <h1 className="title">New unit from scans</h1>

      <div className="card stack tight">
        <span className="tile-title">1. Add pages</span>
        <span className="muted small">PDFs or photos. Tell Claude what each file is — vocabulary lists and handbook pages decide what counts as official.</span>
        <div className="row gap wrap">
          {ROLES.map(r => (
            <label key={r.id} className="btn">
              <Icon name="upload" size={18} /> {r.label}
              <input type="file" accept={ACCEPT} multiple hidden disabled={busy}
                onChange={e => { addFiles(e.target.files, r.id); e.target.value = '' }} />
            </label>
          ))}
        </div>
        {files.length > 0 && (
          <div className="list">
            {files.map((f, i) => (
              <div key={i} className="list-row">
                <span className="grow">{f.file.name} <span className="muted small">{(f.file.size / 1024 / 1024).toFixed(1)} MB</span></span>
                <select className="input" value={f.role} disabled={busy}
                  onChange={e => setFiles(list => list.map((x, j) => j === i ? { ...x, role: e.target.value as FileRole } : x))}>
                  {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <button className="icon-btn" aria-label="Remove" disabled={busy}
                  onClick={() => setFiles(list => list.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className="muted small">{totalMb.toFixed(1)} MB total (max 60 MB)</div>
          </div>
        )}
      </div>

      <div className="card stack tight">
        <span className="tile-title">2. About this unit</span>
        <div className="grid2">
          <label className="field">Unit id<input className="input" value={unitId} placeholder="b3-unit-2" disabled={busy}
            onChange={e => setUnitId(e.target.value.toLowerCase())} /></label>
          <label className="field">Title (optional)<input className="input" value={title} placeholder="from the scan" disabled={busy}
            onChange={e => setTitle(e.target.value)} /></label>
        </div>
        <label className="field">
          <span className="row"><span>Student level</span><span className="muted small">Level {level} · {LEVELS[level]}</span></span>
          <input type="range" min={1} max={6} step={1} value={level} disabled={busy} onChange={e => setLevel(Number(e.target.value))} />
          <span className="muted small">Words above this level get cards and highlights. Official items are always included.</span>
        </label>
        <label className="field">Notes for Claude (optional)
          <textarea className="input" rows={2} value={notes} disabled={busy}
            placeholder="e.g. Skip the exercises on page 3. Focus on the reading passage."
            onChange={e => setNotes(e.target.value)} /></label>
      </div>

      {error && <div className="banner warn">{error}</div>}
      <button className="btn primary" onClick={run} disabled={busy}>
        {busy ? `Claude is reading the pages… ${elapsed}s` : 'Organize with Claude'}
      </button>
      {busy && <div className="muted small center">A full unit usually takes 1–4 minutes. Keep this tab open.</div>}
    </div>
  )
}
