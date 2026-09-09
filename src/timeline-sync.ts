const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
const DEFAULT_PX_PER_SECOND = 70
const TIMELINE_LEFT = 120

type Clip = { id?: string; start?: number; duration?: number; track?: string; lane?: number }
type Project = { id: string; clips?: Clip[]; playhead?: number }
type DragState = { clipId: string; start: number; lane: number; active: boolean }
type AppWindow = Window & { __vfsSyncTimeline?: () => void }

let dragState: DragState | null = null

function readProjects(): Project[] {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[] } catch { return [] }
}
function currentProject(): Project | null {
  const id = window.location.pathname.match(/\/editor\/([^/]+)/)?.[1]
  return id ? readProjects().find(project => project.id === id) || null : null
}
function duration(project: Project): number {
  return Math.max(0, ...(project.clips || []).map(c => Math.max(0, Number(c.start) || 0) + Math.max(0, Number(c.duration) || 0)), 0)
}
function pxPerSecond(): number {
  const timeline = document.querySelector<HTMLElement>('.timeline')
  const value = Number(timeline?.dataset.vfsScale)
  return Number.isFinite(value) ? Math.max(35, Math.min(140, value)) : DEFAULT_PX_PER_SECOND
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
    .timeline-scroll{overflow-x:auto!important;overflow-y:auto!important;overscroll-behavior:contain}
    .timeline-clip{touch-action:none;user-select:none}
    .timeline-clip.vfs-dragging{opacity:.82;z-index:50;cursor:grabbing}
  `
  document.head.appendChild(style)
}
function syncClipData(project: Project) {
  const tracks = Array.from(document.querySelectorAll<HTMLElement>('.timeline-track'))
  tracks.forEach((track, trackIndex) => {
    const isAudio = track.querySelector('.track-label')?.textContent?.toLowerCase().includes('áudio')
    const lane = isAudio ? 0 : trackIndex
    const clips = (project.clips || []).filter(c => c.track === (isAudio ? 'audio' : 'video') && (isAudio || (c.lane ?? 0) === lane))
    track.querySelectorAll<HTMLElement>('.timeline-clip').forEach((element, index) => {
      const clip = clips[index]
      if (!clip?.id) return
      element.dataset.vfsClipId = clip.id
      element.dataset.vfsTrack = clip.track || 'video'
      element.dataset.vfsLane = String(clip.lane ?? 0)
    })
  })
}
function persistDraggedClip() {
  if (!dragState) return
  const project = currentProject()
  if (!project) return
  const next = readProjects()
  const saved = next.find(p => p.id === project.id)
  if (!saved) return
  saved.clips = (saved.clips || []).map(c => c.id === dragState?.clipId
    ? { ...c, start: Number(Math.max(0, dragState.start).toFixed(2)), lane: Math.max(0, Math.min(2, dragState.lane)) }
    : c)
  saved.updatedAt = new Date().toISOString()
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(next))
}
function beginDrag(event: PointerEvent, element: HTMLElement) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
  const project = currentProject()
  const clipId = element.dataset.vfsClipId
  if (!project || !clipId) return
  const clip = project.clips?.find(c => c.id === clipId)
  if (!clip || clip.track !== 'video') return
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
  dragState = { clipId, start: Number(clip.start) || 0, lane: Math.max(0, Math.min(2, Number(clip.lane) || 0)), active: true }
  element.setPointerCapture?.(event.pointerId)
  element.classList.add('vfs-dragging')
}
function moveDrag(event: PointerEvent) {
  if (!dragState?.active) return
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
  const canvas = document.querySelector<HTMLElement>('.timeline-canvas')
  const project = currentProject()
  if (!canvas || !project) return
  const pps = pxPerSecond()
  const scroll = canvas.parentElement
  const rect = canvas.getBoundingClientRect()
  dragState.start = Math.max(0, Number(((event.clientX - rect.left + (scroll?.scrollLeft ?? 0) - TIMELINE_LEFT) / pps).toFixed(2)))
  const lanes = Array.from(document.querySelectorAll<HTMLElement>('.timeline-track'))
    .filter(t => !(t.querySelector('.track-label')?.textContent || '').toLowerCase().includes('áudio'))
    .map(t => t.querySelector<HTMLElement>('.track-lane')).filter(Boolean) as HTMLElement[]
  if (!lanes.length) return
  let bestLane = dragState.lane; let bestDistance = Infinity
  lanes.forEach((lane, index) => { const r = lane.getBoundingClientRect(); const d = Math.abs(event.clientY - (r.top + r.height / 2)); if (d < bestDistance) { bestDistance = d; bestLane = index } })
  dragState.lane = Math.max(0, Math.min(2, bestLane))
  const clipEl = document.querySelector<HTMLElement>(`.timeline-clip[data-vfs-clip-id="${CSS.escape(dragState.clipId)}"]`)
  if (clipEl) {
    clipEl.style.left = `${dragState.start * pps}px`
    clipEl.dataset.vfsLane = String(dragState.lane)
    const target = lanes[dragState.lane]
    if (target && clipEl.parentElement !== target) target.appendChild(clipEl)
  }
}
function endDrag(event?: PointerEvent) {
  if (!dragState?.active) return
  event?.preventDefault(); event?.stopPropagation(); event?.stopImmediatePropagation()
  const clipEl = document.querySelector<HTMLElement>(`.timeline-clip[data-vfs-clip-id="${CSS.escape(dragState.clipId)}"]`)
  clipEl?.classList.remove('vfs-dragging')
  persistDraggedClip(); dragState = null; window.location.reload()
}
function bindDragHandlers() {
  if (document.documentElement.dataset.vfsDragBound === '1') return
  document.documentElement.dataset.vfsDragBound = '1'
  document.addEventListener('pointerdown', e => { const el = (e.target as HTMLElement).closest<HTMLElement>('.timeline-clip'); if (el) beginDrag(e, el) }, true)
  document.addEventListener('pointermove', moveDrag, true)
  document.addEventListener('pointerup', endDrag, true)
  document.addEventListener('pointercancel', endDrag, true)
}
function bindTimelineSeek() {
  if (document.documentElement.dataset.vfsTimelineSeekBound === '1') return
  document.documentElement.dataset.vfsTimelineSeekBound = '1'
  document.addEventListener('pointerdown', event => {
    const target = event.target as HTMLElement
    const scroll = target.closest<HTMLElement>('.timeline-scroll')
    if (!scroll || target.closest('.timeline-clip') || target.closest('.playhead')) return
    const canvas = scroll.querySelector<HTMLElement>('.timeline-canvas')
    const range = document.querySelector<HTMLInputElement>('.playback-bar input[type="range"]')
    if (!canvas || !range) return
    const rect = canvas.getBoundingClientRect(); const pps = pxPerSecond()
    const value = Math.max(0, Math.min(Number(range.max) || 0, (event.clientX - rect.left + scroll.scrollLeft - TIMELINE_LEFT) / pps))
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
    range.value = String(value); range.dispatchEvent(new Event('input', { bubbles: true }))
  }, true)
}
function updateTimeline() {
  injectTimelineCss()
  const timeline = document.querySelector<HTMLElement>('.timeline')
  const canvas = document.querySelector<HTMLElement>('.timeline-canvas')
  const project = currentProject()
  if (!timeline || !canvas || !project) return
  const pps = pxPerSecond()
  timeline.dataset.vfsScale = String(pps)
  if (!dragState) syncClipData(project)
  const total = duration(project)
  const canvasWidth = TIMELINE_LEFT + Math.max(total, .5) * pps + 80
  canvas.style.width = `${Math.max(canvasWidth, TIMELINE_LEFT + 80)}px`
  canvas.querySelectorAll<HTMLElement>('.timeline-track').forEach(t => { t.style.minWidth = '0'; t.style.width = `${canvasWidth}px` })
  canvas.querySelectorAll<HTMLElement>('.track-lane').forEach(l => { l.style.minWidth = '0'; l.style.width = `${canvasWidth}px` })
  if (!dragState) canvas.querySelectorAll<HTMLElement>('.timeline-clip').forEach(el => {
    const projectClip = (project.clips || []).find(c => c.id === el.dataset.vfsClipId)
    if (!projectClip) return
    el.style.left = `${Math.max(0, Number(projectClip.start) || 0) * pps}px`
    el.style.width = `${Math.max(46, (Math.max(.01, Number(projectClip.duration) || 0) * pps))}px`
  })
  const head = timeline.querySelector<HTMLElement>('.timeline-head span'); if (head) head.textContent = total > 0 ? `${formatTime(total)} projeto` : 'Sem mídia'
  const scale = timeline.querySelector<HTMLElement>('.timeline-controls > span'); if (scale) scale.textContent = total > 0 ? `1s = ${Math.round(pps)}px` : 'Adicione mídia'
  const ruler = timeline.querySelector<HTMLElement>('.time-ruler')
  if (ruler) {
    ruler.style.left = `${TIMELINE_LEFT}px`; ruler.style.width = `${Math.max(1, canvasWidth - TIMELINE_LEFT)}px`
    const step = total <= 12 ? 1 : total <= 60 ? 5 : 10; const ticks: number[] = []
    for (let t = 0; t <= total; t += step) ticks.push(Number(t.toFixed(2)))
    if (total > 0 && ticks[ticks.length - 1] !== Number(total.toFixed(2))) ticks.push(Number(total.toFixed(2)))
    const signature = `${pps}|${ticks.join(',')}`
    if (ruler.dataset.signature !== signature) {
      ruler.dataset.signature = signature
      ruler.replaceChildren(...ticks.map(t => { const mark = document.createElement('span'); mark.textContent = formatTime(t); mark.style.left = `${t * pps}px`; return mark }))
    }
  }
  const playhead = timeline.querySelector<HTMLElement>('.playhead')
  if (playhead) {
    const timeText = playhead.querySelector('span')?.textContent || ''
    const parsed = timeText.includes(':') ? (() => { const [m,s] = timeText.split(':').map(Number); return (m || 0) * 60 + (s || 0) })() : Number(project.playhead || 0)
    const clamped = Math.max(0, Math.min(total, Number.isFinite(parsed) ? parsed : 0))
    playhead.style.left = `${TIMELINE_LEFT + clamped * pps}px`
    const label = playhead.querySelector('span'); if (label) label.textContent = formatTime(clamped)
  }
  const range = document.querySelector<HTMLInputElement>('.playback-bar input[type="range"]')
  if (range) { range.max = String(Math.max(total, .01)); range.value = String(Math.min(Number(range.value) || 0, Math.max(total, .01))) }
}
let scheduled = false
function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; updateTimeline() }) }
;(window as AppWindow).__vfsSyncTimeline = schedule
function init() {
  if (!window.location.pathname.startsWith('/editor/')) return
  injectTimelineCss(); bindDragHandlers(); bindTimelineSeek(); schedule()
  const observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('input', schedule, true); window.addEventListener('storage', schedule)
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init()
