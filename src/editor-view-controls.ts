const VIEW_KEY = 'meu-video-studio-ai:editor-view:v2'
const DEFAULT_TIMELINE_SCALE = 70

type ViewState = {
  timelinePxPerSecond: number
  mediaScale: number
  mediaX: number
  mediaY: number
  rotation: number
  flipX: boolean
}
type AppWindow = Window & { __vfsSyncTimeline?: () => void }

const defaults: ViewState = {
  timelinePxPerSecond: DEFAULT_TIMELINE_SCALE,
  mediaScale: 100,
  mediaX: 0,
  mediaY: 0,
  rotation: 0,
  flipX: false,
}

let media: HTMLVideoElement | HTMLImageElement | null = null
let stage: HTMLElement | null = null
let box: HTMLElement | null = null
let panel: HTMLElement | null = null
let currentAssetKey = ''
let state: ViewState = { ...defaults }
let resizeState: { direction: string; startX: number; startY: number; startScale: number; width: number; height: number } | null = null
let dragState: { startX: number; startY: number; x: number; y: number } | null = null
let observer: MutationObserver | null = null
let mountScheduled = false

function projectId() {
  return window.location.pathname.match(/\/editor\/([^/]+)/)?.[1] || 'default'
}

function readAll(): Record<string, Partial<ViewState>> {
  try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') as Record<string, Partial<ViewState>> } catch { return {} }
}

function assetKey() {
  const src = document.querySelector<HTMLVideoElement | HTMLImageElement>('.video-stage video, .video-stage img')?.getAttribute('src') || ''
  return `${projectId()}::${src}`
}

function readState(): ViewState {
  const saved = readAll()[assetKey()] || {}
  return {
    timelinePxPerSecond: Math.max(35, Math.min(140, Number(saved.timelinePxPerSecond) || defaults.timelinePxPerSecond)),
    mediaScale: Math.max(25, Math.min(400, Number(saved.mediaScale) || defaults.mediaScale)),
    mediaX: Number(saved.mediaX) || 0,
    mediaY: Number(saved.mediaY) || 0,
    rotation: Number(saved.rotation) || 0,
    flipX: Boolean(saved.flipX),
  }
}

function saveState(patch: Partial<ViewState>) {
  const key = assetKey()
  if (!key) return
  const all = readAll()
  all[key] = { ...all[key], ...patch }
  localStorage.setItem(VIEW_KEY, JSON.stringify(all))
}

function injectStyles() {
  if (document.getElementById('vfs-transform-styles')) return
  const style = document.createElement('style')
  style.id = 'vfs-transform-styles'
  style.textContent = `
    .preview-viewport{position:relative!important;overflow:hidden!important}
    .video-stage{position:relative!important}
    .vfs-transform-layer{position:absolute;inset:0;z-index:20;pointer-events:none;overflow:visible}
    .vfs-transform-box{position:absolute;left:50%;top:50%;width:100%;height:100%;border:1.5px solid #f2c94c;box-sizing:border-box;transform-origin:center center;pointer-events:none}
    .vfs-transform-handle{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;border:1px solid #d7d7d7;box-sizing:border-box;pointer-events:auto;touch-action:none;box-shadow:0 1px 5px rgba(0,0,0,.35)}
    .vfs-transform-handle.nw{left:0;top:0;cursor:nwse-resize}.vfs-transform-handle.n{left:50%;top:0;cursor:ns-resize}.vfs-transform-handle.ne{left:100%;top:0;cursor:nesw-resize}
    .vfs-transform-handle.e{left:100%;top:50%;cursor:ew-resize}.vfs-transform-handle.se{left:100%;top:100%;cursor:nwse-resize}.vfs-transform-handle.s{left:50%;top:100%;cursor:ns-resize}
    .vfs-transform-handle.sw{left:0;top:100%;cursor:nesw-resize}.vfs-transform-handle.w{left:0;top:50%;cursor:ew-resize}
    .vfs-rotate-line{position:absolute;left:50%;top:-34px;height:26px;border-left:1px solid #f2c94c;pointer-events:none}.vfs-rotate-line:after{content:'';position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#fff;border:1px solid #ddd}
    .vfs-transform-panel{position:absolute;left:14px;top:14px;width:230px;z-index:50;padding:14px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(18,18,23,.95);box-shadow:0 14px 35px rgba(0,0,0,.35);backdrop-filter:blur(12px);display:none;color:#fff}
    .vfs-transform-panel.visible{display:block}.vfs-transform-tabs{display:flex;gap:18px;margin:-14px -14px 14px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.09)}
    .vfs-transform-tabs button{border:0;background:none;color:#8e8f97;font-size:12px;font-weight:600;cursor:pointer;padding:0}.vfs-transform-tabs button.active{color:#fff}
    .vfs-t-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.vfs-t-actions button,.vfs-t-row button{min-height:34px;border:0;border-radius:8px;background:#2a2a31;color:#ddd;cursor:pointer;font-size:11px}.vfs-t-actions button:hover,.vfs-t-row button:hover{background:#35353d;color:#fff}
    .vfs-t-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.vfs-t-range{margin-top:12px}.vfs-t-range label{display:flex;justify-content:space-between;color:#8d8e96;font-size:10px;margin-bottom:6px}.vfs-t-range input{width:100%}.vfs-t-value{color:#fff}.vfs-t-muted{margin-top:10px;color:#73747d;font-size:10px;line-height:1.45}
  `
  document.head.appendChild(style)
}

