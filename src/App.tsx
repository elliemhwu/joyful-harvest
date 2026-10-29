import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, getSettings, requestPersistence, updateSettings, type Settings } from './lib/db'
import { checkRewards } from './lib/progress'
import { syncFromServer } from './lib/sync'
import { applyTheme } from './lib/themes'
import type { Reward } from './lib/types'
import { Icon } from './ui'
import Home from './screens/Home'
import Session from './screens/Session'
import Review from './screens/Review'
import Exam from './screens/Exam'
import Rewards from './screens/Rewards'
import SettingsScreen from './screens/Settings'

export type Route =
  | { name: 'home' }
  | { name: 'session'; unitId: string; paragraphId: string }
  | { name: 'review' }
  | { name: 'exam'; unitId?: string }
  | { name: 'rewards' }
  | { name: 'settings' }

interface AppCtx {
  settings: Settings
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  go: (route: Route) => void
  /** Re-check the tutor's reward goals and celebrate anything new. */
  refreshRewards: () => Promise<void>
  sync: () => Promise<string>
}

const Ctx = createContext<AppCtx>(null!)
export const useApp = () => useContext(Ctx)

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [celebrate, setCelebrate] = useState<Reward[]>([])

  const refreshRewards = useCallback(async () => {
    const fresh = await checkRewards()
    if (fresh.length) setCelebrate(fresh)
  }, [])

  const sync = useCallback(async () => {
    try {
      const r = await syncFromServer()
      await refreshRewards()
      const parts = [...r.units.map(u => `新單元：${u}`), ...(r.rewards ? ['獎勵已更新'] : [])]
      return parts.length ? parts.join('、') : '已是最新'
    } catch {
      return navigator.onLine ? '無法連線到伺服器' : '目前離線，之後連上網路會自動更新'
    }
  }, [refreshRewards])

  useEffect(() => {
    requestPersistence()
    getSettings().then(s => { setSettings(s); applyTheme(s.theme) })
    if (navigator.onLine) sync()
    else refreshRewards()
    const onOnline = () => { sync() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [sync, refreshRewards])

  const saveSettings = async (patch: Partial<Settings>) => {
    await updateSettings(patch)
    const next = { ...settings, ...patch }
    setSettings(next)
    if (patch.theme) applyTheme(patch.theme)
  }

  const go = (r: Route) => { setRoute(r); window.scrollTo(0, 0) }

  return (
    <Ctx.Provider value={{ settings, saveSettings, go, refreshRewards, sync }}>
      <main className="app">
        {route.name === 'home' && <Home />}
        {route.name === 'session' && <Session unitId={route.unitId} paragraphId={route.paragraphId} />}
        {route.name === 'review' && <Review />}
        {route.name === 'exam' && <Exam unitId={route.unitId} />}
        {route.name === 'rewards' && <Rewards />}
        {route.name === 'settings' && <SettingsScreen />}
      </main>
      {celebrate.length > 0 && (
        <div className="overlay" onClick={() => setCelebrate([])}>
          <div className="sheet celebrate" onClick={e => e.stopPropagation()}>
            <div className="muted small">歡呼收割！You earned something</div>
            {celebrate.map(r => (
              <div key={r.id} className={r.kind === 'tutor' ? 'coupon' : 'coupon theme'}>
                <span className="coupon-icon"><Icon name={r.icon} size={28} /></span>
                <div className="coupon-title">{r.title}</div>
                {r.note && <div className="muted small">{r.note}</div>}
                {r.kind === 'theme' && <div className="muted small">到「設定」換上新主題</div>}
              </div>
            ))}
            <button className="btn primary" onClick={() => { setCelebrate([]); go({ name: 'rewards' }) }}>看我的獎勵</button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
