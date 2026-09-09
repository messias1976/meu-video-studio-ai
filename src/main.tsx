import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './editor-controls.css'
import './phase5.js'
import './timeline-sync.ts'
import './editor-view-controls.ts'
import './transform-panel-drag.ts'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