function button(text: string, className = 'vfs-control-step') {
  const el = document.createElement('button'); el.type = 'button'; el.textContent = text; el.className = className; return el
}
function range(min: string, max: string, value: string) {
  const el = document.createElement('input'); el.type = 'range'; el.min = min; el.max = max; el.step = '1'; el.value = value; el.className = 'vfs-control-range'; return el
}
function makeScaleControl(label: string, min: number, max: number, value: number, step: number, onChange: (value: number) => void) {
  const wrap = document.createElement('div'); wrap.className = 'vfs-control-group'
  const title = document.createElement('span'); title.className = 'vfs-control-label'; title.textContent = label
  const minus = button('−'); const input = range(String(min), String(max), String(value)); const valueLabel = document.createElement('span'); valueLabel.className = 'vfs-control-value'; const plus = button('+')
  const update = (next: number) => { const safe = Math.max(min, Math.min(max, next)); input.value = String(safe); valueLabel.textContent = `${safe}%`; onChange(safe) }
  valueLabel.textContent = `${value}%`; minus.addEventListener('click', () => update(Number(input.value) - step)); plus.addEventListener('click', () => update(Number(input.value) + step)); input.addEventListener('input', () => update(Number(input.value)))
  wrap.append(title, minus, input, valueLabel, plus); return wrap
}

function applyMedia() {
  if (!media) return
  const flip = state.flipX ? ' scaleX(-1)' : ''
  media.style.transformOrigin = 'center center'
  media.style.transform = `translate3d(${state.mediaX}px, ${state.mediaY}px, 0) scale(${Math.abs(state.mediaScale) / 100}) rotate(${state.rotation}deg)${flip}`
  const scaleLabel = panel?.querySelector<HTMLElement>('[data-media-scale]'); if (scaleLabel) scaleLabel.textContent = `${Math.round(state.mediaScale)}%`
  const rotLabel = panel?.querySelector<HTMLElement>('[data-rotation]'); if (rotLabel) rotLabel.textContent = `${Math.round(state.rotation)}°`
  const scaleInput = panel?.querySelector<HTMLInputElement>('[data-scale]'); if (scaleInput) scaleInput.value = String(Math.round(state.mediaScale))
  const rotationInput = panel?.querySelector<HTMLInputElement>('[data-rotation-input]'); if (rotationInput) rotationInput.value = String(Math.round(state.rotation))
  if (box) box.style.transform = `translate(-50%,-50%) translate3d(${state.mediaX}px, ${state.mediaY}px, 0) scale(${Math.abs(state.mediaScale) / 100}) rotate(${state.rotation}deg)`
}
function setTransform(patch: Partial<ViewState>) { state = { ...state, ...patch }; saveState(patch); applyMedia() }
function resetMedia() { setTransform({ ...defaults }) }
function fitMedia() { setTransform({ mediaScale: 100, mediaX: 0, mediaY: 0, rotation: 0, flipX: false }) }
function fillMedia() { setTransform({ mediaScale: 120, mediaX: 0, mediaY: 0, rotation: 0 }) }
function rotate(delta: number) { setTransform({ rotation: ((state.rotation + delta + 180) % 360) - 180 }) }

