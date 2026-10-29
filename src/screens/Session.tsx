import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../App'
import { db, logActivity } from '../lib/db'
import { itemMap } from '../lib/content'
import type { StudyItem } from '../lib/types'
import { Icon, TopBar } from '../ui'
import CardDeck from './CardDeck'
import Check from './Check'
import ReadView from './ReadView'

type Step = 'learn' | 'read' | 'check' | 'done'
const STEPS: { id: Step; label: string }[] = [
  { id: 'learn', label: '撒種' }, { id: 'read', label: '閱讀' }, { id: 'check', label: '檢查' },
]

/** The daily loop from our lessons: memorize cards → read the paragraph → self-check. */
export default function Session({ unitId, paragraphId }: { unitId: string; paragraphId: string }) {
  const { go, refreshRewards } = useApp()
  const stored = useLiveQuery(() => db.units.get(unitId), [unitId])
  const [step, setStep] = useState<Step>('learn')
  const [taps, setTaps] = useState(0)
  const [score, setScore] = useState<number | null>(null)

  const unit = stored?.data
  const index = unit?.paragraphs.findIndex(p => p.id === paragraphId) ?? -1
  const paragraph = unit?.paragraphs[index]
  const cards = useMemo(() => {
    if (!unit || !paragraph) return []
    const map = itemMap(unit)
    return paragraph.cards.map(id => map.get(id)).filter((i): i is StudyItem => !!i).map(item => ({ item, unitId }))
  }, [unit, paragraph, unitId])

  if (!unit || !paragraph) return null

  const finish = async (correct: number | null) => {
    setScore(correct)
    await db.paragraphs.put({ id: paragraph.id, unitId, completedAt: Date.now(), score: correct ?? undefined, taps })
    await logActivity('paragraphs')
    setStep('done')
    await refreshRewards()
  }

  const afterRead = (t: number) => {
    setTaps(t)
    if (paragraph.questions?.length) setStep('check')
    else finish(null)
  }

  return (
    <div className="stack">
      <TopBar onBack={() => go({ name: 'home' })} title={`${unit.title} · Paragraph ${index + 1}`} />
      {step !== 'done' && (
        <div className="steps">
          {STEPS.map(s => (
            <span key={s.id} className={s.id === step ? 'step on' : 'step'}>{s.label}</span>
          ))}
        </div>
      )}

      {step === 'learn' && (cards.length
        ? <CardDeck cards={cards} onDone={() => setStep('read')} />
        : <button className="btn primary" onClick={() => setStep('read')}>開始閱讀</button>)}
      {step === 'read' && <ReadView unit={unit} paragraph={paragraph} onDone={afterRead} />}
      {step === 'check' && <Check questions={paragraph.questions ?? []} onDone={finish} />}
      {step === 'done' && (
        <div className="card center done">
          <span className="big-stamp"><Icon name="leaf" size={40} /></span>
          <div className="h2">今天的種子撒好了！</div>
          <div className="muted">
            {cards.length} 張卡片
            {score !== null && ` · 答對 ${score} / ${paragraph.questions?.length}`}
            {` · 點了 ${taps} 次提示`}
          </div>
          <p className="verse">流淚撒種的，必歡呼收割。<br /><span className="muted small">詩篇 126:5</span></p>
          <button className="btn primary" onClick={() => go({ name: 'home' })}>回首頁</button>
        </div>
      )}
    </div>
  )
}
