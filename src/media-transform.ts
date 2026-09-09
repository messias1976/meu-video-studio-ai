const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
const PX_MIN = 0.25
const PX_MAX = 4

type Transform = { scale: number; x: number; y: number; rotation: number; mode: 'transform' | 'fit' | 'crop' }
type Project = { id: string; media?: { id: string }[]; clips?: { assetId: string }[] }

const defaults: Transform = { scale: 1, x: 0, y: 0, rotation: 0, mode: 'transform' }
let activeKey = ''
let transform: Transform = { ...defaults }
let mediaEl: HTMLVideoElement | HTMLImageElement | null = null
let frameEl: HTMLElement | null = null
let box: HTMLElement | null = null
let resize: { direction: string; startX: number; startY: number; startScale: number; frameWidth: number; frameHeight: number } | null = null

function projects(): Project[] {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[] } catch { return [] }
}
function projectId() { return location.pathname.match(/\/editor\/([^/]+)/)?.[1] || '' }
function key() {
  const id = projectId()
  const media = document.querySelector<HTMLVideoElement | HTMLImageElement>('.video-stage video, .video-stage img')
  if (!id || !media) return ''
  const current = projects().find(p => p.id === id)
  const assetName = media.getAttribute('src') || ''
  const assetId = current?.clips?.find(c => assetName.includes(c.assetId))?.assetId || assetName
  return `${id}:${assetId}`
}
function storageKey(k: string) { return `meu-video-studio-ai:transform:${k}` }
function load(k: string) {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(storageKey(k)) || '{}') as Partial<Transform>) } } catch { return { ...defaults } }
}
function save() { if (activeKey) localStorage.setItem(storageKey(activeKey), JSON.stringify(transform)) }
function clamp(n: number, min = PX_MIN, max = PX_MAX) { return Math.max(min, Math.min(max, n)) }
function apply() {
  if (!mediaEl || !box) return
  const css = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale}) rotate(${transform.rotation}deg)`
  mediaEl.style.transformOrigin = 'center center'
  mediaEl.style.transform = css
  box.style.transform = `translate(-50%, -50%) ${css}`
  box.dataset.scale = String(transform.scale)
  const value = panel?.querySelector<HTMLElement>('[data-transform-scale]')
  if (value) value.textContent = `${Math.round(transform.scale * 100)}%`
  const rotation = panel?.querySelector<HTMLElement>('[data-transform-rotation]')
  if (rotation) rotation.textContent = `${Math.round(transform.rotation)}°`
}
function reset() { transform = { ...defaults }; save(); apply() }
function fit() { transform = { ...defaults, mode: 'fit' }; save(); apply() }
function fill() { transform = { ...defaults, scale: 1.18, mode: 'crop' }; save(); apply() }
function rotate(delta: number) { transform.rotation = (transform.rotation + delta + 360) % 360; save(); apply() }
function mirrorX() { transform.x = transform.x; transform.scale = transform.scale; if (mediaEl) mediaEl.style.transform += ' scaleX(-1)' }

let panel: HTMLElement | null = null
function makePanel() {
  if (panel) return
  panel = document.createElement('div')
  panel.className = 'vfs-transform-panel'
  panel.innerHTML = `
    <div class="vfs-transform-tabs">
      <button class="active" type="button" data-tab="transform">Transformar</button>
      <button type="button" data-tab="adjust">Ajustar</button>
      <button type="button" data-tab="crop">Cortar</button>
    </div>
    <div data-transform-view>
      <div class="vfs-transform-actions">
        <button type="button" data-fill>Preencher</button>
        <button type="button" data-fit>Ajustar</button>
        <button type="button" data-reset>Original</button>
      </div>
      <div class="vfs-transform-row">
        <button type="button" data-mirror>↔ Espelhar</button>
        <button type="button" data-rotate>↻ Girar</button>
      </div>
      <div class="vfs-transform-range">
        <label><span>Escala da mídia</span><span class="vfs-transform-value" data-transform-scale>100%</span></label>
        <input data-scale type="range" min="25" max="400" value="100">
      </div>
      <div class="vfs-transform-grid">
        <button type="button" data-minus>−</button><button type="button" data-plus>+</button>
      </div>
      <div class="vfs-transform-range">
        <label><span>Rotação</span><span class="vfs-transform-value" data-transform-rotation>0°</span></label>
        <input data-rotation type="range" min="-180" max="180" value="0">
      </div>
      <div class="vfs-transform-muted">Arraste a mídia para reposicionar. Use as alças amarelas para redimensionar.</div>
    </div>`
  document.body.appendChild(panel)
  panel.querySelector('[data-fill]')?.addEventListener('click', fill)
  panel.querySelector('[data-fit]')?.addEventListener('click', fit)
  panel.querySelector('[data-reset]')?.addEventListener('click', reset)
  panel.querySelector('[data-rotate]')?.addEventListener('click', () => rotate(90))
  panel.querySelector('[data-mirror]')?.addEventListener('click', () => {
    transform.scale = -transform.scale
    save(); apply()
  })
  panel.querySelector('[data-minus]')?.addEventListener('click', () => { transform.scale = clamp(Math.abs(transform.scale) - .05); save(); apply() })
  panel.querySelector('[data-plus]')?.addEventListener('click', () => { transform.scale = clamp(Math.abs(transform.scale) + .05); save(); apply() })
  panel.querySelector<HTMLInputElement>('[data-scale]')?.addEventListener('input', e => { transform.scale = clamp(Number((e.target as HTMLInputElement).value) / 100); save(); apply() })
  panel.querySelector<HTMLInputElement>('[data-rotation]')?.addEventListener('input', e => { transform.rotation = Number((e.target as HTMLInputElement).value); save(); apply() })
}
function positionPanel() {
  if (!panel || !frameEl) return
  const r = frameEl.getBoundingClientRect()
  panel.style.left = `${Math.max(10, r.left - 230)}px`
  panel.style.top = `${Math.max(10, r.top)}px`
}
function makeHandles() {
  if (!frameEl || box) return
  const wrap = document.createElement('div')
  wrap.className = 'vfs-media-transform-wrap'
  box = document.createElement('div')
  box.className = 'vfs-media-transform-box'
  const directions = ['nw','n','ne','e','se','s','sw','w']
  directions.forEach(direction => {
    const h = document.createElement('div')
    h.className = `vfs-transform-handle ${direction}`
    h.dataset.direction = direction
    h.addEventListener('pointerdown', event => {
      if (!mediaEl || !box) return
      const r = frameEl!.getBoundingClientRect()
      resize = { direction, startX: event.clientX, startY: event.clientY, startScale: Math.abs(transform.scale), frameWidth: r.width, frameHeight: r.height }
      h.setPointerCapture?.(event.pointerId)
      event.preventDefault(); event.stopPropagation()
    })
    box!.appendChild(h)
  })
  const rot = document.createElement('div')
  rot.className = 'vfs-transform-rotation'
  box.appendChild(rot)
  wrap.appendChild(box)
  frameEl.appendChild(wrap)
}
function removeHandles() { box?.parentElement?.remove(); box = null }
function moveMedia(event: PointerEvent) {
  if (resize) {
    const dx = event.clientX - resize.startX
    const dy = event.clientY - resize.startY
    const sign = transform.scale < 0 ? -1 : 1
    const distance = Math.max(Math.abs(dx), Math.abs(dy))
    const direction = /[we]/.test(resize.direction) ? -1 : 1
    transform.scale = clamp(resize.startScale + (distance / Math.max(resize.frameWidth, resize.frameHeight)) * 2 * direction) * sign
    apply()
    return
  }
}
function stopMove() { if (resize) { save(); resize = null } }
function dragMediaStart(event: PointerEvent) {
  if (!mediaEl || (event.target as HTMLElement).closest('.vfs-transform-handle')) return
  const startX = event.clientX; const startY = event.clientY
  const startTx = transform.x; const startTy = transform.y
  const move = (e: PointerEvent) => { transform.x = startTx + e.clientX - startX; transform.y = startTy + e.clientY - startY; apply() }
  const up = () => { save(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
  event.preventDefault(); event.stopPropagation()
}
function sync() {
  const frame = document.querySelector<HTMLElement>('.video-stage')
  const media = document.querySelector<HTMLVideoElement | HTMLImageElement>('.video-stage video, .video-stage img')
  if (!frame || !media) { panel?.classList.remove('is-visible'); removeHandles(); mediaEl = null; frameEl = null; activeKey = ''; return }
  const nextKey = key()
  const changed = nextKey !== activeKey || media !== mediaEl || frame !== frameEl
  frameEl = frame; mediaEl = media
  if (changed) { activeKey = nextKey; transform = load(activeKey); removeHandles(); makeHandles() }
  panel?.classList.add('is-visible')
  positionPanel(); apply()
  media.onclick = () => { panel?.classList.toggle('is-visible') }
  mediaEl.onpointerdown = dragMediaStart
}
function init() {
  makePanel()
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.body, { childList:true, subtree:true })
  window.addEventListener('resize', positionPanel)
  window.addEventListener('pointermove', moveMedia, true)
  window.addEventListener('pointerup', stopMove, true)
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init()
