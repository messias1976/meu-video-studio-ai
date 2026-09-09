const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'

type Media = { id: string; name: string; kind: 'video' | 'image' | 'audio'; url: string; duration: number }
type Clip = { id: string; assetId: string; start: number; duration: number; track: 'video' | 'audio'; lane?: number; x?: number; y?: number; width?: number; height?: number; rotation?: number; flipX?: boolean }
type Project = { id: string; media: Media[]; clips: Clip[]; playhead: number }
type Transform = { x: number; y: number; width: number; height: number; rotation: number; flipX: boolean }
type Drag = { clipId: string; mode: 'move' | 'resize'; handle?: string; startX: number; startY: number; initial: Transform }

const MIN_SIZE = 0
const MAX_SIZE = 200
const MIN_POS = -200
const MAX_POS = 300
const Z_FRONT = 10000
const Z_STEP = 100

let injected = false
let stageRef: HTMLElement | null = null
let rootRef: HTMLElement | null = null
let controlsRef: HTMLElement | null = null
let drag: Drag | null = null
let selectedClipId: string | null = null
let lastSignature = ''
let raf = 0
let cycleIndex = 0

const num = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function projectId() {
  return location.pathname.match(/\/editor\/([^/]+)/)?.[1] ?? null
}

function readProject(): Project | null {
  try {
    const id = projectId()
    if (!id) return null
    const all = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[]
    return all.find((p) => p.id === id) ?? null
  } catch {
    return null
  }
}

function updateClip(clipId: string, patch: Partial<Clip>) {
  const project = readProject()
  if (!project) return
  const all = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[]
  const next = all.map((p) => p.id === project.id
    ? { ...p, clips: p.clips.map((c) => c.id === clipId ? { ...c, ...patch } : c), updatedAt: new Date().toISOString() }
    : p)
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('vfs-project-changed'))
  lastSignature = ''
}

function asset(project: Project, assetId: string) {
  return project.media.find((m) => m.id === assetId)
}

function activeClips(project: Project, time: number) {
  return project.clips
    .filter((clip) => clip.track === 'video' && time >= num(clip.start, 0) && time < num(clip.start, 0) + Math.max(0, num(clip.duration, 0)))
    .sort((a, b) => num(a.lane, 0) - num(b.lane, 0) || num(a.start, 0) - num(b.start, 0) || a.id.localeCompare(b.id))
}

function transformFor(clip: Clip, index: number): Transform {
  const width = clamp(num(clip.width, index === 0 ? 100 : 55), MIN_SIZE, MAX_SIZE)
  const height = clamp(num(clip.height, index === 0 ? 100 : 55), MIN_SIZE, MAX_SIZE)
  return {
    x: num(clip.x, (100 - width) / 2),
    y: num(clip.y, (100 - height) / 2),
    width,
    height,
    rotation: num(clip.rotation, 0),
    flipX: Boolean(clip.flipX),
  }
}

function applyTransform(element: HTMLElement, t: Transform) {
  element.style.left = `${t.x}%`
  element.style.top = `${t.y}%`
  element.style.width = `${t.width}%`
  element.style.height = `${t.height}%`
  element.style.transform = `rotate(${t.rotation}deg) scaleX(${t.flipX ? -1 : 1})`
}

