const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'

type Media = { id: string; name: string; kind: 'video' | 'image' | 'audio'; url: string; duration: number }
type Clip = { id: string; assetId: string; start: number; duration: number; track: 'video' | 'audio'; lane?: number; x?: number; y?: number; width?: number; height?: number; rotation?: number; flipX?: boolean }
type Project = { id: string; media: Media[]; clips: Clip[]; playhead: number }
type Transform = { x: number; y: number; width: number; height: number; rotation: number; flipX: boolean }

type DragState = { clipId: string; mode: 'move' | 'resize'; handle?: string; startX: number; startY: number; initial: Transform }

const MIN_SIZE = 0
const MAX_SIZE = 200
const MIN_POSITION = -200
const MAX_POSITION = 300
const FRONT_Z = 1000
const LANE_STEP = 100

let styleInjected = false
let stageRef: HTMLElement | null = null
let rootRef: HTMLElement | null = null
let controlsRef: HTMLElement | null = null
let selectedClipId: string | null = null
let dragState: DragState | null = null
let lastSignature = ''
let rafId = 0

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const finite = (value: unknown, fallback: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function projectId() {
  return window.location.pathname.match(/\/editor\/([^/]+)/)?.[1] ?? null
}

function readProject(): Project | null {
  try {
    const id = projectId()
    if (!id) return null
    const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[]
    return projects.find((project) => project.id === id) || null
  } catch {
    return null
  }
}

function writeProjectClip(project: Project, clipId: string, patch: Partial<Clip>) {
  const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[]
  const next = projects.map((item) => item.id === project.id
    ? { ...item, clips: item.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip), updatedAt: new Date().toISOString() }
    : item)
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('vfs-project-changed'))
}

function getAsset(project: Project, id: string) {
  return project.media.find((media) => media.id === id)
}

function activeVideoClips(project: Project, time: number) {
  return project.clips
    .filter((clip) => clip.track === 'video' && time >= finite(clip.start, 0) && time < finite(clip.start, 0) + Math.max(0, finite(clip.duration, 0)))
    .sort((a, b) => (finite(a.lane, 0) - finite(b.lane, 0)) || (finite(a.start, 0) - finite(b.start, 0)))
}

function transformFor(clip: Clip, index: number): Transform {
  const width = clamp(finite(clip.width, index === 0 ? 100 : 55), MIN_SIZE, MAX_SIZE)
  const height = clamp(finite(clip.height, index === 0 ? 100 : 55), MIN_SIZE, MAX_SIZE)
  return {
    x: finite(clip.x, (100 - width) / 2),
    y: finite(clip.y, (100 - height) / 2),
    width,
    height,
    rotation: finite(clip.rotation, 0),
    flipX: Boolean(clip.flipX),
  }
}

function applyTransform(element: HTMLElement, transform: Transform) {
  element.style.left = `${transform.x}%`
  element.style.top = `${transform.y}%`
  element.style.width = `${transform.width}%`
  element.style.height = `${transform.height}%`
  element.style.transform = `rotate(${transform.rotation}deg) scaleX(${transform.flipX ? -1 : 1})`
}

