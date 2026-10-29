import type { ReactNode } from 'react'

const PATHS: Record<string, string> = {
  leaf: 'M5 19c0-8 5-14 14-14 0 9-6 14-14 14z M5 19l7-7',
  sprout: 'M12 20v-8 M12 12c0-4-3-6-7-6 0 4 3 6 7 6z M12 14c0-4 3-6 7-6 0 4-3 6-7 6z',
  flame: 'M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 2 4 1-2 1-5 1-8z',
  cake: 'M4 20h16v-7H4z M4 16c2 1.2 4 1.2 6 0s4-1.2 6 0 3 1.2 4 0 M12 13V9 M12 7a1.2 1.2 0 0 1 0-3 1.2 1.2 0 0 1 0 3',
  cup: 'M7 7h10l-1.5 13h-7z M6 7h12 M13 7l2-4 M8 11h8',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z M7.5 11.5h.01 M10 7.5h.01 M15 7.5h.01',
  gift: 'M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7C10 3 6 4 7.5 7 M12 7c2-4 6-3 4.5 0',
  volume: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
  back: 'M15 5l-7 7 7 7',
  sliders: 'M4 7h10 M18 7h2 M16 5v4 M4 17h4 M12 17h8 M10 15v4',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  check: 'M5 12l5 5 9-10',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4',
  book: 'M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M19 19v2H6',
  flag: 'M5 21V4 M5 4h12l-2.5 4L17 12H5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.gift} />
    </svg>
  )
}

export function TopBar({ title, onBack, right }: { title?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="返回"><Icon name="back" /></button>
      ) : <span />}
      <span className="topbar-title">{title}</span>
      {right ?? <span />}
    </div>
  )
}

export function Bar({ value }: { value: number }) {
  return (
    <div className="bar"><div style={{ width: `${Math.round(value * 100)}%` }} /></div>
  )
}
