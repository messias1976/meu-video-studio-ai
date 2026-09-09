import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
const PHASE4_KEY = 'meu-video-studio-ai:phase4:v1'
const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
const ffmpeg = new FFmpeg()
let loaded = false
let loading = null
let exporting = false

const state = { progress: 0, message: '' }

function getProject() {
  const match = window.location.pathname.match(/\/editor\/([^/]+)/)
  if (!match) return null
  try {
    const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]')
    return projects.find((project) => project.id === match[1]) || null
  } catch {
    return null
  }
}

function getPhase4State() {
  try { return JSON.parse(localStorage.getItem(PHASE4_KEY) || '{}') } catch { return {} }
}

function updateStatus(message, progress) {
  state.message = message
  if (typeof progress === 'number') state.progress = Math.max(0, Math.min(1, progress))
  const save = document.querySelector('.save-state')
  if (save) save.innerHTML = `<span class="status-dot" /> ${message}`
  const fill = document.querySelector('.vfs-export-progress-fill')
  const label = document.querySelector('.vfs-export-progress-label')
  if (fill) fill.style.width = `${state.progress * 100}%`
  if (label) label.textContent = `${message} ${Math.round(state.progress * 100)}%`
}

function dimensions(project) {
  const base = project.resolution === '720p' ? [1280, 720] : project.resolution === '2K' ? [2560, 1440] : project.resolution === '4K' ? [3840, 2160] : [1920, 1080]
  if (project.format === '9:16') return [base[1], base[0]]
  if (project.format === '1:1') return [Math.min(base[0], base[1]), Math.min(base[0], base[1])]
  if (project.format === '4:5') return [Math.round(base[1] * 0.8), base[1]]
  return base
}

function filterGraph(project) {
  const intensity = Math.max(0, Math.min(1, Number(project.filterIntensity ?? 100) / 100))
  switch (project.filter) {
    case 'P&B': return `eq=saturation=${Math.max(0, 1 - intensity)}`
    case 'Quente': return `eq=saturation=${1 + 0.3 * intensity}:gamma_r=${1 + 0.08 * intensity}:gamma_b=${1 - 0.05 * intensity}`
    case 'Frio': return `eq=saturation=${1 - 0.1 * intensity}:gamma_b=${1 + 0.08 * intensity}:gamma_r=${1 - 0.05 * intensity}`
    case 'Vintage': return `eq=saturation=${1 - 0.18 * intensity}:contrast=${1 + 0.08 * intensity},colorbalance=rs=${0.06 * intensity}:bs=${0.03 * intensity}`
    case 'Cinemático': return `eq=contrast=${1 + 0.14 * intensity}:saturation=${1 - 0.08 * intensity}:gamma=${1 - 0.03 * intensity}`
    case 'Vibrante': return `eq=contrast=${1 + 0.05 * intensity}:saturation=${1 + 0.45 * intensity}`
    default: return 'null'
  }
}

function effectGraph(effect) {
  switch (effect) {
    case 'Desfoque': return 'boxblur=2:1'
    case 'Cinema': return 'eq=contrast=1.12:saturation=0.92'
    case 'Retro': return 'noise=alls=8:allf=t+u,eq=saturation=0.82:contrast=1.03'
    case 'Luz': return 'eq=brightness=0.06:saturation=1.06'
    case 'Zoom': return 'scale=iw*1.08:ih*1.08,crop=iw/1.08:ih/1.08'
    case 'Glitch': return 'rgbashift=rh=-4:bh=4'
    case 'Flash': return 'eq=brightness=0.08:contrast=1.02'
    case 'Partículas': return 'noise=alls=10:allf=t'
    default: return 'null'
  }
}

function transitionGraph(name, duration) {
  const d = Math.max(0.1, Math.min(1, duration || 0.5)).toFixed(3)
  switch (name) {
    case 'Fade': return `fade=t=in:st=0:d=${d}:alpha=0`
    case 'Blur': return `fade=t=in:st=0:d=${d}:alpha=0`
    case 'Flash': return `fade=t=in:st=0:d=${d}:alpha=0`
    case 'Zoom': return `scale=iw*1.04:ih*1.04,crop=iw/1.04:ih/1.04`
    case 'Slide': return `fade=t=in:st=0:d=${d}:alpha=0`
    case 'Rotate': return `rotate=-0.035*PI*sin(PI*t/${d})`
    case 'Glitch': return 'rgbashift=rh=-3:bh=3'
    default: return 'null'
  }
}

function safeName(name, fallback) {
  const extension = name?.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : fallback
  return `vfs-${crypto.randomUUID()}${extension}`
}

async function ensureLoaded() {
  if (loaded) return
  if (loading) return loading
  loading = (async () => {
    updateStatus('Carregando motor FFmpeg...', 0.03)
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpeg.on('progress', ({ progress }) => updateStatus('Renderizando composição...', 0.15 + progress * 0.75))
    ffmpeg.on('log', ({ message }) => {
      if (/error|failed|invalid/i.test(message)) console.warn('[FFmpeg]', message)
    })
    loaded = true
    updateStatus('FFmpeg pronto', 0.08)
  })().catch((error) => {
    loading = null
    throw error
  })
  return loading
}

