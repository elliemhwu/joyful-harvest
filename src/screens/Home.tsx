import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../App'
import { db, getRewardsConfig } from '../lib/db'
import { sortUnits } from '../lib/content'
import { getStats, goalProgress } from '../lib/progress'
import { Bar, Icon } from '../ui'

export default function Home() {
  const { settings, go } = useApp()
  const units = useLiveQuery(() => db.units.toArray().then(sortUnits))
  const done = useLiveQuery(() => db.paragraphs.toArray().then(r => new Set(r.map(p => p.id))))
  const dueCount = useLiveQuery(() => db.cards.where('due').belowOrEqual(new Date()).count())
  const stats = useLiveQuery(getStats)
  const nextReward = useLiveQuery(async () => {
    const [config, earned, s] = await Promise.all([getRewardsConfig(), db.earned.toArray(), getStats()])
    const have = new Set(earned.map(e => e.rewardId))
    return config.rewards
      .filter(r => !have.has(r.id))
      .map(r => ({ r, p: goalProgress(r.goal, s) }))
      .sort((a, b) => b.p.value - a.p.value)[0]
  })

  if (!units || !done) return null

  if (units.length === 0) {
    return (
      <div className="stack">
        <h1 className="title">Joyful Harvest</h1>
        <div className="card center">
          <Icon name="sprout" size={32} />
          <p>還沒有課程。連上網路就會自動下載，或請老師傳檔案給你，到「設定」匯入。</p>
          <button className="btn" onClick={() => go({ name: 'settings' })}>前往設定</button>
        </div>
      </div>
    )
  }

  const next = units.flatMap(u => u.data.paragraphs.map((p, i) => ({ unit: u.data, p, i })))
    .find(x => !done.has(x.p.id))

  return (
    <div className="stack">
      <div className="row">
        <div>
          <div className="muted small">{greeting()}{settings.name ? `，${settings.name}` : ''}</div>
          <h1 className="title">Joyful Harvest</h1>
        </div>
        <div className="row gap">
          <span className="streak"><Icon name="flame" size={18} /> {stats?.streak ?? 0} 天</span>
          <button className="icon-btn" aria-label="設定" onClick={() => go({ name: 'settings' })}><Icon name="sliders" /></button>
        </div>
      </div>

      {next ? (
        <div className="card">
          <div className="muted small">今天的種子 · Today's seed</div>
          <div className="h2">{next.unit.title} · Paragraph {next.i + 1}</div>
          <div className="muted small">{next.p.cards.length} cards → read → {next.p.questions?.length ?? 0} questions · 約 10 分鐘</div>
          <button className="btn primary" onClick={() => go({ name: 'session', unitId: next.unit.id, paragraphId: next.p.id })}>
            開始撒種 Start
          </button>
        </div>
      ) : (
        <div className="card center">
          <Icon name="star" size={28} />
          <div className="h2">所有段落都完成了！</div>
          <div className="muted small">等老師的新單元，或先複習、準備考試。</div>
        </div>
      )}

      <div className="grid2">
        <button className="tile" onClick={() => go({ name: 'review' })}>
          <Icon name="refresh" />
          <span className="tile-title">澆水複習</span>
          <span className="muted small">{dueCount ? `${dueCount} 張待複習` : '今天沒有'}</span>
        </button>
        <button className="tile" onClick={() => go({ name: 'exam' })}>
          <Icon name="flag" />
          <span className="tile-title">考前收割</span>
          <span className="muted small">整個單元總複習</span>
        </button>
      </div>

      {nextReward && (
        <button className="card row-card" onClick={() => go({ name: 'rewards' })}>
          <span className="reward-dot"><Icon name={nextReward.r.icon} /></span>
          <span className="grow">
            <span className="tile-title">{nextReward.r.title}</span>
            <Bar value={nextReward.p.value} />
          </span>
          <span className="muted small">{nextReward.p.label}</span>
        </button>
      )}

      {units.map(u => (
        <div key={u.id} className="card">
          <div className="row">
            <span className="tile-title">{u.data.title} {u.data.titleZh}</span>
            <span className="muted small">{u.data.paragraphs.filter(p => done.has(p.id)).length} / {u.data.paragraphs.length}</span>
          </div>
          <div className="stamps">
            {u.data.paragraphs.map((p, i) => (
              <button key={p.id} className={done.has(p.id) ? 'stamp on' : 'stamp'} aria-label={`Paragraph ${i + 1}`}
                onClick={() => go({ name: 'session', unitId: u.id, paragraphId: p.id })}>
                {done.has(p.id) ? <Icon name="leaf" size={16} /> : i + 1}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 11 ? '早安' : h < 18 ? '午安' : '晚安'
}
