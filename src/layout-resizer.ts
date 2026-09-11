const STORAGE_KEY = 'meu-video-studio-ai:layout:v1'

type LayoutState = { library: number; inspector: number; timeline: number }
const DEFAULT: LayoutState = { library: 270, inspector: 300, timeline: 300 }

function load(): LayoutState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      library: clamp(Number(parsed.library) || DEFAULT.library, 220, 420),
      inspector: clamp(Number(parsed.inspector) || DEFAULT.inspector, 260, 420),
      timeline: clamp(Number(parsed.timeline) || DEFAULT.timeline, 190, 520),
    }
  } catch { return { ...DEFAULT } }
}
function save(state: LayoutState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)) }

function addHandle(parent: HTMLElement, className: string) {
  let el = parent.querySelector<HTMLDivElement>(`.${className}`)
  if (el) return el
  el = document.createElement('div')
  el.className = className
  parent.appendChild(el)
  return el
}

function init() {
  const workspace = document.querySelector<HTMLElement>('.workspace')
  const editor = document.querySelector<HTMLElement>('.editor')
  if (!workspace || !editor || workspace.dataset.layoutResizer === '1') return !!workspace && !!editor
  workspace.dataset.layoutResizer = '1'

  const state = load()
  const libraryHandle = addHandle(workspace, 'layout-resize-library')
  const inspectorHandle = addHandle(workspace, 'layout-resize-inspector')
  const timelineHandle = addHandle(editor, 'layout-resize-timeline')

  const apply = () => {
    workspace.style.gridTemplateColumns = `58px ${state.library}px minmax(460px,1fr) ${state.inspector}px`
    editor.style.gridTemplateRows = `40px minmax(220px,1fr) 54px ${state.timeline}px`
    libraryHandle.style.left = `${58 + state.library - 4}px`
    inspectorHandle.style.right = `${state.inspector - 4}px`
    timelineHandle.style.bottom = `${state.timeline - 4}px`
  }
  apply()

  const drag = (start: PointerEvent, move: (event: PointerEvent) => void, done: () => void) => {
    start.preventDefault()
    document.body.classList.add('layout-resizing')
    const onMove = (event: PointerEvent) => move(event)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('layout-resizing')
      done()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  libraryHandle.addEventListener('pointerdown', (event) => {
    const start = event as PointerEvent
    const startX = start.clientX
    const initial = state.library
    drag(start, (e) => { state.library = clamp(initial + e.clientX - startX, 220, 420); apply() }, () => save(state))
  })

  inspectorHandle.addEventListener('pointerdown', (event) => {
    const start = event as PointerEvent
    const startX = start.clientX
    const initial = state.inspector
    drag(start, (e) => { state.inspector = clamp(initial - (e.clientX - startX), 260, 420); apply() }, () => save(state))
  })

  timelineHandle.addEventListener('pointerdown', (event) => {
    const start = event as PointerEvent
    const startY = start.clientY
    const initial = state.timeline
    drag(start, (e) => { state.timeline = clamp(initial - (e.clientY - startY), 190, 520); apply() }, () => save(state))
  })

  window.addEventListener('resize', apply)
  return true
}

const start = () => {
  if (init()) return
  const timer = window.setInterval(() => { if (init()) window.clearInterval(timer) }, 60)
  window.setTimeout(() => window.clearInterval(timer), 5000)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
else start()
