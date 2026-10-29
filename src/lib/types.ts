// Content packs are authored in tutor mode (later: AI-assisted) and downloaded
// to the student's phone. Everything a student sees offline lives in a pack.

export type Level = 1 | 2 | 3 | 4 | 5 | 6

export interface LexItem {
  id: string
  kind: 'word' | 'phrase'
  text: string
  pos?: string
  zh: string
  level?: Level
  /** Highlighted by the textbook itself: always shown, part of exam review. */
  official?: boolean
  example?: string
}

export interface GrammarPoint {
  id: string
  kind: 'grammar'
  name: string
  pattern: string
  zh: string
  examples?: string[]
  official?: boolean
}

export type StudyItem = LexItem | GrammarPoint

export interface Mark {
  /** Exact text in the sentence to highlight. */
  text: string
  ref: string
  /** Which occurrence of `text` in the sentence (1-based), default 1. */
  nth?: number
}

export interface Sentence {
  id: string
  text: string
  zh: string
  marks?: Mark[]
}

export type Question =
  | { id: string; type: 'choice'; prompt: string; options: string[]; answer: number }
  | { id: string; type: 'order'; prompt: string; chunks: string[] }

export interface Paragraph {
  id: string
  sentences: Sentence[]
  /** Items to memorize before reading, in card order. */
  cards: string[]
  questions?: Question[]
}

export interface Unit {
  id: string
  version: number
  title: string
  titleZh?: string
  items: LexItem[]
  grammar: GrammarPoint[]
  paragraphs: Paragraph[]
}

export interface PackManifest {
  units: { id: string; version: number; url: string; title: string }[]
  rewards?: { version: number; url: string }
}

// Rewards are configured by the tutor; the phone only checks goals.
export type RewardGoal =
  | { type: 'streak'; days: number }
  | { type: 'paragraphs'; count: number }
  | { type: 'unitComplete'; unitId: string }
  | { type: 'wordsMastered'; count: number }

export interface Reward {
  id: string
  title: string
  /** Tabler-style icon name, rendered as an emoji-free glyph by the app. */
  icon: string
  kind: 'tutor' | 'theme'
  themeId?: string
  goal: RewardGoal
  note?: string
}

export interface RewardsConfig {
  version: number
  rewards: Reward[]
}
