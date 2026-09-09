const VIEW_KEY = 'meu-video-studio-ai:editor-view:v1'
const DEFAULT_TIMELINE_SCALE = 70
const DEFAULT_MEDIA_SCALE = 100

type ViewState = { timelinePxPerSecond: number; mediaScale: number }
type AppWindow = Window & { __vfsSyncTimeline?: () => void }

function projectId() {
  return window.location.pathname.match(/\/editor\/([^/]+)/)?.[1] || 'default'
}

function readAll(): Record<string, Partial<ViewState>> {
  try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') as Record<string, Partial<ViewState>> } catch { return {} }
}

function readState(): ViewState {
  const saved = readAll()[projectId()] || {}
  return {
    timelinePxPerSecond: Math.max(35, Math.min(140, Number(saved.timelinePxPerSecond) || DEFAULT_TIMELINE_SCALE)),
    mediaScale: Math.max(50, Math.min(180, Number(saved.mediaScale) || DEFAULT_MEDIA_SCALE)),
  }
}

function saveState(patch: Partial<ViewState>) {
  const all = readAll()
  all[projectId()] = { ...all[projectId()], ...patch }
  localStorage.setItem(VIEW_KEY, JSON.stringify(all))
}

function button(text: string, className = 'vfs-control-step') {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = text
  el.className = className
  return el
}

function range(min: string, max: string, value: string) {
  const el = document.createElement('input')
  el.type = 'range'
  el.min = min
  el.max = max
  el.step = '1'
  el.value = value
  el.className = 'vfs-control-range'
  return el
}

function makeScaleControl(label: string, min: number, max: number, value: number, onChange: (value: number) => void) {
  const wrap = document.createElement('div')
  wrap.className = 'vfs-control-group'
  const title = document.createElement('span')
  title.className = 'vfs-control-label'
  title.textContent = label
  const minus = button('−')
  const input = range(String(min), String(max), String(value))
  const valueLabel = document.createElement('span')
  valueLabel.className = 'vfs-control-value'
  const plus = button('+')
  const update = (next: number) => {
    const safe = Math.max(min, Math.min(max, next))
    input.value = String(safe)
    valueLabel.textContent = `${safe}%`
    onChange(safe)
  }
  valueLabel.textContent = `${value}%`
  minus.addEventListener('click', () => update(Number(input.value) - (label === 'Timeline' ? 10 : 5)))
  plus.addEventListener('click', () => update(Number(input.value) + (label === 'Timeline' ? 10 : 5)))
  input.addEventListener('input', () => update(Number(input.value)))
  wrap.append(title, minus, input, valueLabel, plus)
  return wrap
}

function applyMediaScale(value: number) {
  const viewport = document.querySelector<HTMLElement>('.preview-viewport')
  if (!viewport) return
  viewport.dataset.vfsMediaScale = String(value)
  const media = viewport.querySelector<HTMLElement>('.video-stage video, .video-stage img')
  if (!media) return
  media.style.transform = `scale(${value / 100})`
  media.style.transformOrigin = 'center center'
  media.style.maxWidth = '100%'
  media.style.maxHeight = '100%'
}

function mount() {
  if (!window.location.pathname.startsWith('/editor/')) return
  const state = readState()
  const timeline = document.querySelector<HTMLElement>('.timeline')
  if (timeline && !timeline.querySelector('#vfs-timeline-scale')) {
    const control = makeScaleControl('Timeline', 35, 140, Math.round((state.timelinePxPerSecond / DEFAULT_TIMELINE_SCALE) * 100), percent => {
      const px = Math.round(DEFAULT_TIMELINE_SCALE * percent / 100)
      timeline.dataset.vfsScale = String(px)
      saveState({ timelinePxPerSecond: px })
      ;(window as AppWindow).__vfsSyncTimeline?.()
    })
    control.id = 'vfs-timeline-scale'
    timeline.querySelector('.timeline-controls')?.appendChild(control)
  }

  const toolbar = document.querySelector<HTMLElement>('.canvas-toolbar')
  if (toolbar && !toolbar.querySelector('#vfs-media-scale')) {
    const control = makeScaleControl('Mídia', 50, 180, state.mediaScale, value => {
      saveState({ mediaScale: value })
      applyMediaScale(value)
    })
    control.id = 'vfs-media-scale'
    toolbar.appendChild(control)
  }
  applyMediaScale(state.mediaScale)
}

let scheduled = false
function scheduleMount() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => { scheduled = false; mount() })
}

function init() {
  if (!window.location.pathname.startsWith('/editor/')) return
  scheduleMount()
  const observer = new MutationObserver(scheduleMount)
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
else init()
