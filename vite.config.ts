import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { tutorApi } from './server/tutorApi.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Tutor mode only exists where this server runs (your computer), never in
    // the static build students download.
    tutorApi(loadEnv(mode, process.cwd(), '')),
    VitePWA({
      registerType: 'autoUpdate',
      // Content packs are fetched fresh and stored in IndexedDB, so the
      // service worker only needs to cache the app shell.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Joyful Harvest 歡呼收割',
        short_name: '歡呼收割',
        description: 'One paragraph a day: words, reading, and review — works offline.',
        lang: 'zh-Hant-TW',
        theme_color: '#F4F1E8',
        background_color: '#F4F1E8',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
}))
