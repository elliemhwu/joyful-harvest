// Screens only use these role tokens (as CSS variables), so a new theme is
// just one more entry here. Highlight styles stay the same across themes —
// fill = word, dotted underline = phrase, solid underline = grammar — only
// the colors change.

export interface Theme {
  id: string
  name: string
  dark?: boolean
  tokens: {
    bg: string
    surface: string
    text: string
    muted: string
    border: string
    track: string
    accent: string
    onAccent: string
    word: string
    phrase: string
    grammar: string
    correct: string
    wrong: string
    gold: string
  }
}

export const THEMES: Theme[] = [
  {
    id: 'matcha',
    name: 'Matcha',
    tokens: {
      bg: '#F4F1E8', surface: '#FFFFFF', text: '#2F3A2E', muted: '#6E7A68', border: '#DCE3D2',
      track: '#DCE3D2', accent: '#5E8B5A', onAccent: '#FFFFFF', word: '#E2EBD3', phrase: '#5E8B5A',
      grammar: '#C98F4E', correct: '#3F7D3A', wrong: '#B5523B', gold: '#C98F4E',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean mist',
    tokens: {
      bg: '#EEF5F6', surface: '#FFFFFF', text: '#1E3440', muted: '#5F7A85', border: '#D3E4E7',
      track: '#D3E4E7', accent: '#3C8C99', onAccent: '#FFFFFF', word: '#D7ECEF', phrase: '#3C8C99',
      grammar: '#C7834F', correct: '#2F7D5B', wrong: '#B5523B', gold: '#C7834F',
    },
  },
  {
    id: 'peach',
    name: 'Peach dusk',
    tokens: {
      bg: '#FBF1EC', surface: '#FFFFFF', text: '#3E2A35', muted: '#8A6E77', border: '#F1DDD4',
      track: '#F1DDD4', accent: '#D27A5C', onAccent: '#FFFFFF', word: '#FBE0D3', phrase: '#D27A5C',
      grammar: '#7E5A9B', correct: '#3F7D3A', wrong: '#B23A3A', gold: '#D27A5C',
    },
  },
  {
    id: 'lofi',
    name: 'Lo-fi night',
    dark: true,
    tokens: {
      bg: '#1B1F33', surface: '#262B45', text: '#ECEAF7', muted: '#9A9CB8', border: '#343A5C',
      track: '#343A5C', accent: '#B8A6F2', onAccent: '#1B1F33', word: '#3A3560', phrase: '#B8A6F2',
      grammar: '#F2C27B', correct: '#7FD1A0', wrong: '#F29A8A', gold: '#F2C27B',
    },
  },
]

export const DEFAULT_THEME = 'matcha'

export function applyTheme(id: string) {
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0]
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${key}`, value)
  }
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens.bg)
}
