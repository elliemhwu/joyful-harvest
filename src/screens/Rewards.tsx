import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../App'
import { db, getRewardsConfig } from '../lib/db'
import { itemMap, itemTitle } from '../lib/content'
import { getStats, goalProgress, goalText } from '../lib/progress'
import { isMastered } from '../lib/srs'
import type { StudyItem } from '../lib/types'
import { Bar, Icon, TopBar } from '../ui'

export default function Rewards() {
  const { go } = useApp()
  const data = useLiveQuery(async () => {
    const [config, earned, stats, cards, units] = await Promise.all([
      getRewardsConfig(), db.earned.toArray(), getStats(), db.cards.toArray(), db.units.toArray(),
    ])
    const maps = units.map(u => itemMap(u.data))
    const harvested = cards.filter(isMastered)
      .map(c => maps.map(m => m.get(c.itemId)).find(Boolean))
      .filter((i): i is StudyItem => !!i)
    return { config, earned: new Map(earned.map(e => [e.rewardId, e])), stats, harvested }
  })

  if (!data) return null
  const { config, earned, stats, harvested } = data
  const got = config.rewards.filter(r => earned.has(r.id))
  const upcoming = config.rewards.filter(r => !earned.has(r.id))

  const redeem = (id: string) => db.earned.update(id, { redeemedAt: Date.now() })

  return (
    <div className="stack">
      <TopBar onBack={() => go({ name: 'home' })} title="我的獎勵 Rewards" />

      {got.length > 0 && <div className="section-title">已獲得</div>}
      {got.map(r => {
        const e = earned.get(r.id)!
        return (
          <div key={r.id} className={`coupon ${r.kind === 'theme' ? 'theme' : ''} ${e.redeemedAt ? 'redeemed' : ''}`}>
            <span className="coupon-icon"><Icon name={r.icon} size={26} /></span>
            <div className="coupon-title">{r.title}</div>
            <div className="muted small">{goalText(r.goal)}</div>
            {r.kind === 'tutor' && (e.redeemedAt
              ? <div className="muted small"><Icon name="check" size={14} /> 已兌換 {new Date(e.redeemedAt).toLocaleDateString()}</div>
              : <>
                  <div className="coupon-note">{r.note ?? '下次上課拿給老師看'}</div>
                  <button className="btn small-btn" onClick={() => redeem(r.id)}>老師確認兌換</button>
                </>)}
            {r.kind === 'theme' && (
              <button className="btn small-btn" onClick={() => go({ name: 'settings' })}>換上這個主題</button>
            )}
          </div>
        )
      })}

      {upcoming.length > 0 && <div className="section-title">下一個目標</div>}
      {upcoming.map(r => {
        const p = goalProgress(r.goal, stats)
        return (
          <div key={r.id} className="card row-card">
            <span className="reward-dot"><Icon name={r.icon} /></span>
            <span className="grow">
              <span className="tile-title">{r.title}</span>
              <span className="muted small"> · {goalText(r.goal)}</span>
              <Bar value={p.value} />
            </span>
            <span className="muted small">{p.label}</span>
          </div>
        )
      })}

      <div className="section-title">收割的單字 · {harvested.length}</div>
      <div className="card">
        {harvested.length === 0
          ? <div className="muted small">單字複習到記得一週以上，就會在這裡長出來。</div>
          : <div className="garden">{harvested.map(i => <span key={i.id} className="crop"><Icon name="sprout" size={14} /> {itemTitle(i)}</span>)}</div>}
      </div>
    </div>
  )
}
