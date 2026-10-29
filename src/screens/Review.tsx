import { useEffect, useState } from 'react'
import { useApp } from '../App'
import { db } from '../lib/db'
import { itemMap } from '../lib/content'
import { dueCards } from '../lib/srs'
import { Icon, TopBar } from '../ui'
import CardDeck, { type DeckCard } from './CardDeck'

/** Daily watering: every card that spaced repetition says is due, across units. */
export default function Review() {
  const { go, refreshRewards } = useApp()
  const [cards, setCards] = useState<DeckCard[] | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    (async () => {
      const [due, units] = await Promise.all([dueCards(), db.units.toArray()])
      const maps = new Map(units.map(u => [u.id, itemMap(u.data)]))
      setCards(due.flatMap(c => {
        const item = maps.get(c.unitId)?.get(c.itemId)
        return item ? [{ item, unitId: c.unitId }] : []
      }))
    })()
  }, [])

  if (!cards) return null
  return (
    <div className="stack">
      <TopBar onBack={() => go({ name: 'home' })} title="澆水複習 Review" />
      {cards.length === 0 || done ? (
        <div className="card center">
          <Icon name="sprout" size={32} />
          <div className="h2">{done ? '澆完水了！' : '今天沒有要複習的卡片'}</div>
          <div className="muted small">卡片會在快要忘記的時候回來。</div>
          <button className="btn primary" onClick={() => go({ name: 'home' })}>回首頁</button>
        </div>
      ) : (
        <CardDeck cards={cards} onDone={() => { setDone(true); refreshRewards() }} />
      )}
    </div>
  )
}
