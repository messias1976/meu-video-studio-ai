const STORAGE_KEY = 'meu-video-studio-ai:layout:v1'

type LayoutState = {
  library: number
  inspector: number
  timeline: number
}

const DEFAULT: LayoutState = { library: 270, inspector: 300, timeline: 300 }

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw)
    return {
      library: clamp(Number(parsed.library) || DEFAULT.library, 220, 420),
      inspector: clamp(Number(parsed.inspector) || DEFAULT.inspector, 260, 420),
      timeline: clamp(Number(parsed.timeline) || DEFAULT.timeline, 190, 520),
    }
  } catch {
    return DEFAULT
  }
}

function save(state: LayoutState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function applyLayout(workspace: HTMLElement, editor: HTMLElement, state: LayoutState) {
  workspace.style.gridTemplateColumns = `58px ${state.library}px minmax(460px, 1fr) ${state.inspector}px`
  editor.style.gridTemplateRows = `40px minmax(220px, 1fr) 54px ${state.timeline}px`
}

function addHandle(className: string, parent: HTMLElement) {
  if (parent.querySelector(`.${className}`)) return parent.querySelector(`.${className}`) as HTMLDivElement
  const el = document.createElement('div')
  el.className = className
  parent.appendChild(el)
  return el
}

function init() {
  const workspace = document.querySelector('.workspace') as HTMLElement | null
  const editor = document.querySelector('.editor') as HTMLElement | null
  if (!workspace || !editor) return false

  const state = load()
  applyLayout(workspace, editor, state)

  const libraryHandle = addHandle('layout-resize-library', workspace)
  const inspectorHandle = addHandle('layout-resize-inspector', workspace)
  const timelineHandle = addHandle('layout-resize-timeline', editor)

  function pointerDrag(handle: HTMLElement, move: (event: PointerEvent) => void, end: () => void) {
    const onMove = (event: PointerEvent) => move(event)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      end()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    handle.setPointerCapture?.(0)
  }

  libraryHandle.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const startX = (event as PointerEvent).clientX
    const startWidth = state.library
    pointerDrag(libraryHandle, (move) => {
      const next = clamp(startWidth + ((move.clientX - startX) * 1), 220, 420)
      state.library = next
      applyLayout(workspace, editor, state)
    }, () => save(state))
  })

  inspectorHandle.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const startX = (event as PointerEvent).clientX
    const startWidth = state.inspector
    pointerDrag(inspectorHandle, (move) => {
      const next = clamp(startWidth - (move.clientX - startX), 260, 420)
      state.inspector = next
      applyLayout(workspace, editor, state)
    }, () => save(state))
  })

  timelineHandle.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const startY = (event as PointerEvent).clientY
    const startHeight = state.timeline
    pointerDrag(timelineHandle, (move) => {
      const next = clamp(startHeight - (move.clientY - startY), 190, 520)
      state.timeline = next
      applyLayout(workspace, editor, state)
    }, () => save(state))
  })

  const observer = new MutationObserver(() => {
    applyLayout(workspace, editor, state)
  })
  observer.observe(workspace, { childList: true })
  return true
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const wait = window.setInterval(() => {
      if (init()) window.clearInterval(wait)
    }, 50)
    window.setTimeout(() => window.clearInterval(wait), 5000)
  }, { once: true })
} else {
  const wait = window.setInterval(() => {
    if (init()) window.clearInterval(wait)
  }, 50)
  window.setTimeout(() => window.clearInterval(wait), 5000)
}