function injectStyles() {
  if (styleInjected) return
  const style = document.createElement('style')
  style.dataset.vfs = 'layered-preview-v3'
  style.textContent = `
    .vfs-layer-compositor,
    .vfs-layer-controls,
    .vfs-layer-hint,
    [data-vfs-layer-hint],
    [data-vfs-compositor-hint] { display:none !important; }
    .vfs-scene-compositor{position:absolute!important;inset:0!important;z-index:80!important;overflow:visible!important;pointer-events:none!important;contain:layout paint}
    .vfs-scene-layer{position:absolute!important;box-sizing:border-box!important;pointer-events:auto!important;overflow:visible!important;user-select:none!important;touch-action:none!important;transform-origin:center center!important;cursor:move!important}
    .vfs-scene-layer.is-selected{outline:2px solid #a78bfa!important;box-shadow:0 0 0 1px rgba(167,139,250,.25)!important}
    .vfs-scene-media{position:absolute!important;inset:0!important;overflow:hidden!important}
    .vfs-scene-media img,.vfs-scene-media video{display:block!important;width:100%!important;height:100%!important;object-fit:fill!important;pointer-events:none!important;user-select:none!important}
    .vfs-scene-handle{position:absolute!important;width:12px!important;height:12px!important;border:2px solid #fff!important;background:#7c3aed!important;border-radius:3px!important;z-index:10!important;box-shadow:0 1px 4px #000!important;pointer-events:auto!important}
    .vfs-scene-handle.nw{left:-7px;top:-7px;cursor:nwse-resize}.vfs-scene-handle.n{left:50%;top:-7px;transform:translateX(-50%);cursor:ns-resize}.vfs-scene-handle.ne{right:-7px;top:-7px;cursor:nesw-resize}.vfs-scene-handle.e{right:-7px;top:50%;transform:translateY(-50%);cursor:ew-resize}.vfs-scene-handle.se{right:-7px;bottom:-7px;cursor:nwse-resize}.vfs-scene-handle.s{left:50%;bottom:-7px;transform:translateX(-50%);cursor:ns-resize}.vfs-scene-handle.sw{left:-7px;bottom:-7px;cursor:nesw-resize}.vfs-scene-handle.w{left:-7px;top:50%;transform:translateY(-50%);cursor:ew-resize}
    .vfs-scene-controls{position:fixed;right:18px;top:88px;width:270px;background:rgba(16,16,20,.98);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;z-index:999999;color:#fff;font:12px Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.45)}
    .vfs-scene-controls h4{margin:0 0 5px;font-size:12px}.vfs-scene-controls .sub{display:block;color:#8a8a95;font-size:9px;margin-bottom:10px}.vfs-scene-controls .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.vfs-scene-controls label{display:grid;gap:4px;font-size:9px;color:#a0a0aa}.vfs-scene-controls input[type=number]{width:100%;height:30px;background:#0a0a0d;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:0 8px;outline:0}.vfs-scene-controls input[type=range]{width:100%;height:22px}.vfs-scene-controls .title{grid-column:1/-1;color:#d0d0d8;font-size:10px;margin-top:2px}.vfs-scene-controls .range-row{grid-column:1/-1;display:grid;grid-template-columns:52px 1fr 52px;gap:7px;align-items:center}.vfs-scene-controls .range-row span{font-size:9px;color:#777883}.vfs-scene-controls output{height:28px;display:grid;place-items:center;background:#0a0a0d;border:1px solid rgba(255,255,255,.1);border-radius:7px;font-size:9px;color:#ddd}.vfs-scene-controls .row{display:flex;gap:6px;margin-top:8px}.vfs-scene-controls button{flex:1;height:30px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:#17171d;color:#ddd;cursor:pointer}.vfs-scene-controls button:hover{background:#22222a;color:#fff}
  `
  document.head.appendChild(style)
  styleInjected = true
}

function removeLegacyUi() {
  document.querySelectorAll('.vfs-layer-compositor,.vfs-layer-controls,.vfs-layer-hint,[data-vfs-layer-hint],[data-vfs-compositor-hint]').forEach((node) => {
    if (node.classList.contains('vfs-layer-compositor')) {
      node.remove()
    } else if (node instanceof HTMLElement) {
      node.style.display = 'none'
    }
  })
}

function ensureRoot(stage: HTMLElement) {
  let root = stage.querySelector<HTMLElement>(':scope > .vfs-scene-compositor')
  if (!root) {
    root = document.createElement('div')
    root.className = 'vfs-scene-compositor'
    stage.appendChild(root)
  }
  rootRef = root
  return root
}

function controlInput(c: Clip, t: Transform, key: string, value: number) {
  const project = readProject()
  if (!project) return
  const patch: Partial<Clip> = {}
  if (key === 'x') patch.x = clamp(value, MIN_POSITION, MAX_POSITION)
  if (key === 'y') patch.y = clamp(value, MIN_POSITION, MAX_POSITION)
  if (key === 'w') patch.width = clamp(value, MIN_SIZE, MAX_SIZE)
  if (key === 'h') patch.height = clamp(value, MIN_SIZE, MAX_SIZE)
  if (key === 'r') patch.rotation = clamp(value, -360, 360)
  writeProjectClip(project, c.id, patch)
  const layer = rootRef?.querySelector<HTMLElement>(`.vfs-scene-layer[data-clip-id="${c.id}"]`)
  if (layer) applyTransform(layer, { ...t, ...patch } as Transform)
}

