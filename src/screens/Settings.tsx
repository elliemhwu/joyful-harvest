import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useApp } from '../App'
import { db, getRewardsConfig } from '../lib/db'
import { LEVELS } from '../lib/content'
import { goalText } from '../lib/progress'
import { importFile } from '../lib/sync'
import { THEMES } from '../lib/themes'
import { Icon, TopBar } from '../ui'

export default function Settings() {
  const { settings, saveSettings, go, sync, refreshRewards } = useApp()
  const [status, setStatus] = useState('')
  const [name, setName] = useState(settings.name)
  const unlocks = useLiveQuery(async () => {
    const [config, earned] = await Promise.all([getRewardsConfig(), db.earned.toArray()])
    const have = new Set(earned.map(e => e.rewardId))
    return new Map(config.rewards.filter(r => r.kind === 'theme' && r.themeId)
      .map(r => [r.themeId!, { unlocked: have.has(r.id), goal: goalText(r.goal) }]))
  })

  const onImport = async (file?: File) => {
    if (!file) return
    try {
      setStatus(await importFile(file))
      await refreshRewards()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '匯入失敗')
    }
  }

  return (
    <div className="stack">
      <TopBar onBack={() => go({ name: 'home' })} title="設定 Settings" />

      <div className="card stack tight">
        <label className="tile-title" htmlFor="name">你的名字</label>
        <input id="name" className="input" value={name} placeholder="Mei"
          onChange={e => setName(e.target.value)} onBlur={() => saveSettings({ name: name.trim() })} />
      </div>

      <div className="card stack tight">
        <div className="row">
          <span className="tile-title">單字程度</span>
          <span className="muted small">Level {settings.level} · {LEVELS[settings.level]}</span>
        </div>
        <input type="range" min={1} max={6} step={1} value={settings.level}
          onChange={e => saveSettings({ level: Number(e.target.value) })} />
        <div className="muted small">閱讀時，只標出比這個程度難的單字。文法和課本重點一定會標。</div>
      </div>

      <div className="card stack tight">
        <span className="tile-title">主題</span>
        <div className="themes">
          {THEMES.map(t => {
            const lock = t.id === 'matcha' ? null : unlocks?.get(t.id)
            const locked = t.id !== 'matcha' && !lock?.unlocked
            return (
              <button key={t.id} disabled={locked}
                className={`theme-swatch ${settings.theme === t.id ? 'on' : ''}`}
                onClick={() => saveSettings({ theme: t.id })}>
                <span className="swatch" style={{ background: t.tokens.bg, borderColor: t.tokens.border }}>
                  <span style={{ background: t.tokens.accent }} />
                </span>
                <span className="tile-title">{t.name}</span>
                {locked && <span className="muted small"><Icon name="lock" size={12} /> {lock?.goal ?? '尚未開放'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card stack tight">
        <span className="tile-title">更新課程</span>
        <div className="muted small">連上網路時會自動更新。和老師見面時，也可以用老師的熱點，或匯入老師傳的檔案。</div>
        <div className="row gap">
          <button className="btn grow" onClick={async () => setStatus(await sync())}><Icon name="refresh" size={18} /> 立即更新</button>
          <label className="btn grow">
            <Icon name="upload" size={18} /> 匯入檔案
            <input type="file" accept=".json,application/json" hidden onChange={e => onImport(e.target.files?.[0])} />
          </label>
        </div>
        {status && <div className="feedback">{status}</div>}
      </div>

      <div className="muted small center">Joyful Harvest 歡呼收割 · 流淚撒種的，必歡呼收割</div>
    </div>
  )
}
