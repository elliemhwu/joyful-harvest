// Tutor-mode API, served by the Vite dev/preview server on the tutor's own
// computer. The API key stays here (server side) and never reaches a browser.
// Endpoints:
//   GET  /api/tutor/status   → { ready, mock }
//   POST /api/tutor/extract  → scans/PDFs in, draft Unit out (Claude)
//   POST /api/tutor/publish  → writes public/packs or public/config, bumps versions

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'
const PUBLIC = path.resolve('public')
const MAX_BODY = 60 * 1024 * 1024

// Every field is required so the schema works with structured outputs;
// "unused" fields come back as empty strings/arrays and get cleaned up below.
const Extracted = z.object({
  title: z.string(),
  titleZh: z.string(),
  items: z.array(z.object({
    id: z.string(),
    kind: z.enum(['word', 'phrase']),
    text: z.string(),
    pos: z.string(),
    zh: z.string(),
    level: z.number().int(),
    official: z.boolean(),
    example: z.string(),
  })),
  grammar: z.array(z.object({
    id: z.string(),
    name: z.string(),
    pattern: z.string(),
    zh: z.string(),
    examples: z.array(z.string()),
    official: z.boolean(),
  })),
  paragraphs: z.array(z.object({
    sentences: z.array(z.object({
      text: z.string(),
      zh: z.string(),
      marks: z.array(z.object({ text: z.string(), ref: z.string() })),
    })),
    cards: z.array(z.string()),
    questions: z.array(z.object({
      type: z.enum(['choice', 'order']),
      prompt: z.string(),
      options: z.array(z.string()),
      answer: z.number().int(),
      chunks: z.array(z.string()),
    })),
  })),
  notes: z.string(),
})
type Extracted = z.infer<typeof Extracted>

const SYSTEM = `You prepare English study material for a Taiwanese student who finds English hard. A tutor sends you scans of one textbook unit, and sometimes the school's vocabulary list or vocabulary handbook pages for that unit. Turn them into one study unit for an offline phone app.

How the app uses your output: each day the student memorizes one paragraph's cards, then reads that paragraph and taps highlighted text for help, then answers 2-3 questions. Before exams she reviews the unit's official items.

Content rules:
- paragraphs: the textbook's reading passage, transcribed exactly (fix only OCR noise), split as the textbook splits it. Leave out page furniture such as headers, page numbers and exercise instructions. Dialogues: one paragraph per natural chunk of 3-6 lines.
- sentences: split each paragraph into sentences. zh is a natural Traditional Chinese translation as used in Taiwan, written for a junior-high reader.
- items (words and phrases) and grammar: include everything the textbook, vocabulary list or handbook highlights (official: true), plus other words and phrases from the passage above the student's level (official: false). Do not add items at or below her level unless they are official.
- level: 1-6 using the CEEC (大考中心) 6-level word list. Phrases get the level of their hardest word.
- zh for items: the meaning in this passage first; add a second common meaning only if it helps.
- example: one short, simple sentence that is not from the passage. Use an empty string if there is nothing good.
- grammar: the patterns the handbook or textbook teaches for this unit, plus at most 2 more the passage clearly needs. name is short (e.g. "used to + V"), pattern is a formula (e.g. "S + used to + 原形動詞"), zh explains it in 1-2 plain sentences, examples are 2 short sentences.
- ids: lowercase kebab-case, prefixed w- (word), p- (phrase), g- (grammar), e.g. w-nervous, p-give-up, g-too-to. Each id is unique.
- marks: for every item or grammar point in a sentence, add a mark whose text is an exact substring of that sentence (the inflected form as it appears, e.g. "pretended") and whose ref is the item id. For grammar, mark the shortest span that shows the pattern (e.g. "too shy to"). Marks may overlap.
- cards: the ids to memorize before reading that paragraph, in a sensible learning order (grammar points first, then words in reading order). Each item appears in the cards of the first paragraph that uses it.
- questions: 2-3 per paragraph, about that paragraph only. Use at least one "choice" question (4 options, answer = index of the correct option, chunks empty) checking meaning or grammar, and one "order" question (chunks = 3-5 pieces of a key sentence in the correct order, options empty, answer 0). Prompts may be in English or Chinese, at her level.
- notes: anything the tutor should check (unreadable parts, guesses, pages that didn't belong). Empty string if none.

Accuracy matters more than volume: a wrong translation teaches the wrong thing. When unsure, say so in notes.`