function injectStyles() {
  if (injected) return
  const style = document.createElement('style')
  style.dataset.vfs = 'layered-preview-v4'
  style.textContent = `
    .vfs-layer-compositor,.vfs-layer-controls,.vfs-layer-hint,[data-vfs-layer-hint],[data-vfs-compositor-hint]{display:none!important}
    .vfs-scene-compositor{position:absolute!important;inset:0!important;z-index:100!important;pointer-events:none!important;overflow:visible!important}
    .vfs-scene-layer{position:absolute!important;box-sizing:border-box!important;overflow:visible!important;pointer-events:none!important;user-select:none!important;touch-action:none!important;transform-origin:center center!important}
    .vfs-scene-layer.is-selected{outline:2px solid #a78bfa!important;box-shadow:0 0 0 1px rgba(167,139,250,.22)!important}
    .vfs-scene-media{position:absolute!important;inset:0!important;overflow:hidden!important;pointer-events:none!important}
    .vfs-scene-media img,.vfs-scene-media video{display:block!important;width:100%!important;height:100%!important;object-fit:fill!important;pointer-events:none!important}
    .vfs-scene-handle{position:absolute!important;width:12px!important;height:12px!important;border:2px solid #fff!important;background:#7c3aed!important;border-radius:3px!important;box-shadow:0 1px 4px #000!important;pointer-events:none!important}
    .vfs-scene-handle.nw{left:-7px;top:-7px}.vfs-scene-handle.n{left:50%;top:-7px;transform:translateX(-50%)}.vfs-scene-handle.ne{right:-7px;top:-7px}.vfs-scene-handle.e{right:-7px;top:50%;transform:translateY(-50%)}.vfs-scene-handle.se{right:-7px;bottom:-7px}.vfs-scene-handle.s{left:50%;bottom:-7px;transform:translateX(-50%)}.vfs-scene-handle.sw{left:-7px;bottom:-7px}.vfs-scene-handle.w{left:-7px;top:50%;transform:translateY(-50%)}
    .vfs-scene-controls{position:fixed;right:18px;top:88px;width:270px;background:rgba(16,16,20,.98);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;z-index:999999;color:#fff;font:12px Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.45)}
    .vfs-scene-controls h4{margin:0 0 5px;font-size:12px}.vfs-scene-controls .sub{display:block;color:#8a8a95;font-size:9px;margin-bottom:10px}.vfs-scene-controls .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.vfs-scene-controls label{display:grid;gap:4px;font-size:9px;color:#a0a0aa}.vfs-scene-controls input[type=number]{width:100%;height:30px;background:#0a0a0d;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:0 8px;outline:0}.vfs-scene-controls input[type=range]{width:100%;height:22px}.vfs-scene-controls .title{grid-column:1/-1;color:#d0d0d8;font-size:10px;margin-top:2px}.vfs-scene-controls .range-row{grid-column:1/-1;display:grid;grid-template-columns:52px 1fr 52px;gap:7px;align-items:center}.vfs-scene-controls .range-row span{font-size:9px;color:#777883}.vfs-scene-controls output{height:28px;display:grid;place-items:center;background:#0a0a0d;border:1px solid rgba(255,255,255,.1);border-radius:7px;font-size:9px;color:#ddd}.vfs-scene-controls .row{display:flex;gap:6px;margin-top:8px}.vfs-scene-controls button{flex:1;height:30px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:#17171d;color:#ddd;cursor:pointer}.vfs-scene-controls button:hover{background:#22222a;color:#fff}
  `
  document.head.appendChild(style)
  injected = true
}

function removeLegacy() {
  document.querySelectorAll('.vfs-layer-compositor,.vfs-layer-controls,.vfs-layer-hint,[data-vfs-layer-hint],[data-vfs-compositor-hint]').forEach((node) => {
    if (node instanceof HTMLElement) node.remove()
  })
}

function ensureControls() {
  if (controlsRef) return controlsRef
  const el = document.createElement('div')
  el.className = 'vfs-scene-controls'
  el.style.display = 'none'
  document.body.appendChild(el)
  controlsRef = el
  return el
}