function makePanel() {
  if (panel) return
  panel = document.createElement('div'); panel.className = 'vfs-transform-panel'
  panel.innerHTML = `
    <div class="vfs-transform-tabs"><button class="active" data-tab="transform">Transformar</button><button data-tab="adjust">Ajustar</button><button data-tab="crop">Cortar</button></div>
    <div><div class="vfs-t-actions"><button data-fill>Preencher</button><button data-fit>Ajustar</button><button data-reset>Original</button></div>
    <div class="vfs-t-row"><button data-mirror>↔ Espelhar</button><button data-rotate>↻ Girar</button></div>
    <div class="vfs-t-range"><label><span>Escala da mídia</span><span class="vfs-t-value" data-media-scale>100%</span></label><input data-scale type="range" min="25" max="400" value="100"></div>
    <div class="vfs-t-range"><label><span>Rotação</span><span class="vfs-t-value" data-rotation>0°</span></label><input data-rotation-input type="range" min="-180" max="180" value="0"></div>
    <div class="vfs-t-muted">Arraste a imagem ou vídeo para reposicionar. Puxe as alças brancas para aumentar ou reduzir a mídia dentro do frame.</div></div>`
  document.body.appendChild(panel)
  panel.querySelector('[data-fill]')?.addEventListener('click', fillMedia)
  panel.querySelector('[data-fit]')?.addEventListener('click', fitMedia)
  panel.querySelector('[data-reset]')?.addEventListener('click', resetMedia)
  panel.querySelector('[data-mirror]')?.addEventListener('click', () => setTransform({ flipX: !state.flipX }))
  panel.querySelector('[data-rotate]')?.addEventListener('click', () => rotate(90))
  panel.querySelector<HTMLInputElement>('[data-scale]')?.addEventListener('input', e => setTransform({ mediaScale: Number((e.target as HTMLInputElement).value) }))
  panel.querySelector<HTMLInputElement>('[data-rotation-input]')?.addEventListener('input', e => setTransform({ rotation: Number((e.target as HTMLInputElement).value) }))
}

function positionPanel() {
  if (!panel || !stage) return
  const r = stage.getBoundingClientRect(); panel.style.left = `${Math.max(12, r.left - 245)}px`; panel.style.top = `${Math.max(12, r.top)}px`
}

function makeHandles() {
  if (!stage || box) return
  const layer = document.createElement('div'); layer.className = 'vfs-transform-layer'
  box = document.createElement('div'); box.className = 'vfs-transform-box'
  ;['nw','n','ne','e','se','s','sw','w'].forEach(direction => {
    const h = document.createElement('div'); h.className = `vfs-transform-handle ${direction}`
    h.addEventListener('pointerdown', event => {
      if (!stage) return
      const r = stage.getBoundingClientRect()
      resizeState = { direction, startX: event.clientX, startY: event.clientY, startScale: state.mediaScale, width: r.width, height: r.height }
      h.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopPropagation()
    })
    box!.appendChild(h)
  })
  const rot = document.createElement('div'); rot.className = 'vfs-rotate-line'; box.appendChild(rot); layer.appendChild(box); stage.appendChild(layer)
}
function removeHandles() { box?.parentElement?.remove(); box = null }

