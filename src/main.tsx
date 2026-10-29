import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Tutor mode lives at /#tutor and is loaded only there, so students never download it.
const TutorApp = lazy(() => import('./tutor/TutorApp.tsx'))
const isTutor = location.hash === '#tutor'
window.addEventListener('hashchange', () => {
  if ((location.hash === '#tutor') !== isTutor) location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTutor ? <Suspense><TutorApp /></Suspense> : <App />}
  </StrictMode>,
)