function ensureControls() {
  if (controlsRef) return controlsRef
  const controls = document.createElement('div')
  controls.className = 'vfs-scene-controls'
  controls.style.display = 'none'
  document.body.appendChild(controls)
  controlsRef = controls
  return controls
}

function showControls(project: Project, clip: Clip, transform: Transform) {
  const controls = ensureControls()
  controls.style.display = 'block'
  controls.innerHTML = `<h4>Transformação</h4><span class="sub">${getAsset(project, clip.assetId)?.name || 'Mídia'} · largura e altura independentes · 0–200%</span><div class="grid"><label>X (%)<input data-vfs="x" type="number" min="${MIN_POSITION}" max="${MAX_POSITION}" step="0.1" value="${transform.x.toFixed(1)}"></label><label>Y (%)<input data-vfs="y" type="number" min="${MIN_POSITION}" max="${MAX_POSITION}" step="0.1" value="${transform.y.toFixed(1)}"></label><div class="title">Tamanho</div><div class="range-row"><span>Largura</span><input data-vfs="w" type="range" min="0" max="200" step="1" value="${transform.width}"><output>${Math.round(transform.width)}%</output></div><div class="range-row"><span>Altura</span><input data-vfs="h" type="range" min="0" max="200" step="1" value="${transform.height}"><output>${Math.round(transform.height)}%</output></div><label>Largura (%)<input data-vfs="wn" type="number" min="0" max="200" step="0.1" value="${transform.width.toFixed(1)}"></label><label>Altura (%)<input data-vfs="hn" type="number" min="0" max="200" step="0.1" value="${transform.height.toFixed(1)}"></label><label>Rotação (°)<input data-vfs="r" type="number" min="-360" max="360" step="1" value="${transform.rotation}"></label></div><div class="row"><button data-vfs-action="mirror">Espelhar</button><button data-vfs-action="reset">Resetar</button></div>`
  controls.querySelectorAll<HTMLInputElement>('input[data-vfs]').forEach((input) => {
    input.addEventListener('input', () => {
      const raw = Number(input.value)
      const key = input.dataset.vfs || ''
      const mapped = key === 'wn' ? 'w' : key === 'hn' ? 'h' : key
      if (!Number.isFinite(raw)) return
      controlInput(clip, transform, mapped, raw)
      if (mapped === 'w' || mapped === 'h') {
        const output = input.parentElement?.querySelector('output')
        if (output) output.textContent = `${Math.round(raw)}%`
      }
    })
  })
  controls.querySelector('[data-vfs-action="mirror"]')?.addEventListener('click', () => {
    const current = readProject()
    if (current) writeProjectClip(current, clip.id, { flipX: !transform.flipX })
  })
  controls.querySelector('[data-vfs-action="reset"]')?.addEventListener('click', () => {
    const current = readProject()
    if (current) writeProjectClip(current, clip.id, { x: 0, y: 0, width: 100, height: 100, rotation: 0, flipX: false })
  })
}

function updateLayerSelection(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.vfs-scene-layer').forEach((layer) => {
    const active = layer.dataset.clipId === selectedClipId
    layer.classList.toggle('is-selected', active)
    layer.querySelectorAll<HTMLElement>('.vfs-scene-handle').forEach((handle) => {
      handle.style.display = active ? 'block' : 'none'
    })
  })
}

