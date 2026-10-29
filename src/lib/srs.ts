import { createEmptyCard, fsrs, Rating, State, type Grade } from 'ts-fsrs'
import { db, logActivity, type CardRow } from './db'

const scheduler = fsrs({ enable_fuzz: true })

export { Rating }

export async function rate(itemId: string, unitId: string, grade: Grade) {
  const now = new Date()
  const existing = await db.cards.get(itemId)
  const { card } = scheduler.next(existing ?? createEmptyCard(now), now, grade)
  await db.cards.put({ ...card, itemId, unitId })
  await logActivity('cards')
}

export async function dueCards(now = new Date()): Promise<CardRow[]> {
  return db.cards.where('due').belowOrEqual(now).toArray()
}

/** A word counts as harvested once it survives a week+ between reviews. */
export function isMastered(card: CardRow) {
  return card.state === State.Review && card.stability >= 7
}