export function tutorApi(env: Record<string, string>): Plugin {
  const mount = (use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void) => {
    use((req, res, next) => {
      if (!req.url?.startsWith('/api/tutor/')) return next()
      handle(req, res, env).catch(err => {
        console.error('[tutor]', err)
        send(res, 500, { error: err instanceof Error ? err.message : String(err) })
      })
    })
  }
  return {
    name: 'harvest-tutor-api',
    // Block bodies matter: a returned function would be run as a post-middleware hook.
    configureServer(server) { mount(fn => { server.middlewares.use(fn) }) },
    configurePreviewServer(server) { mount(fn => { server.middlewares.use(fn) }) },
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  const route = req.url!.split('?')[0]
  const mock = env.HARVEST_MOCK === '1'

  if (route === '/api/tutor/status' && req.method === 'GET') {
    return send(res, 200, { ready: mock || !!env.ANTHROPIC_API_KEY, mock })
  }
  if (route === '/api/tutor/extract' && req.method === 'POST') {
    const body = await readJson(req)
    const unit = mock ? await mockExtract(body) : await extract(body, env)
    return send(res, 200, unit)
  }
  if (route === '/api/tutor/publish' && req.method === 'POST') {
    return send(res, 200, await publish(await readJson(req)))
  }
  send(res, 404, { error: 'Not found' })
}

interface ExtractRequest {
  unitId: string
  title?: string
  level: number
  notes?: string
  files: { name: string; role: 'textbook' | 'vocabulary' | 'handbook'; mediaType: string; data: string }[]
}

const ROLE_LABEL = {
  textbook: 'Textbook pages (the reading passage)',
  vocabulary: 'Vocabulary list for this unit (official items)',
  handbook: 'Vocabulary/grammar handbook pages for this unit',
}

async function extract(body: ExtractRequest, env: Record<string, string>) {
  checkUnitId(body.unitId)
  if (!body.files?.length) throw new Error('Add at least one scan or PDF')

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  for (const f of body.files) {
    content.push({ type: 'text', text: `${ROLE_LABEL[f.role]} — ${f.name}` })
    if (f.mediaType === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } })
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: f.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: f.data },
      })
    }
  }
  content.push({
    type: 'text',
    text: [
      `Student level: ${body.level} (on the 1-6 scale). Highlight non-official words above this level.`,
      body.title ? `Unit title: ${body.title}` : '',
      body.notes ? `Tutor's notes: ${body.notes}` : '',
      'Build the study unit from the pages above.',
    ].filter(Boolean).join('\n'),
  })

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  // A whole unit is a long output, so stream and wait for the final message.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: z.toJSONSchema(Extracted) as Record<string, unknown> },
    },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  })
  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') throw new Error('Claude declined these pages. Try fewer or different pages.')
  if (message.stop_reason === 'max_tokens') throw new Error('The unit was too long for one pass. Try splitting the pages into two units.')
  const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  const parsed = Extracted.parse(JSON.parse(text))
  return toUnit(parsed, body.unitId, body.title)
}

/** Converts the flat extraction shape into the app's Unit format. */
function toUnit(x: Extracted, unitId: string, title?: string) {
  const clampLevel = (n: number) => Math.min(6, Math.max(1, Math.round(n)))
  return {
    unit: {
      id: unitId,
      version: 0,
      title: title || x.title,
      titleZh: x.titleZh || undefined,
      items: x.items.map(i => ({
        id: i.id, kind: i.kind, text: i.text, zh: i.zh, level: clampLevel(i.level),
        ...(i.pos && { pos: i.pos }), ...(i.official && { official: true }), ...(i.example && { example: i.example }),
      })),
      grammar: x.grammar.map(g => ({
        id: g.id, kind: 'grammar' as const, name: g.name, pattern: g.pattern, zh: g.zh,
        examples: g.examples, ...(g.official && { official: true }),
      })),
      paragraphs: x.paragraphs.map((p, pi) => {
        const pid = `${unitId}-p${pi + 1}`
        return {
          id: pid,
          cards: p.cards,
          sentences: p.sentences.map((s, si) => ({ id: `${pid}-s${si + 1}`, text: s.text, zh: s.zh, marks: s.marks })),
          questions: p.questions.map((q, qi) => q.type === 'choice'
            ? { id: `${pid}-q${qi + 1}`, type: 'choice' as const, prompt: q.prompt, options: q.options, answer: q.answer }
            : { id: `${pid}-q${qi + 1}`, type: 'order' as const, prompt: q.prompt, chunks: q.chunks }),
        }
      }),
    },
    notes: x.notes,
  }
}

async function mockExtract(body: ExtractRequest) {
  checkUnitId(body.unitId)
  await new Promise(r => setTimeout(r, 1500))
  const sample = JSON.parse(await fs.readFile(path.join(PUBLIC, 'packs', 'unit-1.json'), 'utf8'))
  const rename = (s: string) => s.replace(/^u1-/, `${body.unitId}-`)
  for (const p of sample.paragraphs) {
    p.id = rename(p.id)
    for (const s of p.sentences) s.id = rename(s.id)
    for (const q of p.questions ?? []) q.id = rename(q.id)
  }
  return {
    unit: { ...sample, id: body.unitId, version: 0, title: body.title || sample.title },
    notes: 'Mock mode: this is the sample unit, not your scans. Set ANTHROPIC_API_KEY in .env for real extraction.',
  }
}

async function publish(body: { unit?: { id: string; title: string }; rewards?: { rewards: unknown[] } }) {
  const indexPath = path.join(PUBLIC, 'packs', 'index.json')
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'))

  if (body.unit) {
    checkUnitId(body.unit.id)
    const entry = index.units.find((u: { id: string }) => u.id === body.unit!.id)
    const version = (entry?.version ?? 0) + 1
    const url = `packs/${body.unit.id}.json`
    await writeJson(path.join(PUBLIC, url), { ...body.unit, version })
    if (entry) Object.assign(entry, { version, title: body.unit.title, url })
    else index.units.push({ id: body.unit.id, version, url, title: body.unit.title })
    await writeJson(indexPath, index)
    return { version }
  }

  if (body.rewards) {
    const version = (index.rewards?.version ?? 0) + 1
    await writeJson(path.join(PUBLIC, 'config', 'rewards.json'), { version, rewards: body.rewards.rewards })
    index.rewards = { version, url: 'config/rewards.json' }
    await writeJson(indexPath, index)
    return { version }
  }
  throw new Error('Nothing to publish')
}

function checkUnitId(id: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id ?? '')) throw new Error('Unit id: lowercase letters, numbers and dashes only (e.g. b3-unit-2)')
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('Upload too large (max 60 MB). Try fewer pages at once.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}
