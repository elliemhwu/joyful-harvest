import { useState } from 'react'
import { goalText } from '../lib/progress'
import { THEMES } from '../lib/themes'
import type { Reward, RewardGoal, RewardsConfig, Unit } from '../lib/types'
import { Icon } from '../ui'
import { download, publishRewards } from './api'

const ICONS = ['cake', 'cup', 'gift', 'star', 'palette', 'leaf', 'sprout', 'book']
const GOALS: { type: RewardGoal['type']; label: string }[] = [
  { type: 'streak', label: 'Study streak (days)' },
  { type: 'paragraphs', label: 'Paragraphs finished' },
  { type: 'wordsMastered', label: 'Words harvested' },
  { type: 'unitComplete', label: 'Unit finished' },
]

function defaultGoal(type: RewardGoal['type'], units: Unit[]): RewardGoal {
  switch (type) {
    case 'streak': return { type, days: 7 }
    case 'paragraphs': return { type, count: 5 }
    case 'wordsMastered': return { type, count: 30 }
    case 'unitComplete': return { type, unitId: units[0]?.id ?? '' }
  }
}

/** Your rewards: real-life treats (coupons) and theme unlocks, with the goal for each. */
export default function RewardsEditor({ config, units, onPublished }: {
  config: RewardsConfig; units: Unit[]; onPublished: () => void
}) {
  const [rewards, setRewards] = useState<Reward[]>(config.rewards)
  const [dirty, setDirty] = useState(false)

  const change = (i: number, patch: Partial<Reward>) => {
    setRewards(list => list.map((r, j) => j === i ? { ...r, ...patch } : r))
    setDirty(true)
  }

  const add = () => {
    setRewards(list => [...list, {
      id: `r-${Date.now().toString(36)}`, title: '', icon: 'gift', kind: 'tutor',
      goal: { type: 'streak', days: 7 }, note: 'Show this at your next lesson',
    }])
    setDirty(true)
  }

  const publish = async () => {
    const empty = rewards.find(r => !r.title.trim())
    if (empty) return alert('Every reward needs a title')
    const { version } = await publishRewards({ version: config.version, rewards })
    setDirty(false)
    alert(`Rewards published (v${version}). Already-earned rewards stay earned.`)
    onPublished()
  }

  return (
    <div className="stack">
      <div className="row wrap">
        <h1 className="title">Rewards</h1>
        <div className="row gap">
          <button className="btn" onClick={() => download('rewards.json', { version: config.version + 1, rewards })}>
            <Icon name="upload" size={18} /> Download file</button>
          <button className="btn primary" onClick={publish} disabled={!dirty}>Publish</button>
        </div>
      </div>
      <div className="muted small">Rewards are for effort, never scores. A phone unlocks a reward the moment its goal is met, even offline. Coupons: tap 老師確認兌換 on her phone when you hand over the treat.</div>

      {rewards.map((r, i) => (
        <div key={r.id} className="card reward-edit">
          <div className="row gap wrap">
            <select className="input" value={r.kind} aria-label="Type"
              onChange={e => change(i, e.target.value === 'theme'
                ? { kind: 'theme', themeId: r.themeId ?? 'ocean', icon: 'palette', note: undefined }
                : { kind: 'tutor', themeId: undefined })}>
              <option value="tutor">Real-life treat</option>
              <option value="theme">Theme unlock</option>
            </select>
            {r.kind === 'theme' ? (
              <select className="input" value={r.themeId} aria-label="Theme"
                onChange={e => change(i, { themeId: e.target.value, title: `${THEMES.find(t => t.id === e.target.value)?.name} theme` })}>
                {THEMES.filter(t => t.id !== 'matcha').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            ) : (
              <div className="icon-pick" role="radiogroup" aria-label="Icon">
                {ICONS.map(icon => (
                  <button key={icon} role="radio" aria-checked={r.icon === icon} aria-label={icon}
                    className={r.icon === icon ? 'on' : ''} onClick={() => change(i, { icon })}><Icon name={icon} size={18} /></button>
                ))}
              </div>
            )}
            <button className="icon-btn" aria-label="Delete reward"
              onClick={() => { if (confirm('Delete this reward?')) { setRewards(list => list.filter((_, j) => j !== i)); setDirty(true) } }}>✕</button>
          </div>

          <input className="input" value={r.title} placeholder="A piece of handmade cake" onChange={e => change(i, { title: e.target.value })} />
          {r.kind === 'tutor' && (
            <input className="input" value={r.note ?? ''} placeholder="Note on the coupon" onChange={e => change(i, { note: e.target.value || undefined })} />
          )}

          <div className="row gap wrap">
            <select className="input" value={r.goal.type} aria-label="Goal"
              onChange={e => change(i, { goal: defaultGoal(e.target.value as RewardGoal['type'], units) })}>
              {GOALS.map(g => <option key={g.type} value={g.type}>{g.label}</option>)}
            </select>
            {r.goal.type === 'unitComplete' ? (
              <select className="input" value={r.goal.unitId} aria-label="Unit"
                onChange={e => change(i, { goal: { type: 'unitComplete', unitId: e.target.value } })}>
                {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            ) : (
              <input className="input narrow" type="number" min={1} aria-label="Goal amount"
                value={r.goal.type === 'streak' ? r.goal.days : r.goal.count}
                onChange={e => {
                  const n = Math.max(1, Number(e.target.value) || 1)
                  change(i, { goal: r.goal.type === 'streak' ? { type: 'streak', days: n } : { ...r.goal, count: n } as RewardGoal })
                }} />
            )}
            <span className="muted small">→ {goalText(r.goal)}</span>
          </div>
        </div>
      ))}

      <button className="btn" onClick={add}>+ Add reward</button>
    </div>
  )
}
