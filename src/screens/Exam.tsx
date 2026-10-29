import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useApp } from '../App'
import { db } from '../lib/db'
import { itemTitle, sortUnits } from '../lib/content'
import { speak } from '../lib/speech'
import type { StudyItem } from '../lib/types'
import { Icon, TopBar } from '../ui'
import CardDeck from './CardDeck'

/** Before the exam: the textbook's official words, phrases, and grammar for a whole unit. */
export default function Exam({ unitId }: { unitId?: string }) {
  const { go, refreshRewards } = useApp()
  const units = useLiveQuery(() => db.units.toArray().then(sortUnits))
  const [drilling, setDrilling] = useState(false)
  const [finished, setFinished] = useState(false)

  if (!units) return null

  if (!unitId) {
    return (
      <div className="stack">
        <TopBar onBack={() => go({ name: 'home' })} title="考前收割 Exam review" />
        {units.map(u => (
          <button key={u.id} className="card row-card" onClick={() => go({ name: 'exam', unitId: u.id })}>
            <Icon name="book" />
            <span className="grow tile-title">{u.data.title} {u.data.titleZh}</span>
            <span className="muted small">{official(u.data.items, u.data.grammar).length} 項</span>
          </button>
        ))}
      </div>
    )
  }

  const unit = units.find(u => u.id === unitId)?.data
  if (!unit) return null
  const list = official(unit.items, unit.grammar)

  return (
    <div className="stack">
      <TopBar onBack={() => go({ name: 'exam' })} title={unit.title} />
      {drilling && !finished ? (
        <CardDeck cards={list.map(item => ({ item, unitId }))} onDone={() => { setFinished(true); refreshRewards() }} />
      ) : (
        <>
          {finished && <div className="feedback right">整個單元複習完了！</div>}
          <button className="btn primary" onClick={() => { setFinished(false); setDrilling(true) }}>
            開始總複習（{list.length} 張）
          </button>
          <div className="card list">
            {list.map(item => (
              <div key={item.id} className="list-row">
                <span className={`kind kind-${item.kind}`}>{item.kind === 'grammar' ? '文法' : item.kind === 'phrase' ? '片語' : '單字'}</span>
                <span className="grow">
                  <span className="tile-title">{itemTitle(item)}</span>
                  <span className="muted small"> {item.zh}</span>
                </span>
                {item.kind !== 'grammar' && (
                  <button className="icon-btn" aria-label="發音" onClick={() => speak(item.text)}><Icon name="volume" size={18} /></button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function official(...groups: StudyItem[][]) {
  return groups.flat().filter(i => i.official)
}