function showControls(project: Project, clip: Clip, t: Transform) {
  const controls = ensureControls()
  controls.style.display = 'block'
  controls.innerHTML = `<h4>Transformação</h4><span class="sub">${asset(project, clip.assetId)?.name || 'Mídia'} · largura e altura independentes · 0–200%</span><div class="grid"><label>X (%)<input data-k="x" type="number" min="${MIN_POS}" max="${MAX_POS}" step="0.1" value="${t.x.toFixed(1)}"></label><label>Y (%)<input data-k="y" type="number" min="${MIN_POS}" max="${MAX_POS}" step="0.1" value="${t.y.toFixed(1)}"></label><div class="title">Tamanho</div><div class="range-row"><span>Largura</span><input data-k="w" type="range" min="0" max="200" step="1" value="${t.width}"><output>${Math.round(t.width)}%</output></div><div class="range-row"><span>Altura</span><input data-k="h" type="range" min="0" max="200" step="1" value="${t.height}"><output>${Math.round(t.height)}%</output></div><label>Largura (%)<input data-k="wn" type="number" min="0" max="200" step="0.1" value="${t.width.toFixed(1)}"></label><label>Altura (%)<input data-k="hn" type="number" min="0" max="200" step="0.1" value="${t.height.toFixed(1)}"></label><label>Rotação (°)<input data-k="r" type="number" min="-360" max="360" step="1" value="${t.rotation}"></label></div><div class="row"><button data-a="mirror">Espelhar</button><button data-a="reset">Resetar</button></div>`
  controls.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((input) => {
    input.addEventListener('input', () => {
      const raw = Number(input.value)
      const key = input.dataset.k || ''
      if (!Number.isFinite(raw)) return
      const value = key === 'w' || key === 'wn' ? clamp(raw, 0, MAX_SIZE)
        : key === 'h' || key === 'hn' ? clamp(raw, 0, MAX_SIZE)
        : key === 'x' || key === 'y' ? clamp(raw, MIN_POS, MAX_POS)
        : clamp(raw, -360, 360)
      updateClip(clip.id, key === 'w' || key === 'wn' ? { width: value } : key === 'h' || key === 'hn' ? { height: value } : key === 'x' ? { x: value } : key === 'y' ? { y: value } : { rotation: value })
      const layer = rootRef?.querySelector<HTMLElement>(`.vfs-scene-layer[data-clip-id="${clip.id}"]`)
      if (layer) {
        const current = readProject()?.clips.find((c) => c.id === clip.id) ?? clip
        applyTransform(layer, transformFor(current, activeClips(readProject()!, num(readProject()!.playhead, 0)).findIndex((c) => c.id === clip.id)))
      }
      if (key === 'w' || key === 'wn' || key === 'h' || key === 'hn') {
        const out = input.parentElement?.querySelector('output')
        if (out) out.textContent = `${Math.round(value)}%`
      }
    })
  })
  controls.querySelector('[data-a="mirror"]')?.addEventListener('click', () => {
    const current = readProject()
    if (current) updateClip(clip.id, { flipX: !Boolean(current.clips.find((c) => c.id === clip.id)?.flipX) })
  })
  controls.querySelector('[data-a="reset"]')?.addEventListener('click', () => updateClip(clip.id, { x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false }))
}

function updateSelection(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.vfs-scene-layer').forEach((layer) => {
    const active = layer.dataset.clipId === selectedClipId
    layer.classList.toggle('is-selected', active)
    layer.querySelectorAll<HTMLElement>('.vfs-scene-handle').forEach((h) => { h.style.display = active ? 'block' : 'none' })
  })
}

function hitLayers(stage: HTMLElement, clientX: number, clientY: number) {
  const layers = Array.from(stage.querySelectorAll<HTMLElement>('.vfs-scene-layer'))
    .filter((layer) => {
      const rect = layer.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    })
    .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))
  return layers
}

function startDrag(stage: HTMLElement, event: PointerEvent, mode: 'move' | 'resize', handle?: string) {
  const root = rootRef
  if (!root) return
  const layers = hitLayers(stage, event.clientX, event.clientY)
  if (!layers.length) return
  const sameSelected = layers.findIndex((l) => l.dataset.clipId === selectedClipId)
  const chosen = mode === 'move' && layers.length > 1 && sameSelected === 0 ? layers[(cycleIndex + 1) % layers.length] : layers[Math.max(0, sameSelected)] || layers[0]
  const id = chosen.dataset.clipId
  const project = readProject()
  if (!id || !project) return
  const clip = project.clips.find((c) => c.id === id)
  if (!clip) return
  const clips = activeClips(project, num(project.playhead, 0))
  const index = Math.max(0, clips.findIndex((c) => c.id === id))
  selectedClipId = id
  cycleIndex = Math.max(0, layers.indexOf(chosen))
  updateSelection(root)
  showControls(project, clip, transformFor(clip, index))
  drag = { clipId: id, mode, handle, startX: event.clientX, startY: event.clientY, initial: transformFor(clip, index) }
  event.preventDefault()
  event.stopPropagation()
}

