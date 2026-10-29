import { useEffect, useState } from 'react'
import type { RewardsConfig, Unit } from '../lib/types'
import { Icon } from '../ui'
import { loadDraft, loadPublished, saveDraft, status } from './api'
import Import from './Import'
import RewardsEditor from './RewardsEditor'
import UnitEditor from './UnitEditor'
import './tutor.css'

type View = { name: 'home' } | { name: 'import' } | { name: 'edit' } | { name: 'rewards' }

/** Tutor mode: runs on the tutor's computer with the local server (npm run tutor). */
export default function TutorApp() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [server, setServer] = useState<{ ready: boolean; mock: boolean } | 'offline' | null>(null)
  const [published, setPublished] = useState<{ units: Unit[]; rewards: RewardsConfig } | null>(null)
  const [draft, setDraft] = useState(loadDraft)

  const refresh = () => loadPublished().then(setPublished).catch(() => setPublished({ units: [], rewards: { version: 0, rewards: [] } }))

  useEffect(() => {
    document.title = 'Tutor · Joyful Harvest'
    status().then(setServer).catch(() => setServer('offline'))
    refresh()
  }, [])

  const updateDraft = (d: { unit: Unit; notes: string } | null) => { setDraft(d); saveDraft(d) }

  if (server === 'offline') {
    return (
      <div className="tutor">
        <h1 className="title">Tutor mode</h1>
        <div className="card">
          <p>Tutor mode runs on your computer. In the project folder, run:</p>
          <pre className="code">npm run tutor</pre>
          <p className="muted small">Then open the address it prints, followed by <code>/#tutor</code>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tutor">
      <header className="tutor-head">
        <button className="link" onClick={() => setView({ name: 'home' })}>
          <span className="tutor-logo"><Icon name="sprout" size={18} /></span> Joyful Harvest · Tutor
        </button>
        <a className="link muted small" href="./">Open student app</a>
      </header>

      {server && !server.ready && (
        <div className="banner warn">
          No API key yet. Add <code>ANTHROPIC_API_KEY=…</code> to a <code>.env</code> file in the project folder and restart
          {' '}<code>npm run tutor</code>. You can still edit units and rewards by hand.
        </div>
      )}
      {server?.mock && <div className="banner">Mock mode: extraction returns the sample unit instead of calling Claude.</div>}

      {view.name === 'home' && (
        <div className="stack">
          <div className="row">
            <h1 className="title">Units</h1>
            <div className="row gap">
              <button className="btn" onClick={() => setView({ name: 'rewards' })}><Icon name="gift" size={18} /> Rewards</button>
              <button className="btn primary" onClick={() => setView({ name: 'import' })}><Icon name="upload" size={18} /> New unit from scans</button>
            </div>
          </div>

          {draft && (
            <button className="card row-card" onClick={() => setView({ name: 'edit' })}>
              <Icon name="flag" />
              <span className="grow"><span className="tile-title">Unpublished draft: {draft.unit.title}</span>
                <span className="muted small"> · {draft.unit.paragraphs.length} paragraphs</span></span>
              <span className="muted small">Continue editing →</span>
            </button>
          )}

          {published?.units.map(u => (
            <div key={u.id} className="card row-card">
              <Icon name="book" />
              <span className="grow">
                <span className="tile-title">{u.title} {u.titleZh}</span>
                <span className="muted small"> · {u.id} · v{u.version} · {u.paragraphs.length} paragraphs · {u.items.length + u.grammar.length} items</span>
              </span>
              <button className="btn small-btn" onClick={() => {
                if (draft && !confirm('Replace the unpublished draft with this unit?')) return
                updateDraft({ unit: u, notes: '' })
                setView({ name: 'edit' })
              }}>Edit</button>
            </div>
          ))}
          {published?.units.length === 0 && <div className="muted">No units published yet.</div>}
        </div>
      )}

      {view.name === 'import' && (
        <Import existingIds={published?.units.map(u => u.id) ?? []}
          onDone={d => {
            if (draft && !confirm('Replace the unpublished draft with the new extraction?')) return
            updateDraft(d)
            setView({ name: 'edit' })
          }} />
      )}

      {view.name === 'edit' && draft && (
        <UnitEditor draft={draft} onChange={updateDraft}
          onPublished={() => { updateDraft(null); refresh(); setView({ name: 'home' }) }}
          onDiscard={() => { if (confirm('Discard this draft?')) { updateDraft(null); setView({ name: 'home' }) } }} />
      )}

      {view.name === 'rewards' && published && (
        <RewardsEditor config={published.rewards} units={published.units} onPublished={refresh} />
      )}
    </div>
  )
}
