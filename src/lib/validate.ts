import type { Unit } from './types'

export interface Warning { where: string; message: string }

/** Problems that would show up wrong on the student's phone. */
export function validateUnit(unit: Unit): Warning[] {
  const out: Warning[] = []
  const ids = new Map<string, number>()
  for (const i of [...unit.items, ...unit.grammar]) ids.set(i.id, (ids.get(i.id) ?? 0) + 1)
  for (const [id, n] of ids) if (n > 1) out.push({ where: id, message: `重複的 id（${n} 次）` })

  const used = new Set<string>()
  unit.paragraphs.forEach((p, pi) => {
    const where = `Paragraph ${pi + 1}`
    p.sentences.forEach((s, si) => {
      for (const m of s.marks ?? []) {
        used.add(m.ref)
        if (!ids.has(m.ref)) out.push({ where: `${where}, sentence ${si + 1}`, message: `標記「${m.text}」指向不存在的項目 ${m.ref}` })
        if (!s.text.includes(m.text)) out.push({ where: `${where}, sentence ${si + 1}`, message: `句子裡找不到「${m.text}」` })
      }
      if (!s.zh.trim()) out.push({ where: `${where}, sentence ${si + 1}`, message: '缺少中文翻譯' })
    })
    for (const c of p.cards) if (!ids.has(c)) out.push({ where, message: `卡片 ${c} 不存在` })
    for (const q of p.questions ?? []) {
      if (q.type === 'choice' && (q.answer < 0 || q.answer >= q.options.length)) {
        out.push({ where, message: `題目「${q.prompt}」的答案不在選項裡` })
      }
      if (q.type === 'order' && q.chunks.length < 2) out.push({ where, message: `排序題「${q.prompt}」至少要 2 個詞塊` })
    }
  })

  const inCards = new Set(unit.paragraphs.flatMap(p => p.cards))
  for (const i of [...unit.items, ...unit.grammar]) {
    if (!used.has(i.id) && !inCards.has(i.id)) out.push({ where: i.id, message: '沒有出現在任何段落或卡片中' })
  }
  return out
}