function handlePointerDown(stage: HTMLElement, event: PointerEvent) {
  if (event.button !== 0) return
  const target = event.target as HTMLElement
  if (target.closest('.vfs-scene-controls')) return
  const layers = hitLayers(stage, event.clientX, event.clientY)
  if (!layers.length) return
  startDrag(stage, event, 'move')
}

function handlePointerMove(stage: HTMLElement, event: PointerEvent) {
  if (!drag) return
  const project = readProject()
  if (!project) return
  const layer = rootRef?.querySelector<HTMLElement>(`.vfs-scene-layer[data-clip-id="${drag.clipId}"]`)
  if (!layer) return
  const dx = ((event.clientX - drag.startX) / Math.max(1, stage.clientWidth)) * 100
  const dy = ((event.clientY - drag.startY) / Math.max(1, stage.clientHeight)) * 100
  let next = { ...drag.initial }
  if (drag.mode === 'move') {
    next.x = clamp(drag.initial.x + dx, MIN_POS, MAX_POS)
    next.y = clamp(drag.initial.y + dy, MIN_POS, MAX_POS)
  } else {
    let left = drag.initial.x
    let right = drag.initial.x + drag.initial.width
    let top = drag.initial.y
    let bottom = drag.initial.y + drag.initial.height
    const handle = drag.handle || 'se'
    if (handle.includes('w')) left += dx
    if (handle.includes('e')) right += dx
    if (handle.includes('n')) top += dy
    if (handle.includes('s')) bottom += dy
    const width = clamp(right - left, MIN_SIZE, MAX_SIZE)
    const height = clamp(bottom - top, MIN_SIZE, MAX_SIZE)
    if (handle.includes('w')) left = right - width
    if (handle.includes('n')) top = bottom - height
    next = { ...next, x: left, y: top, width, height }
  }
  applyTransform(layer, next)
  updateClip(drag.clipId, { x: next.x, y: next.y, width: next.width, height: next.height })
}

function handlePointerUp() {
  drag = null
  lastSignature = ''
  rebuild()
}

function sceneSignature(project: Project, stage: HTMLElement, clips: Clip[]) {
  const media = project.media.map((m) => `${m.id}:${m.url}`).join('|')
  const clipData = clips.map((c) => `${c.id}:${c.assetId}:${c.start}:${c.duration}:${c.lane ?? 0}:${c.x ?? ''}:${c.y ?? ''}:${c.width ?? ''}:${c.height ?? ''}:${c.rotation ?? 0}:${c.flipX ? 1 : 0}`).join('|')
  return `${stage.dataset.vfsSceneId || ''}|${num(project.playhead, 0)}|${media}|${clipData}`
}

