import { todayKey } from './db'

/**
 * Consecutive study days ending today (or yesterday, so the streak doesn't
 * look broken before she studies today). One missed day is forgiven as a
 * "streak freeze", but at most once per 7 days.
 */
export function computeStreak(activeDates: Iterable<string>, now = new Date()): number {
  const active = new Set(activeDates)
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!active.has(todayKey(day))) day.setDate(day.getDate() - 1)

  let streak = 0
  let sinceFreeze = Infinity
  while (true) {
    if (active.has(todayKey(day))) {
      streak++
      sinceFreeze++
    } else {
      const prev = new Date(day)
      prev.setDate(prev.getDate() - 1)
      if (streak > 0 && sinceFreeze >= 7 && active.has(todayKey(prev))) {
        sinceFreeze = 0
      } else {
        break
      }
    }
    day.setDate(day.getDate() - 1)
  }
  return streak
}
