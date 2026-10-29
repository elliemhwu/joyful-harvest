import { useState } from 'react'
import type { Grade } from 'ts-fsrs'
import { itemMeta, itemTitle } from '../lib/content'
import { speak } from '../lib/speech'
import { rate, Rating } from '../lib/srs'
import type { StudyItem } from '../lib/types'
import { Bar, Icon } from '../ui'

export interface DeckCard { item: StudyItem; unitId: string }

const GRADES: { grade: Grade; label: string; sub: string }[] = [
  { grade: Rating.Again, label: '再一次', sub: 'Again' },
  { grade: Rating.Hard, label: '有點難', sub: 'Hard' },
  { grade: Rating.Good, label: '記得', sub: 'Good' },
  { grade: Rating.Easy, label: '太簡單', sub: 'Easy' },
]

/** Flashcards with spaced repetition. "Again" cards come back in this session. */
export default function CardDeck({ cards, onDone }: { cards: DeckCard[]; onDone: () => void }) {
  const [queue, setQueue] = useState(cards)
  const [flipped, setFlipped] = useState(false)
  const [finished, setFinished] = useState(0)
  const current = queue[0]

  if (!current) return null
  const { item } = current

  const answer = async (grade: Grade) => {
    await rate(item.id, current.unitId, grade)
    const rest = queue.slice(1)
    const next = grade === Rating.Again ? [...rest, current] : rest
    if (grade !== Rating.Again) setFinished(f => f + 1)
    setFlipped(false)
    if (next.length === 0) onDone()
    else setQueue(next)
  }

  const say = item.kind === 'grammar' ? item.examples?.[0] : item.text

  return (
    <div className="stack">
      <Bar value={finished / cards.length} />
      <div className="muted small">{finished} / {cards.length} cards</div>

      <button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
        <span className={`kind kind-${item.kind}`}>{kindLabel(item)}</span>
        <span className="fc-front">{itemTitle(item)}</span>
        {!flipped && <span className="muted small">點一下看答案</span>}
        {flipped && (item.kind === 'grammar' ? (
          <span className="fc-back">
            <span className="pattern">{item.pattern}</span>
            <span>{item.zh}</span>
            {item.examples?.map(ex => <span key={ex} className="example">{ex}</span>)}
          </span>
        ) : (
          <span className="fc-back">
            <span className="muted small">{itemMeta(item)}</span>
            <span className="zh">{item.zh}</span>
            {item.example && <span className="example">{item.example}</span>}
          </span>
        ))}
      </button>

      {say && (
        <button className="btn ghost" onClick={() => speak(say)}><Icon name="volume" /> 聽發音</button>
      )}

      {flipped ? (
        <div className="grades">
          {GRADES.map(g => (
            <button key={g.grade} className="grade" onClick={() => answer(g.grade)}>
              <span>{g.label}</span><span className="muted small">{g.sub}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn primary" onClick={() => setFlipped(true)}>看答案</button>
      )}
    </div>
  )
}

function kindLabel(item: StudyItem) {
  return item.kind === 'grammar' ? '文法 grammar' : item.kind === 'phrase' ? '片語 phrase' : '單字 word'
}