function rebuild() {
  const stage = document.querySelector<HTMLElement>('.video-stage')
  const project = readProject()
  if (!stage || !project) return
  injectStyles()
  removeLegacy()
  if (!stage.dataset.vfsSceneId) stage.dataset.vfsSceneId = Math.random().toString(36).slice(2)
  const time = num(project.playhead, 0)
  const clips = activeClips(project, time)
  const signature = sceneSignature(project, stage, clips)
  if (signature === lastSignature && stage === stageRef && rootRef?.isConnected) return
  lastSignature = signature
  stageRef = stage
  const root = rootRef?.isConnected && rootRef.parentElement === stage ? rootRef : (() => {
    const el = document.createElement('div')
    el.className = 'vfs-scene-compositor'
    stage.appendChild(el)
    return el
  })()
  rootRef = root
  root.replaceChildren()
  const direct = stage.querySelectorAll<HTMLElement>(':scope > video,:scope > img')
  direct.forEach((node) => { node.style.visibility = clips.length ? 'hidden' : 'visible' })
  const ordered = [...clips]
  ordered.forEach((clip, index) => {
    const media = asset(project, clip.assetId)
    if (!media || (media.kind !== 'image' && media.kind !== 'video')) return
    const layer = document.createElement('div')
    layer.className = `vfs-scene-layer${clip.id === selectedClipId ? ' is-selected' : ''}`
    layer.dataset.clipId = clip.id
    const t = transformFor(clip, index)
    applyTransform(layer, t)
    layer.style.zIndex = String(Z_FRONT - num(clip.lane, 0) * Z_STEP + index)
    const wrap = document.createElement('div')
    wrap.className = 'vfs-scene-media'
    const element = media.kind === 'image' ? document.createElement('img') : document.createElement('video')
    element.src = media.url
    element.draggable = false
    element.addEventListener('error', () => {
      const fresh = readProject()
      const current = fresh ? asset(fresh, clip.assetId) : null
      if (current?.url && current.url !== element.src) {
        element.src = current.url
        lastSignature = ''
      }
    })
    if (element instanceof HTMLVideoElement) {
      element.muted = true
      element.playsInline = true
      element.preload = 'auto'
      try { element.currentTime = Math.max(0, time - num(clip.start, 0)) } catch { /* noop */ }
    }
    wrap.appendChild(element)
    layer.appendChild(wrap)
    ;['nw','n','ne','e','se','s','sw','w'].forEach((handle) => {
      const h = document.createElement('div')
      h.className = `vfs-scene-handle ${handle}`
      h.dataset.handle = handle
      h.style.display = clip.id === selectedClipId ? 'block' : 'none'
      layer.appendChild(h)
    })
    root.appendChild(layer)
  })
  if (!clips.some((c) => c.id === selectedClipId) && controlsRef) controlsRef.style.display = 'none'
}

function bindStage(stage: HTMLElement) {
  if (stage.dataset.vfsV4Bound === '1') return
  stage.dataset.vfsV4Bound = '1'
  stage.addEventListener('pointerdown', (e) => handlePointerDown(stage, e as PointerEvent), true)
  stage.addEventListener('pointermove', (e) => handlePointerMove(stage, e as PointerEvent), true)
  stage.addEventListener('pointerup', () => handlePointerUp(), true)
  stage.addEventListener('pointercancel', () => handlePointerUp(), true)
  stage.addEventListener('dblclick', () => { cycleIndex += 1; lastSignature = ''; rebuild() }, true)
}

function sync() {
  injectStyles()
  removeLegacy()
  const stage = document.querySelector<HTMLElement>('.video-stage')
  const project = readProject()
  if (stage && project) {
    bindStage(stage)
    const clips = activeClips(project, num(project.playhead, 0))
    const signature = sceneSignature(project, stage, clips)
    if (stage !== stageRef || signature !== lastSignature || !rootRef?.isConnected) rebuild()
    rootRef?.querySelectorAll<HTMLVideoElement>('.vfs-scene-layer video').forEach((video) => {
      const layer = video.closest<HTMLElement>('.vfs-scene-layer')
      const clip = project.clips.find((c) => c.id === layer?.dataset.clipId)
      if (!clip) return
      const localTime = Math.max(0, num(project.playhead, 0) - num(clip.start, 0))
      try { if (Math.abs(video.currentTime - localTime) > 0.12) video.currentTime = localTime } catch { /* noop */ }
    })
  }
  raf = requestAnimationFrame(sync)
}

window.addEventListener('storage', () => { lastSignature = ''; rebuild() })
window.addEventListener('vfs-project-changed', () => { lastSignature = ''; rebuild() })
window.addEventListener('popstate', () => { lastSignature = ''; rebuild() })
window.addEventListener('beforeunload', () => cancelAnimationFrame(raf))

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { rebuild(); raf = requestAnimationFrame(sync) }, { once: true })
} else {
  rebuild()
  raf = requestAnimationFrame(sync)
}
