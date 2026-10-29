import { useMemo, useState } from 'react'
import type { Question } from '../lib/types'
import { Bar } from '../ui'

/** Self-check after reading. Wrong answers just show the right one — no penalties. */
export default function Check({ questions, onDone }: { questions: Question[]; onDone: (correct: number) => void }) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const q = questions[index]

  const next = (wasRight: boolean) => {
    const total = correct + (wasRight ? 1 : 0)
    setCorrect(total)
    if (index + 1 >= questions.length) onDone(total)
    else setIndex(index + 1)
  }

  if (!q) return null
  return (
    <div className="stack">
      <Bar value={index / questions.length} />
      <div className="muted small">第 {index + 1} / {questions.length} 題</div>
      {q.type === 'choice'
        ? <Choice key={q.id} q={q} onNext={next} />
        : <Order key={q.id} q={q} onNext={next} />}
    </div>
  )
}

function Choice({ q, onNext }: { q: Extract<Question, { type: 'choice' }>; onNext: (right: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <>
      <div className="h2">{q.prompt}</div>
      <div className="stack tight">
        {q.options.map((opt, i) => {
          const state = picked === null ? '' : i === q.answer ? 'right' : i === picked ? 'wrong' : ''
          return (
            <button key={i} className={`option ${state}`} disabled={picked !== null} onClick={() => setPicked(i)}>
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <>
          <div className={picked === q.answer ? 'feedback right' : 'feedback wrong'}>
            {picked === q.answer ? '答對了！' : '沒關係，正確答案已標出來了。'}
          </div>
          <button className="btn primary" onClick={() => onNext(picked === q.answer)}>下一題</button>
        </>
      )}
    </>
  )
}

function Order({ q, onNext }: { q: Extract<Question, { type: 'order' }>; onNext: (right: boolean) => void }) {
  const shuffled = useMemo(() => shuffle(q.chunks.map((text, i) => ({ text, i }))), [q])
  const [built, setBuilt] = useState<number[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)

  const pool = shuffled.filter(c => !built.includes(c.i))
  const isRight = built.every((v, i) => q.chunks[v] === q.chunks[i])

  return (
    <>
      <div className="h2">{q.prompt}</div>
      <div className={`order-line ${checked === null ? '' : checked ? 'right' : 'wrong'}`}>
        {built.length === 0 && <span className="muted small">點下面的詞塊排出句子</span>}
        {built.map(i => (
          <button key={i} className="chunk" disabled={checked !== null}
            onClick={() => setBuilt(b => b.filter(x => x !== i))}>{q.chunks[i]}</button>
        ))}
      </div>
      <div className="chunks">
        {pool.map(c => (
          <button key={c.i} className="chunk" onClick={() => setBuilt(b => [...b, c.i])}>{c.text}</button>
        ))}
      </div>
      {checked === null ? (
        <button className="btn primary" onClick={() => setChecked(isRight)}
          style={{ visibility: built.length === q.chunks.length ? 'visible' : 'hidden' }}>檢查</button>
      ) : (
        <>
          <div className={checked ? 'feedback right' : 'feedback wrong'}>
            {checked ? '答對了！' : <>正確順序：{q.chunks.join(' ')}</>}
          </div>
          <button className="btn primary" onClick={() => onNext(checked)}>下一題</button>
        </>
      )}
    </>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  // Never start already solved.
  return a.length > 1 && a.every((x, i) => x === arr[i]) ? shuffle(arr) : a
}