function ensureProgressUi() {
  if (document.querySelector('.vfs-export-progress')) return
  const card = document.querySelector('.modal-card')
  if (!card) return
  const progress = document.createElement('div')
  progress.className = 'vfs-export-progress'
  progress.innerHTML = '<div class="vfs-export-progress-label">Preparando renderização...</div><div class="vfs-export-progress-track"><div class="vfs-export-progress-fill"></div></div>'
  card.querySelector('.export-note')?.insertAdjacentElement('afterend', progress)
}

async function writeAssets(project, clips) {
  const unique = new Map()
  clips.forEach((clip) => {
    const asset = project.media.find((item) => item.id === clip.assetId)
    if (asset) unique.set(asset.id, asset)
  })
  const written = new Map()
  for (const asset of unique.values()) {
    if (!asset.url) continue
    const fileName = safeName(asset.name, asset.kind === 'audio' ? '.mp3' : asset.kind === 'image' ? '.png' : '.mp4')
    await ffmpeg.writeFile(fileName, await fetchFile(asset.url))
    written.set(asset.id, { ...asset, fileName })
  }
  return written
}

async function writeTextOverlays(project, texts, width, height) {
  const written = new Map()
  for (const text of texts) {
    if (!text.text?.trim()) continue
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.clearRect(0, 0, width, height)
    const scale = width / 1080
    ctx.font = `${Math.max(12, text.weight || 700)} ${Math.max(18, Math.round((text.fontSize || 40) * scale))}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (text.shadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 12 * scale; ctx.shadowOffsetY = 3 * scale }
    ctx.fillStyle = text.color || '#ffffff'
    ctx.fillText(text.text, width * Number(text.x ?? 50) / 100, height * Number(text.y ?? 50) / 100)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) continue
    const fileName = `vfs-text-${crypto.randomUUID()}.png`
    await ffmpeg.writeFile(fileName, new Uint8Array(await blob.arrayBuffer()))
    written.set(text.id, fileName)
  }
  return written
}

function buildVideoGraph(project, videoClips, written, textOverlays, width, height, total, phase4) {
  const fps = project.fps
  const filter = filterGraph(project)
  const effect = effectGraph(phase4.effect)
  const transition = transitionGraph(phase4.transition, 0.6)
  const base = [`color=c=black:s=${width}x${height}:r=${fps}:d=${total}[base0]`]
  const inputs = []
  const chains = []
  let rendered = 0

  videoClips.forEach((clip) => {
    const asset = written.get(clip.assetId)
    if (!asset) return
    const inputIndex = rendered
    rendered += 1
    inputs.push(asset.kind === 'image' ? ['-loop', '1', '-t', Math.max(0.05, clip.duration).toFixed(3), '-i', asset.fileName] : ['-i', asset.fileName])
    const source = `[${inputIndex}:v]`
    const filters = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      'setsar=1',
      `fps=${fps}`,
      `trim=duration=${Math.max(0.05, clip.duration).toFixed(3)}`,
      'setpts=PTS-STARTPTS',
      filter,
      effect,
      transition,
    ].filter((item) => item && item !== 'null')
    chains.push(`${source}${filters.length ? ',' + filters.join(',') : ''}[v${inputIndex}]`)
    const next = `base${rendered}`
    base.push(`[base${rendered - 1}][v${inputIndex}]overlay=0:0:enable='between(t,${Math.max(0, clip.start).toFixed(3)},${Math.min(total, clip.start + clip.duration).toFixed(3)})'[${next}]`)
  })

  let current = `base${rendered}`
  let textIndex = 0
  for (const text of project.texts || []) {
    const fileName = textOverlays.get(text.id)
    if (!fileName) continue
    const inputIndex = rendered + textIndex
    inputs.push(['-loop', '1', '-t', Math.max(0.05, total).toFixed(3), '-i', fileName])
    const out = `texted${textIndex}`
    const x = Math.round(width * Number(text.x ?? 50) / 100)
    const y = Math.round(height * Number(text.y ?? 50) / 100)
    base.push(`[${current}][${inputIndex}:v]overlay=${x}: ${y}:enable='between(t,0,${total.toFixed(3)})'[${out}]`.replace(': ', ':'))
    current = out
    textIndex += 1
  }

  const safeOutput = rendered ? (textIndex ? `[texted${textIndex - 1}]` : `[base${rendered}]`) : '[base0]'
  return { inputs, graph: [...chains, ...base].join(';'), output: safeOutput, rendered, textRendered: textIndex }
}

function buildAudioGraph(audioClips, written, total, inputOffset) {
  const entries = []
  const inputs = []
  let rendered = 0
  audioClips.forEach((clip) => {
    const asset = written.get(clip.assetId)
    if (!asset) return
    inputs.push(['-i', asset.fileName])
    const ffIndex = inputOffset + rendered
    const delayMs = Math.max(0, Math.round((clip.start || 0) * 1000))
    const duration = Math.max(0.05, Math.min(clip.duration || total, total))
    entries.push(`[${ffIndex}:a]atrim=duration=${duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${delayMs}:all=1[a${rendered}]`)
    rendered += 1
  })
  if (!entries.length) return { inputs, graph: '', output: null, rendered: 0 }
  const mix = entries.map((_, index) => `[a${index}]`).join('')
  return { inputs, graph: `${entries.join(';')};${mix}amix=inputs=${rendered}:duration=longest:dropout_transition=0,atrim=duration=${total.toFixed(3)},asetpts=PTS-STARTPTS[aout]`, output: '[aout]', rendered }
}

async function exportTimelineWithFFmpeg() {
  if (exporting) return
  const project = getProject()
  if (!project) return

  const allVideoClips = project.clips.filter((clip) => clip.track === 'video').sort((a, b) => a.start - b.start)
  const allAudioClips = project.clips.filter((clip) => clip.track === 'audio').sort((a, b) => a.start - b.start)
  const videoClips = allVideoClips.filter((clip) => project.media.some((asset) => asset.id === clip.assetId && asset.url))
  const audioClips = allAudioClips.filter((clip) => project.media.some((asset) => asset.id === clip.assetId && asset.url))
  if (!videoClips.length) {
    updateStatus('Adicione pelo menos um vídeo ou imagem à Timeline.', 0)
    return
  }

  exporting = true
  ensureProgressUi()
  const temporaryFiles = []
  try {
    await ensureLoaded()
    const total = Math.max(0.5, ...videoClips.map((clip) => clip.start + clip.duration), ...audioClips.map((clip) => clip.start + clip.duration))
    const [width, height] = dimensions(project)
    const phase4 = getPhase4State()
    updateStatus('Lendo mídias da Timeline...', 0.1)
    const written = await writeAssets(project, [...videoClips, ...audioClips])
    for (const asset of written.values()) temporaryFiles.push(asset.fileName)
    const textOverlays = await writeTextOverlays(project, project.texts || [], width, height)
    for (const fileName of textOverlays.values()) temporaryFiles.push(fileName)

    const video = buildVideoGraph(project, videoClips, written, textOverlays, width, height, total, phase4)
    const audio = buildAudioGraph(audioClips, written, total, video.rendered + video.textRendered)
    const args = []
    video.inputs.forEach((group) => args.push(...group))
    audio.inputs.forEach((group) => args.push(...group))
    if (!video.rendered) throw new Error('Nenhum clip de vídeo pôde ser renderizado.')
    const filterParts = [video.graph, audio.graph].filter(Boolean).join(';')
    args.push('-filter_complex', filterParts, '-map', video.output)
    if (audio.output) args.push('-map', audio.output)
    args.push('-r', String(project.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p')
    if (audio.output) args.push('-c:a', 'aac', '-b:a', '192k')
    args.push('-t', total.toFixed(3), '-movflags', '+faststart', 'meu-video-studio-timeline.mp4')

    updateStatus(`Renderizando ${video.rendered} clip(s), ${video.textRendered} texto(s) e ${audio.rendered} áudio(s)...`, 0.18)
    const code = await ffmpeg.exec(args)
    if (code !== 0) throw new Error(`FFmpeg terminou com código ${code}`)

    updateStatus('Preparando MP4...', 0.94)
    const data = await ffmpeg.readFile('meu-video-studio-timeline.mp4')
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    const blob = new Blob([bytes.buffer], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'meu-video-studio'}.mp4`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    await ffmpeg.deleteFile('meu-video-studio-timeline.mp4').catch(() => {})
    for (const fileName of temporaryFiles) await ffmpeg.deleteFile(fileName).catch(() => {})
    updateStatus(`Exportado: ${video.rendered} clip(s) + ${video.textRendered} texto(s) + ${audio.rendered} áudio(s)`, 1)
    const label = document.querySelector('.vfs-export-progress-label')
    if (label) label.textContent = 'Exportação concluída. Timeline, textos, efeitos e áudio foram processados.'
    window.setTimeout(() => document.querySelector('.modal-card .icon-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })), 1300)
  } catch (error) {
    console.error(error)
    updateStatus('Falha na renderização FFmpeg', 0)
    const label = document.querySelector('.vfs-export-progress-label')
    if (label) label.textContent = error instanceof Error ? `Falha: ${error.message}` : 'Falha ao renderizar a Timeline.'
    for (const fileName of temporaryFiles) await ffmpeg.deleteFile(fileName).catch(() => {})
  } finally {
    exporting = false
  }
}

document.addEventListener('click', (event) => {
  const target = event.target
  const button = target instanceof Element ? target.closest('button') : null
  if (!button || !button.textContent?.includes('Exportar agora')) return
  if (!window.location.pathname.startsWith('/editor/')) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  void exportTimelineWithFFmpeg()
}, true)

const css = document.createElement('style')
css.textContent = `
.vfs-export-progress{margin-top:12px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0d0d11}
.vfs-export-progress-label{font-size:9px;color:#aaa;line-height:1.5;margin-bottom:7px}
.vfs-export-progress-track{height:5px;border-radius:99px;background:#202026;overflow:hidden}
.vfs-export-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width .2s ease}
`
document.head.appendChild(css)