function bindLayer(layer: HTMLElement, clip: Clip, transform: Transform, stage: HTMLElement) {
  layer.addEventListener('click', (event) => {
    event.stopPropagation()
    selectedClipId = clip.id
    updateLayerSelection(layer.parentElement as HTMLElement)
    const project = readProject()
    if (project) showControls(project, clip, transform)
  })

  layer.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('.vfs-scene-handle')) return
    event.preventDefault()
    event.stopPropagation()
    selectedClipId = clip.id
    updateLayerSelection(layer.parentElement as HTMLElement)
    dragState = { clipId: clip.id, mode: 'move', startX: event.clientX, startY: event.clientY, initial: transform }
    layer.setPointerCapture(event.pointerId)
  })

  layer.querySelectorAll<HTMLElement>('.vfs-scene-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      selectedClipId = clip.id
      updateLayerSelection(layer.parentElement as HTMLElement)
      dragState = { clipId: clip.id, mode: 'resize', handle: handle.dataset.handle, startX: event.clientX, startY: event.clientY, initial: transform }
      layer.setPointerCapture(event.pointerId)
    })
  })

  const pointerMove = (event: PointerEvent) => {
    if (!dragState || dragState.clipId !== clip.id) return
    const width = Math.max(1, stage.clientWidth)
    const height = Math.max(1, stage.clientHeight)
    const dx = ((event.clientX - dragState.startX) / width) * 100
    const dy = ((event.clientY - dragState.startY) / height) * 100
    const start = dragState.initial
    let next: Transform = { ...start }

    if (dragState.mode === 'move') {
      next.x = clamp(start.x + dx, MIN_POSITION, MAX_POSITION)
      next.y = clamp(start.y + dy, MIN_POSITION, MAX_POSITION)
    } else {
      let left = start.x
      let right = start.x + start.width
      let top = start.y
      let bottom = start.y + start.height
      const handle = dragState.handle || 'se'
      if (handle.includes('w')) left += dx
      if (handle.includes('e')) right += dx
      if (handle.includes('n')) top += dy
      if (handle.includes('s')) bottom += dy
      const nextWidth = clamp(right - left, MIN_SIZE, MAX_SIZE)
      const nextHeight = clamp(bottom - top, MIN_SIZE, MAX_SIZE)
      if (handle.includes('w') && nextWidth > MIN_SIZE) left = right - nextWidth
      if (handle.includes('n') && nextHeight > MIN_SIZE) top = bottom - nextHeight
      next = { ...start, x: left, y: top, width: nextWidth, height: nextHeight }
    }

    applyTransform(layer, next)
    const project = readProject()
    if (project) writeProjectClip(project, clip.id, { x: next.x, y: next.y, width: next.width, height: next.height })
  }

  const pointerUp = (event: PointerEvent) => {
    if (!dragState || dragState.clipId !== clip.id) return
    if (layer.hasPointerCapture(event.pointerId)) layer.releasePointerCapture(event.pointerId)
    dragState = null
    const project = readProject()
    if (project) showControls(project, clip, transformFor(project.clips.find((item) => item.id === clip.id) || clip, 0))
    lastSignature = ''
  }

  layer.addEventListener('pointermove', pointerMove)
  layer.addEventListener('pointerup', pointerUp)
  layer.addEventListener('pointercancel', pointerUp)
}

function sceneSignature(project: Project, stage: HTMLElement, clips: Clip[]) {
  const mediaSignature = project.media.map((media) => `${media.id}:${media.url}`).join('|')
  const clipSignature = clips.map((clip) => `${clip.id}:${clip.assetId}:${clip.start}:${clip.duration}:${clip.lane ?? 0}:${clip.x ?? ''}:${clip.y ?? ''}:${clip.width ?? ''}:${clip.height ?? ''}:${clip.rotation ?? 0}:${clip.flipX ? 1 : 0}`).join('|')
  return `${stage.dataset.vfsSceneId || ''}|${finite(project.playhead, 0)}|${mediaSignature}|${clipSignature}`
}

