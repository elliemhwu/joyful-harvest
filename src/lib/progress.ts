import { db, getRewardsConfig } from './db'
import { isMastered } from './srs'
import { computeStreak } from './streak'
import type { Reward, RewardGoal } from './types'

export interface Stats {
  streak: number
  paragraphsDone: number
  wordsMastered: number
  completedUnits: Set<string>
}

export async function getStats(): Promise<Stats> {
  const [days, paragraphs, cards, units] = await Promise.all([
    db.days.toArray(),
    db.paragraphs.toArray(),
    db.cards.toArray(),
    db.units.toArray(),
  ])
  const done = new Set(paragraphs.map(p => p.id))
  const completedUnits = new Set(
    units.filter(u => u.data.paragraphs.every(p => done.has(p.id))).map(u => u.id),
  )
  return {
    streak: computeStreak(days.filter(d => d.cards + d.paragraphs > 0).map(d => d.date)),
    paragraphsDone: done.size,
    wordsMastered: cards.filter(isMastered).length,
    completedUnits,
  }
}

/** 0..1 progress toward a goal, for "next up" progress bars. */
export function goalProgress(goal: RewardGoal, s: Stats): { value: number; label: string } {
  switch (goal.type) {
    case 'streak':
      return { value: Math.min(1, s.streak / goal.days), label: `${Math.min(s.streak, goal.days)} / ${goal.days} 天` }
    case 'paragraphs':
      return { value: Math.min(1, s.paragraphsDone / goal.count), label: `${Math.min(s.paragraphsDone, goal.count)} / ${goal.count} 段` }
    case 'wordsMastered':
      return { value: Math.min(1, s.wordsMastered / goal.count), label: `${Math.min(s.wordsMastered, goal.count)} / ${goal.count} 字` }
    case 'unitComplete': {
      const doneUnit = s.completedUnits.has(goal.unitId)
      return { value: doneUnit ? 1 : 0, label: doneUnit ? '完成' : '完成整個單元' }
    }
  }
}

export function goalText(goal: RewardGoal) {
  switch (goal.type) {
    case 'streak': return `連續學習 ${goal.days} 天`
    case 'paragraphs': return `完成 ${goal.count} 個段落`
    case 'wordsMastered': return `收割 ${goal.count} 個單字`
    case 'unitComplete': return `完成單元 ${goal.unitId}`
  }
}

/** Checks the tutor's reward config and records anything newly earned. */
export async function checkRewards(): Promise<Reward[]> {
  const [config, stats, earned] = await Promise.all([getRewardsConfig(), getStats(), db.earned.toArray()])
  const have = new Set(earned.map(e => e.rewardId))
  const fresh = config.rewards.filter(r => !have.has(r.id) && goalProgress(r.goal, stats).value >= 1)
  if (fresh.length) {
    const now = Date.now()
    await db.earned.bulkPut(fresh.map(r => ({ rewardId: r.id, earnedAt: now })))
  }
  return fresh
}
