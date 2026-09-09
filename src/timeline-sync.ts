const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
const PX_PER_SECOND = 70
const TIMELINE_LEFT = 120

type Clip = { start?: number; duration?: number; track?: string }
type Project = { id: string; clips?: Clip[]; playhead?: number }

function readProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[]
  } catch {
    return []
  }
}

function currentProject(): Project | null {
  const id = window.location.pathname.match(/\/editor\/([^/]+)/)?.[1]
  if (!id) return null
  return readProjects().find(project => project.id === id) || null
}

function duration(project: Project): number {
  return Math.max(
    0,
    ...(project.clips || []).map(clip => Math.max(0, Number(clip.start) || 0) + Math.max(0, Number(clip.duration) || 0)),
    0,
  )
}

function formatTime(value: number): string {
  const total = Math.max(0, Math.floor(value))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function injectTimelineCss() {
  if (document.getElementById('vfs-dynamic-timeline-css')) return
  const style = document.createElement('style')
  style.id = 'vfs-dynamic-timeline-css'
  style.textContent = `
    .timeline-canvas{min-width:0!important;position:relative!important}
    .timeline-track{min-width:0!important}
    .track-lane{min-width:0!important}
    .time-ruler{min-width:0!important}
    .timeline-scroll{overflow-x:auto!important;overflow-y:auto!important}
  `
  document.head.appendChild(style)
}

function updateTimeline() {
  injectTimelineCss()
  const timeline = document.querySelector('.timeline')
  const canvas = document.querySelector<HTMLElement>('.timeline-canvas')
  if (!timeline || !canvas) return

  const project = currentProject()
  if (!project) return

  const total = duration(project)
  const visibleSeconds = Math.max(total, 0.5)
  const canvasWidth = TIMELINE_LEFT + visibleSeconds * PX_PER_SECOND + 80

  canvas.style.width = `${Math.max(canvasWidth, TIMELINE_LEFT + 80)}px`

  canvas.querySelectorAll<HTMLElement>('.timeline-track').forEach(track => {
    track.style.minWidth = '0'
    track.style.width = `${Math.max(canvasWidth, 1)}px`
  })
  canvas.querySelectorAll<HTMLElement>('.track-lane').forEach(lane => {
    lane.style.minWidth = '0'
    lane.style.width = `${Math.max(canvasWidth, 1)}px`
  })

  const head = timeline.querySelector<HTMLElement>('.timeline-head span')
  if (head) head.textContent = total > 0 ? `${formatTime(total)} projeto` : 'Sem mídia'

  const scale = timeline.querySelector<HTMLElement>('.timeline-controls span')
  if (scale) scale.textContent = total > 0 ? '1s = 70px' : 'Adicione mídia'

  const ruler = timeline.querySelector<HTMLElement>('.time-ruler')
  if (ruler) {
    ruler.style.left = `${TIMELINE_LEFT}px`
    ruler.style.width = `${Math.max(1, canvasWidth - TIMELINE_LEFT)}px`
    const step = total <= 12 ? 1 : total <= 60 ? 5 : 10
    const ticks: number[] = []
    for (let t = 0; t <= total; t += step) ticks.push(Number(t.toFixed(2)))
    if (total > 0 && ticks[ticks.length - 1] !== Number(total.toFixed(2))) ticks.push(Number(total.toFixed(2)))
    const signature = ticks.join(',')
    if (ruler.dataset.signature !== signature) {
      ruler.dataset.signature = signature
      ruler.replaceChildren(...ticks.map(t => {
        const mark = document.createElement('span')
        mark.textContent = formatTime(t)
        mark.style.left = `${t * PX_PER_SECOND}px`
        return mark
      }))
    }
  }

  const playhead = timeline.querySelector<HTMLElement>('.playhead')
  if (playhead) {
    const timeText = playhead.querySelector('span')?.textContent || ''
    const parsed = timeText.includes(':')
      ? (() => { const [minutes, seconds] = timeText.split(':').map(Number); return (minutes || 0) * 60 + (seconds || 0) })()
      : Number(project.playhead || 0)
    const clamped = Math.max(0, Math.min(total, Number.isFinite(parsed) ? parsed : 0))
    playhead.style.left = `${TIMELINE_LEFT + clamped * PX_PER_SECOND}px`
    const label = playhead.querySelector('span')
    if (label) label.textContent = formatTime(clamped)
  }

  const range = document.querySelector<HTMLInputElement>('.playback-bar input[type="range"]')
  if (range) {
    const max = Math.max(total, 0.01)
    range.max = String(max)
    range.value = String(Math.min(Number(range.value) || 0, max))
  }
}

let scheduled = false
function schedule() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    updateTimeline()
  })
}

function init() {
  if (!window.location.pathname.startsWith('/editor/')) return
  injectTimelineCss()
  schedule()

  const bodyObserver = new MutationObserver(schedule)
  bodyObserver.observe(document.body, { childList: true, subtree: true })

  document.addEventListener('input', schedule, true)
  document.addEventListener('click', schedule, true)
  window.addEventListener('storage', schedule)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