function rebuild() {
  const stage = document.querySelector<HTMLElement>('.video-stage')
  const project = readProject()
  if (!stage || !project) return
  injectStyles()
  removeLegacyUi()
  if (!stage.dataset.vfsSceneId) stage.dataset.vfsSceneId = Math.random().toString(36).slice(2)
  const time = finite(project.playhead, 0)
  const clips = activeVideoClips(project, time)
  const signature = sceneSignature(project, stage, clips)
  if (signature === lastSignature && stage === stageRef) return
  lastSignature = signature
  stageRef = stage
  const root = ensureRoot(stage)
  root.replaceChildren()

  const directMedia = stage.querySelectorAll<HTMLElement>(':scope > video:not(.vfs-scene-compositor), :scope > img:not(.vfs-scene-compositor)')
  directMedia.forEach((node) => { node.style.visibility = clips.length ? 'hidden' : 'visible' })

  clips.forEach((clip, index) => {
    const media = getAsset(project, clip.assetId)
    if (!media || (media.kind !== 'video' && media.kind !== 'image')) return
    const layer = document.createElement('div')
    layer.className = `vfs-scene-layer${selectedClipId === clip.id ? ' is-selected' : ''}`
    layer.dataset.clipId = clip.id
    const transform = transformFor(clip, index)
    applyTransform(layer, transform)
    layer.style.zIndex = String(FRONT_Z - (finite(clip.lane, 0) * LANE_STEP) + index)

    const mediaWrap = document.createElement('div')
    mediaWrap.className = 'vfs-scene-media'
    const element = media.kind === 'image' ? document.createElement('img') : document.createElement('video')
    element.src = media.url
    element.draggable = false
    element.addEventListener('error', () => {
      layer.dataset.mediaError = '1'
      const fresh = readProject()
      if (fresh) {
        const current = getAsset(fresh, clip.assetId)
        if (current?.url && current.url !== element.src) {
          element.src = current.url
          lastSignature = ''
        }
      }
    })
    if (element instanceof HTMLVideoElement) {
      element.muted = true
      element.playsInline = true
      element.preload = 'auto'
      const localTime = Math.max(0, time - finite(clip.start, 0))
      try { element.currentTime = localTime } catch { /* browser may not be seekable yet */ }
    }
    mediaWrap.appendChild(element)
    layer.appendChild(mediaWrap)

    ;['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((handle) => {
      const node = document.createElement('div')
      node.className = `vfs-scene-handle ${handle}`
      node.dataset.handle = handle
      node.style.display = selectedClipId === clip.id ? 'block' : 'none'
      layer.appendChild(node)
    })

    bindLayer(layer, clip, transform, stage)
    root.appendChild(layer)
    if (selectedClipId === clip.id) showControls(project, clip, transform)
  })

  if (!clips.some((clip) => clip.id === selectedClipId) && controlsRef) controlsRef.style.display = 'none'
}

function sync() {
  injectStyles()
  removeLegacyUi()
  const stage = document.querySelector<HTMLElement>('.video-stage')
  const project = readProject()
  if (stage && project) {
    const clips = activeVideoClips(project, finite(project.playhead, 0))
    const signature = sceneSignature(project, stage, clips)
    if (stage !== stageRef || signature !== lastSignature || !rootRef?.isConnected) rebuild()
    if (rootRef?.isConnected) {
      rootRef.querySelectorAll<HTMLVideoElement>('.vfs-scene-layer video').forEach((video) => {
        const layer = video.closest<HTMLElement>('.vfs-scene-layer')
        const clip = project.clips.find((item) => item.id === layer?.dataset.clipId)
        if (!clip) return
        const localTime = Math.max(0, finite(project.playhead, 0) - finite(clip.start, 0))
        try {
          if (Math.abs(video.currentTime - localTime) > 0.15) video.currentTime = localTime
        } catch { /* ignore transient media state */ }
      })
    }
  }
  rafId = window.requestAnimationFrame(sync)
}

window.addEventListener('storage', () => { lastSignature = ''; rebuild() })
window.addEventListener('vfs-project-changed', () => { lastSignature = ''; rebuild() })
window.addEventListener('popstate', () => { lastSignature = ''; rebuild() })
window.addEventListener('beforeunload', () => { window.cancelAnimationFrame(rafId) })

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { rebuild(); rafId = window.requestAnimationFrame(sync) }, { once: true })
} else {
  rebuild()
  rafId = window.requestAnimationFrame(sync)
}