function handleResize(e: PointerEvent) {
  if (!resizeState) return
  const dx = e.clientX - resizeState.startX; const dy = e.clientY - resizeState.startY
  const horizontal = /[ew]/.test(resizeState.direction); const vertical = /[ns]/.test(resizeState.direction)
  let change = horizontal ? dx : vertical ? dy : (Math.abs(dx) >= Math.abs(dy) ? dx : dy)
  if (/w|n/.test(resizeState.direction)) change = -change
  const delta = change / Math.max(horizontal ? resizeState.width : resizeState.height, 1) * 200
  const next = Math.max(25, Math.min(400, resizeState.startScale + delta))
  state.mediaScale = next; applyMedia()
}
function endResize() { if (resizeState) { saveState({ mediaScale: state.mediaScale }); resizeState = null } }

function startDrag(e: PointerEvent) {
  if (!media || !stage || (e.target as HTMLElement).closest('.vfs-transform-handle')) return
  dragState = { startX: e.clientX, startY: e.clientY, x: state.mediaX, y: state.mediaY }
  const move = (event: PointerEvent) => { if (!dragState) return; state.mediaX = dragState.x + event.clientX - dragState.startX; state.mediaY = dragState.y + event.clientY - dragState.startY; applyMedia() }
  const up = () => { if (dragState) saveState({ mediaX: state.mediaX, mediaY: state.mediaY }); dragState = null; window.removeEventListener('pointermove', move) }
  window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, { once:true }); e.preventDefault(); e.stopPropagation()
}

function mount() {
  injectStyles(); makePanel()
  const nextStage = document.querySelector<HTMLElement>('.video-stage')
  const nextMedia = document.querySelector<HTMLVideoElement | HTMLImageElement>('.video-stage video, .video-stage img')
  if (!nextStage || !nextMedia) { panel?.classList.remove('visible'); removeHandles(); stage = null; media = null; currentAssetKey = ''; return }
  const nextKey = `${projectId()}::${nextMedia.getAttribute('src') || ''}`
  const changed = nextKey !== currentAssetKey || nextStage !== stage || nextMedia !== media
  stage = nextStage; media = nextMedia
  if (changed) { currentAssetKey = nextKey; state = readState(); removeHandles(); makeHandles() }
  panel?.classList.add('visible'); positionPanel(); applyMedia()
  if (media) media.onpointerdown = startDrag
}

function mountControls() {
  const timeline = document.querySelector<HTMLElement>('.timeline')
  if (timeline && !timeline.querySelector('#vfs-timeline-scale')) {
    const saved = readState()
    const control = makeScaleControl('Timeline', 35, 140, Math.round((saved.timelinePxPerSecond / DEFAULT_TIMELINE_SCALE) * 100), 10, percent => {
      const px = Math.round(DEFAULT_TIMELINE_SCALE * percent / 100); timeline.dataset.vfsScale = String(px); saveState({ timelinePxPerSecond: px }); (window as AppWindow).__vfsSyncTimeline?.()
    })
    control.id = 'vfs-timeline-scale'; timeline.querySelector('.timeline-controls')?.appendChild(control)
  }
}

function relevantMutation(mutations: MutationRecord[]) {
  return mutations.some(mutation => {
    if (mutation.type !== 'childList') return false
    const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)]
    return nodes.some(node => {
      if (!(node instanceof Element)) return false
      if (node.matches('.vfs-transform-layer, .vfs-transform-panel, #vfs-timeline-scale')) return false
      return node.matches('.video-stage, .video-stage video, .video-stage img') || Boolean(node.querySelector('.video-stage, .video-stage video, .video-stage img'))
    })
  })
}

function scheduleMount() {
  if (mountScheduled) return
  mountScheduled = true
  requestAnimationFrame(() => {
    mountScheduled = false
    mountControls()
    mount()
  })
}

function init() {
  scheduleMount()
  observer = new MutationObserver(mutations => {
    if (relevantMutation(mutations)) scheduleMount()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', positionPanel)
  window.addEventListener('pointermove', handleResize, true)
  window.addEventListener('pointerup', endResize, true)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init()
