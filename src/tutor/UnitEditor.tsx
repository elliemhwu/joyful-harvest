import { useMemo, useState } from 'react'
import { itemMap, itemTitle, LEVELS } from '../lib/content'
import type { GrammarPoint, LexItem, Level, Paragraph, Question, Unit } from '../lib/types'
import { validateUnit } from '../lib/validate'
import { segments } from '../screens/ReadView'
import { Icon } from '../ui'
import { download, publishUnit } from './api'

type Draft = { unit: Unit; notes: string }
type Tab = 'paragraphs' | 'items' | 'json'

export default function UnitEditor({ draft, onChange, onPublished, onDiscard }: {
  draft: Draft; onChange: (d: Draft) => void; onPublished: () => void; onDiscard: () => void
}) {
  const [tab, setTab] = useState<Tab>('paragraphs')
  const [status, setStatus] = useState('')
  const { unit } = draft
  const warnings = useMemo(() => validateUnit(unit), [unit])

  /** Clone-and-mutate keeps every edit a one-liner. */
  const edit = (fn: (u: Unit) => void) => {
    const next = structuredClone(unit)
    fn(next)
    onChange({ ...draft, unit: next })
  }

  const publish = async () => {
    if (warnings.length && !confirm(`${warnings.length} warning(s) remain. Publish anyway?`)) return
    try {
      const { version } = await publishUnit(unit)
      alert(`Published ${unit.id} v${version}. Phones pick it up the next time they open the app online.`)
      onPublished()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="stack">
      <div className="row wrap">
        <div>
          <input className="input title-input" value={unit.title} aria-label="Title"
            onChange={e => edit(u => { u.title = e.target.value })} />
          <input className="input" value={unit.titleZh ?? ''} placeholder="中文標題" aria-label="Chinese title"
            onChange={e => edit(u => { u.titleZh = e.target.value || undefined })} />
          <div className="muted small">{unit.id} · {unit.paragraphs.length} paragraphs · {unit.items.length} words/phrases · {unit.grammar.length} grammar</div>
        </div>
        <div className="row gap">
          <button className="btn ghost" onClick={onDiscard}>Discard</button>
          <button className="btn" onClick={() => download(`${unit.id}.json`, unit)}><Icon name="upload" size={18} /> Download file</button>
          <button className="btn primary" onClick={publish}>Publish</button>
        </div>
      </div>

      {draft.notes && <div className="banner"><b>Claude's notes:</b> {draft.notes}</div>}
      {status && <div className="banner warn">{status}</div>}
      {warnings.length > 0 && (
        <details className="banner warn">
          <summary>{warnings.length} thing(s) to check</summary>
          <ul>{warnings.map((w, i) => <li key={i}><b>{w.where}</b>: {w.message}</li>)}</ul>
        </details>
      )}

      <div className="tabs">
        {(['paragraphs', 'items', 'json'] as Tab[]).map(t => (
          <button key={t} className={tab === t ? 'tab on' : 'tab'} onClick={() => setTab(t)}>
            {t === 'paragraphs' ? 'Paragraphs' : t === 'items' ? 'Words & grammar' : 'Raw JSON'}
          </button>
        ))}
      </div>

      {tab === 'paragraphs' && unit.paragraphs.map((p, pi) => (
        <ParagraphCard key={p.id} unit={unit} p={p} index={pi} edit={edit} />
      ))}
      {tab === 'paragraphs' && (
        <button className="btn" onClick={() => edit(u => {
          const id = `${u.id}-p${Date.now().toString(36)}`
          u.paragraphs.push({ id, cards: [], sentences: [{ id: `${id}-s1`, text: '', zh: '', marks: [] }], questions: [] })
        })}>+ Add paragraph</button>
      )}
      {tab === 'items' && <ItemsTable unit={unit} edit={edit} />}
      {tab === 'json' && <RawJson unit={unit} onApply={u => onChange({ ...draft, unit: u })} />}
    </div>
  )
}

function ParagraphCard({ unit, p, index, edit }: {
  unit: Unit; p: Paragraph; index: number; edit: (fn: (u: Unit) => void) => void
}) {
  const items = useMemo(() => itemMap(unit), [unit])
  const all = [...unit.items, ...unit.grammar]
  const at = (u: Unit) => u.paragraphs[index]

  return (
    <div className="card stack tight">
      <div className="row">
        <span className="h2">Paragraph {index + 1}</span>
        <span className="row gap">
          <button className="btn small-btn" disabled={index === 0}
            onClick={() => edit(u => { const [x] = u.paragraphs.splice(index, 1); u.paragraphs.splice(index - 1, 0, x) })}>↑</button>
          <button className="btn small-btn" disabled={index === unit.paragraphs.length - 1}
            onClick={() => edit(u => { const [x] = u.paragraphs.splice(index, 1); u.paragraphs.splice(index + 1, 0, x) })}>↓</button>
          <button className="btn small-btn" onClick={() => confirm('Delete this paragraph?') && edit(u => { u.paragraphs.splice(index, 1) })}>Delete</button>
        </span>
      </div>

      <div className="reading preview">
        {p.sentences.map(s => (
          <span key={s.id}>
            {segments(s).map((seg, i) => seg.covering.length
              ? <span key={i} className={seg.covering.map(r => `hl-${items.get(r.ref)?.kind ?? 'missing'}`).join(' ')}
                  title={seg.covering.map(r => items.get(r.ref) ? itemTitle(items.get(r.ref)!) : `missing: ${r.ref}`).join(' / ')}>{seg.text}</span>
              : <span key={i}>{seg.text}</span>)}{' '}
          </span>
        ))}
      </div>

      <details>
        <summary className="tile-title">Sentences and highlights</summary>
        <div className="stack tight">
          {p.sentences.map((s, si) => (
            <div key={s.id} className="sentence-edit">
              <textarea className="input" rows={2} value={s.text}
                onChange={e => edit(u => { at(u).sentences[si].text = e.target.value })} />
              <textarea className="input zh-input" rows={1} value={s.zh} placeholder="中文翻譯"
                onChange={e => edit(u => { at(u).sentences[si].zh = e.target.value })} />
              <div className="chips">
                {(s.marks ?? []).map((m, mi) => (
                  <span key={mi} className={`chip ${s.text.includes(m.text) && items.has(m.ref) ? '' : 'bad'}`}>
                    {m.text} → {items.get(m.ref) ? itemTitle(items.get(m.ref)!) : m.ref}
                    <button aria-label="Remove highlight" onClick={() => edit(u => { at(u).sentences[si].marks!.splice(mi, 1) })}>✕</button>
                  </span>
                ))}
                <AddMark sentence={s.text} options={all} onAdd={(text, ref) => edit(u => {
                  const sen = at(u).sentences[si]
                  sen.marks = [...(sen.marks ?? []), { text, ref }]
                })} />
              </div>
              <button className="link small" onClick={() => edit(u => { at(u).sentences.splice(si, 1) })}>Remove sentence</button>
            </div>
          ))}
          <button className="btn small-btn" onClick={() => edit(u => {
            at(u).sentences.push({ id: `${p.id}-s${Date.now().toString(36)}`, text: '', zh: '', marks: [] })
          })}>+ Add sentence</button>
        </div>
      </details>

      <details>
        <summary className="tile-title">Cards ({p.cards.length})</summary>
        <div className="chips">
          {p.cards.map((c, ci) => (
            <span key={c} className={`chip ${items.has(c) ? '' : 'bad'}`}>
              {items.get(c) ? itemTitle(items.get(c)!) : c}
              <button aria-label="Remove card" onClick={() => edit(u => { at(u).cards.splice(ci, 1) })}>✕</button>
            </span>
          ))}
          <select className="input" value="" onChange={e => { const v = e.target.value; if (v) edit(u => { at(u).cards.push(v) }) }}>
            <option value="">+ Add card</option>
            {all.filter(i => !p.cards.includes(i.id)).map(i => <option key={i.id} value={i.id}>{itemTitle(i)}</option>)}
          </select>
        </div>
      </details>

      <details>
        <summary className="tile-title">Questions ({p.questions?.length ?? 0})</summary>
        <div className="stack tight">
          {(p.questions ?? []).map((q, qi) => (
            <QuestionEdit key={q.id} q={q}
              onChange={fn => edit(u => { fn(at(u).questions![qi]) })}
              onDelete={() => edit(u => { at(u).questions!.splice(qi, 1) })} />
          ))}
          <div className="row gap">
            <button className="btn small-btn" onClick={() => edit(u => {
              (at(u).questions ??= []).push({ id: `${p.id}-q${Date.now().toString(36)}`, type: 'choice', prompt: '', options: ['', '', '', ''], answer: 0 })
            })}>+ Multiple choice</button>
            <button className="btn small-btn" onClick={() => edit(u => {
              (at(u).questions ??= []).push({ id: `${p.id}-q${Date.now().toString(36)}`, type: 'order', prompt: '', chunks: [] })
            })}>+ Sentence order</button>
          </div>
        </div>
      </details>
    </div>
  )
}

function AddMark({ sentence, options, onAdd }: {
  sentence: string; options: (LexItem | GrammarPoint)[]; onAdd: (text: string, ref: string) => void
}) {
  const [text, setText] = useState('')
  const [ref, setRef] = useState('')
  const ok = text && ref && sentence.includes(text)
  return (
    <span className="add-mark">
      <input className="input" value={text} placeholder="text in sentence" onChange={e => setText(e.target.value)} />
      <select className="input" value={ref} onChange={e => setRef(e.target.value)}>
        <option value="">item…</option>
        {options.map(i => <option key={i.id} value={i.id}>{itemTitle(i)}</option>)}
      </select>
      <button className="btn small-btn" disabled={!ok} onClick={() => { onAdd(text, ref); setText(''); setRef('') }}>Add</button>
    </span>
  )
}

function QuestionEdit({ q, onChange, onDelete }: {
  q: Question; onChange: (fn: (q: Question) => void) => void; onDelete: () => void
}) {
  return (
    <div className="question-edit">
      <div className="row gap">
        <span className="kind">{q.type === 'choice' ? 'Choice' : 'Order'}</span>
        <input className="input grow" value={q.prompt} placeholder="Question"
          onChange={e => onChange(x => { x.prompt = e.target.value })} />
        <button className="icon-btn" aria-label="Delete question" onClick={onDelete}>✕</button>
      </div>
      {q.type === 'choice' ? q.options.map((opt, oi) => (
        <label key={oi} className="row gap option-edit">
          <input type="radio" checked={q.answer === oi} onChange={() => onChange(x => { if (x.type === 'choice') x.answer = oi })} />
          <input className="input grow" value={opt} onChange={e => onChange(x => { if (x.type === 'choice') x.options[oi] = e.target.value })} />
        </label>
      )) : (
        <label className="field small">Chunks in the correct order, separated by |
          <input className="input" value={q.chunks.join(' | ')}
            onChange={e => onChange(x => { if (x.type === 'order') x.chunks = e.target.value.split('|').map(c => c.trim()).filter(Boolean) })} />
        </label>
      )}
    </div>
  )
}

function ItemsTable({ unit, edit }: { unit: Unit; edit: (fn: (u: Unit) => void) => void }) {
  const [newText, setNewText] = useState('')
  const addItem = (kind: 'word' | 'phrase' | 'grammar') => {
    const text = newText.trim()
    if (!text) return
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `${kind === 'word' ? 'w' : kind === 'phrase' ? 'p' : 'g'}-${slug}`
    if ([...unit.items, ...unit.grammar].some(i => i.id === id)) return alert(`${id} already exists`)
    edit(u => {
      if (kind === 'grammar') u.grammar.push({ id, kind, name: text, pattern: '', zh: '', examples: [] })
      else u.items.push({ id, kind, text, zh: '', level: 3 })
    })
    setNewText('')
  }

  return (
    <div className="stack">
      <div className="card row gap wrap">
        <input className="input grow" value={newText} placeholder="New word, phrase or grammar pattern" onChange={e => setNewText(e.target.value)} />
        <button className="btn small-btn" onClick={() => addItem('word')}>+ Word</button>
        <button className="btn small-btn" onClick={() => addItem('phrase')}>+ Phrase</button>
        <button className="btn small-btn" onClick={() => addItem('grammar')}>+ Grammar</button>
      </div>

      <div className="card table-wrap">
        <table className="items">
          <thead><tr><th>Official</th><th>Word / phrase</th><th>POS</th><th>中文</th><th>Level</th><th>Example</th><th /></tr></thead>
          <tbody>
            {unit.items.map((it, i) => (
              <tr key={it.id}>
                <td><input type="checkbox" checked={!!it.official} onChange={e => edit(u => { u.items[i].official = e.target.checked || undefined })} /></td>
                <td><input className="input" value={it.text} onChange={e => edit(u => { u.items[i].text = e.target.value })} />
                  <div className="muted tiny">{it.id}</div></td>
                <td><input className="input narrow" value={it.pos ?? ''} onChange={e => edit(u => { u.items[i].pos = e.target.value || undefined })} /></td>
                <td><input className="input" value={it.zh} onChange={e => edit(u => { u.items[i].zh = e.target.value })} /></td>
                <td><select className="input" value={it.level ?? 3} onChange={e => edit(u => { u.items[i].level = Number(e.target.value) as Level })}>
                  {Object.entries(LEVELS).map(([n, label]) => <option key={n} value={n}>{n} {label}</option>)}
                </select></td>
                <td><input className="input" value={it.example ?? ''} onChange={e => edit(u => { u.items[i].example = e.target.value || undefined })} /></td>
                <td><button className="icon-btn" aria-label="Delete" onClick={() => edit(u => { removeItem(u, it.id) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h2">Grammar</div>
      {unit.grammar.map((g, i) => (
        <div key={g.id} className="card stack tight">
          <div className="row gap">
            <label className="row gap small"><input type="checkbox" checked={!!g.official}
              onChange={e => edit(u => { u.grammar[i].official = e.target.checked || undefined })} /> Official</label>
            <input className="input grow" value={g.name} onChange={e => edit(u => { u.grammar[i].name = e.target.value })} />
            <span className="muted tiny">{g.id}</span>
            <button className="icon-btn" aria-label="Delete" onClick={() => edit(u => { removeItem(u, g.id) })}>✕</button>
          </div>
          <input className="input mono" value={g.pattern} placeholder="S + used to + 原形動詞" onChange={e => edit(u => { u.grammar[i].pattern = e.target.value })} />
          <textarea className="input" rows={2} value={g.zh} placeholder="中文說明" onChange={e => edit(u => { u.grammar[i].zh = e.target.value })} />
          <textarea className="input" rows={2} value={(g.examples ?? []).join('\n')} placeholder="Examples, one per line"
            onChange={e => edit(u => { u.grammar[i].examples = e.target.value.split('\n') })} />
        </div>
      ))}
    </div>
  )
}

/** Deleting an item also removes its cards and highlights so nothing dangles. */
function removeItem(u: Unit, id: string) {
  u.items = u.items.filter(i => i.id !== id)
  u.grammar = u.grammar.filter(g => g.id !== id)
  for (const p of u.paragraphs) {
    p.cards = p.cards.filter(c => c !== id)
    for (const s of p.sentences) s.marks = s.marks?.filter(m => m.ref !== id)
  }
}

function RawJson({ unit, onApply }: { unit: Unit; onApply: (u: Unit) => void }) {
  const [text, setText] = useState(() => JSON.stringify(unit, null, 2))
  const [error, setError] = useState('')
  return (
    <div className="stack tight">
      <textarea className="input mono json" value={text} onChange={e => { setText(e.target.value); setError('') }} spellCheck={false} />
      {error && <div className="banner warn">{error}</div>}
      <button className="btn" onClick={() => {
        try {
          const u = JSON.parse(text)
          if (!Array.isArray(u.paragraphs) || !Array.isArray(u.items) || !Array.isArray(u.grammar)) throw new Error('Needs items, grammar and paragraphs')
          onApply({ ...u, id: unit.id })
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }}>Apply JSON</button>
    </div>
  )
}
