const POSITION_KEY = 'meu-video-studio-ai:transform-panel-position:v1'

type Point = { left: number; top: number }

let boundPanel: HTMLElement | null = null
let cleanupDrag: (() => void) | null = null

function readPosition(): Point | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Point>
    if (!Number.isFinite(value.left) || !Number.isFinite(value.top)) return null
    return { left: Number(value.left), top: Number(value.top) }
  } catch {
    return null
  }
}

function savePosition(panel: HTMLElement) {
  const rect = panel.getBoundingClientRect()
  localStorage.setItem(POSITION_KEY, JSON.stringify({
    left: Math.round(rect.left),
    top: Math.round(rect.top),
  }))
}

function clampPosition(panel: HTMLElement, left: number, top: number): Point {
  const margin = 8
  const width = panel.offsetWidth || 230
  const height = panel.offsetHeight || 220
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const maxTop = Math.max(margin, window.innerHeight - height - margin)
  return {
    left: Math.max(margin, Math.min(maxLeft, left)),
    top: Math.max(margin, Math.min(maxTop, top)),
  }
}

function makeMovable(panel: HTMLElement) {
  if (panel.dataset.vfsMovable === '1') return
  panel.dataset.vfsMovable = '1'
  panel.style.cursor = 'default'

  const header = panel.querySelector<HTMLElement>('.vfs-transform-tabs')
  if (!header) return

  header.style.cursor = 'grab'
  header.style.userSelect = 'none'
  header.title = 'Arraste para mover o painel'

  const saved = readPosition()
  if (saved) {
    const next = clampPosition(panel, saved.left, saved.top)
    panel.style.left = `${next.left}px`
    panel.style.top = `${next.top}px`
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, select, textarea')) return

    event.preventDefault()
    event.stopPropagation()

    const rect = panel.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const originLeft = rect.left
    const originTop = rect.top

    header.style.cursor = 'grabbing'

    const onMove = (moveEvent: PointerEvent) => {
      const next = clampPosition(
        panel,
        originLeft + moveEvent.clientX - startX,
        originTop + moveEvent.clientY - startY,
      )
      panel.style.left = `${next.left}px`
      panel.style.top = `${next.top}px`
    }

    const onUp = () => {
      header.style.cursor = 'grab'
      savePosition(panel)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }

    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
  }

  header.addEventListener('pointerdown', onPointerDown, true)

  const onResize = () => {
    const current = readPosition()
    if (!current) return
    const next = clampPosition(panel, current.left, current.top)
    panel.style.left = `${next.left}px`
    panel.style.top = `${next.top}px`
    savePosition(panel)
  }
  window.addEventListener('resize', onResize)

  cleanupDrag = () => {
    header.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('resize', onResize)
  }
}

function mount() {
  const panel = document.querySelector<HTMLElement>('.vfs-transform-panel')
  if (!panel) return false
  if (boundPanel !== panel) {
    cleanupDrag?.()
    boundPanel = panel
    makeMovable(panel)
  }
  return true
}

function init() {
  if (mount()) return
  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
