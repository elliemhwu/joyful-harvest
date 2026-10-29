import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../App'
import { db } from '../lib/db'
import { isHighlighted, itemMap, itemMeta, itemTitle } from '../lib/content'
import { speak } from '../lib/speech'
import type { Paragraph, Sentence, StudyItem, Unit } from '../lib/types'
import { Icon } from '../ui'

interface Range { start: number; end: number; ref: string }

function findRanges(s: Sentence): Range[] {
  const out: Range[] = []
  for (const m of s.marks ?? []) {
    let idx = -1
    for (let n = 0; n < (m.nth ?? 1); n++) idx = s.text.indexOf(m.text, idx + 1)
    if (idx >= 0) out.push({ start: idx, end: idx + m.text.length, ref: m.ref })
  }
  return out
}

/** Splits a sentence at every mark boundary so nested marks (a word inside a grammar pattern) both render. */
export function segments(s: Sentence) {
  const ranges = findRanges(s)
  const cuts = [...new Set([0, s.text.length, ...ranges.flatMap(r => [r.start, r.end])])].sort((a, b) => a - b)
  return cuts.slice(0, -1).map((a, i) => {
    const b = cuts[i + 1]
    const covering = ranges.filter(r => r.start <= a && r.end >= b)
      .sort((x, y) => (x.end - x.start) - (y.end - y.start))
    return { text: s.text.slice(a, b), covering }
  })
}

export default function ReadView({ unit, paragraph, onDone }: {
  unit: Unit; paragraph: Paragraph; onDone: (taps: number) => void
}) {
  const { settings } = useApp()
  const items = useMemo(() => itemMap(unit), [unit])
  const known = useLiveQuery(() => db.known.toArray().then(r => new Set(r.map(k => k.itemId))), [], new Set<string>())
  const [selected, setSelected] = useState<{ item: StudyItem; sentenceId: string } | null>(null)
  const [showZh, setShowZh] = useState<Set<string>>(new Set())
  const [allZh, setAllZh] = useState(false)
  const [taps, setTaps] = useState(0)

  const toggleZh = (id: string) => setShowZh(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const toggleKnown = async (id: string) => {
    if (known.has(id)) await db.known.delete(id)
    else await db.known.put({ itemId: id })
  }

  return (
    <div className="stack">
      <div className="h2">先自己試著讀讀看</div>
      <div className="legend">
        <span><span className="hl-word">word</span></span>
        <span><span className="hl-phrase">phrase</span></span>
        <span><span className="hl-grammar">grammar</span></span>
        <span className="muted">不確定的地方就點一下</span>
      </div>

      <div className={`card reading ${allZh ? 'with-zh' : ''}`}>
        {paragraph.sentences.map(s => (
          <span key={s.id} className="sentence">
            {segments(s).map((seg, i) => {
              if (!seg.covering.length) return <span key={i}>{seg.text}</span>
              const cls = seg.covering.map(r => {
                const item = items.get(r.ref)
                return item && isHighlighted(item, settings.level, known) ? `hl-${item.kind}` : 'hl-quiet'
              }).join(' ')
              const active = selected && seg.covering.some(r => r.ref === selected.item.id)
              return (
                <span key={i} role="button" tabIndex={0} className={`${cls}${active ? ' hl-active' : ''}`}
                  onClick={() => {
                    const item = items.get(seg.covering[0].ref)
                    if (!item) return
                    setSelected({ item, sentenceId: s.id })
                    setTaps(t => t + 1)
                  }}>
                  {seg.text}
                </span>
              )
            })}
            {(allZh || showZh.has(s.id)) && <span className="zh-line">{s.zh}</span>}
            {' '}
          </span>
        ))}
      </div>

      {selected && (
        <div className="card popup">
          <div className="row">
            <span className="h2">{itemTitle(selected.item)}</span>
            <button className="icon-btn" aria-label="發音"
              onClick={() => speak(selected.item.kind === 'grammar' ? selected.item.examples?.[0] ?? '' : selected.item.text)}>
              <Icon name="volume" />
            </button>
          </div>
          {selected.item.kind === 'grammar' ? (
            <>
              <div className="pattern">{selected.item.pattern}</div>
              <div>{selected.item.zh}</div>
              {selected.item.examples?.map(ex => <div key={ex} className="example">{ex}</div>)}
            </>
          ) : (
            <>
              <div className="muted small">{itemMeta(selected.item)}</div>
              <div className="zh">{selected.item.zh}</div>
            </>
          )}
          <div className="row gap">
            <button className="btn small-btn" onClick={() => toggleZh(selected.sentenceId)}>
              {showZh.has(selected.sentenceId) ? '隱藏整句中文' : '看整句中文'}
            </button>
            <button className="btn small-btn" onClick={() => toggleKnown(selected.item.id)}>
              {known.has(selected.item.id) ? <><Icon name="check" size={16} /> 我會了</> : '我會這個'}
            </button>
          </div>
        </div>
      )}

      <div className="row gap">
        <button className="btn ghost grow" onClick={() => speak(paragraph.sentences.map(s => s.text).join(' '), 0.85)}>
          <Icon name="volume" /> 聽整段
        </button>
        <button className="btn ghost grow" onClick={() => setAllZh(v => !v)}>{allZh ? '隱藏中文' : '全部中文'}</button>
      </div>
      <button className="btn primary" onClick={() => onDone(taps)}>我讀完了 I'm done reading</button>
    </div>
  )
}
