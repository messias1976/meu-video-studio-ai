import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
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

function selectedAsset(project) {
  const name = document.querySelector('.canvas-toolbar span')?.textContent?.trim()
  return project.media.find((asset) => asset.kind === 'video' && asset.name === name) || project.media.find((asset) => asset.kind === 'video') || null
}

function updateStatus(message, progress) {
  state.message = message
  if (typeof progress === 'number') state.progress = Math.max(0, Math.min(1, progress))
  const save = document.querySelector('.save-state')
  if (save) save.innerHTML = `<span class="status-dot" /> ${message}`
  const bar = document.querySelector('.vfs-export-progress')
  const fill = document.querySelector('.vfs-export-progress-fill')
  const label = document.querySelector('.vfs-export-progress-label')
  if (bar) bar.style.display = 'block'
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
    case 'P&B': return `format=yuv420p,eq=saturation=${Math.max(0, 1 - intensity)}`
    case 'Quente': return `eq=saturation=${1 + 0.3 * intensity}:gamma_r=${1 + 0.08 * intensity}:gamma_b=${1 - 0.05 * intensity}`
    case 'Frio': return `eq=saturation=${1 - 0.1 * intensity}:gamma_b=${1 + 0.08 * intensity}:gamma_r=${1 - 0.05 * intensity}`
    case 'Vintage': return `eq=saturation=${1 - 0.18 * intensity}:contrast=${1 + 0.08 * intensity},colorbalance=rs=${0.06 * intensity}:bs=${0.03 * intensity}`
    case 'Cinemático': return `eq=contrast=${1 + 0.14 * intensity}:saturation=${1 - 0.08 * intensity}:gamma=${1 - 0.03 * intensity}`
    case 'Vibrante': return `eq=contrast=${1 + 0.05 * intensity}:saturation=${1 + 0.45 * intensity}`
    default: return 'format=yuv420p'
  }
}

async function ensureLoaded() {
  if (loaded) return
  if (loading) return loading
  loading = (async () => {
    updateStatus('Carregando motor FFmpeg...', 0.04)
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpeg.on('progress', ({ progress }) => updateStatus('Processando vídeo...', progress))
    ffmpeg.on('log', ({ message }) => {
      if (/error|failed|invalid/i.test(message)) console.warn('[FFmpeg]', message)
    })
    loaded = true
    updateStatus('FFmpeg pronto', 0.1)
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
  progress.innerHTML = '<div class="vfs-export-progress-label">Preparando FFmpeg...</div><div class="vfs-export-progress-track"><div class="vfs-export-progress-fill"></div></div>'
  card.querySelector('.export-note')?.insertAdjacentElement('afterend', progress)
}

async function exportWithFFmpeg() {
  if (exporting) return
  const project = getProject()
  if (!project) return
  const asset = selectedAsset(project)
  if (!asset) {
    updateStatus('Selecione um vídeo para exportar.', 0)
    return
  }

  exporting = true
  ensureProgressUi()
  try {
    await ensureLoaded()
    updateStatus('Lendo vídeo...', 0.12)
    const extension = asset.file?.name?.split('.').pop()?.toLowerCase() || 'mp4'
    const inputName = `input-${Date.now()}.${extension}`
    const outputName = 'meu-video-studio-export.mp4'
    await ffmpeg.writeFile(inputName, await fetchFile(asset.url))

    const [width, height] = dimensions(project)
    const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${filterGraph(project)}`
    const clip = project.clips.find((item) => item.track === 'video' && item.assetId === asset.id)
    const maxDuration = Math.max(0.5, Number(clip?.duration || asset.duration || 0))
    const args = ['-i', inputName, '-vf', vf, '-r', String(project.fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k']
    if (maxDuration > 0 && Number.isFinite(maxDuration)) args.push('-t', maxDuration.toFixed(3))
    args.push('-movflags', '+faststart', outputName)

    updateStatus('Processando vídeo...', 0.18)
    const code = await ffmpeg.exec(args)
    if (code !== 0) throw new Error(`FFmpeg terminou com código ${code}`)

    updateStatus('Preparando arquivo MP4...', 0.96)
    const data = await ffmpeg.readFile(outputName)
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'video'}.mp4`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
    updateStatus('Exportado em MP4 com FFmpeg', 1)
    const label = document.querySelector('.vfs-export-progress-label')
    if (label) label.textContent = 'Exportação concluída. O MP4 foi salvo.'
    window.setTimeout(() => document.querySelector('.modal-card .icon-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })), 900)
  } catch (error) {
    console.error(error)
    updateStatus('Falha na exportação FFmpeg', 0)
    const label = document.querySelector('.vfs-export-progress-label')
    if (label) label.textContent = 'Não foi possível exportar. Verifique o formato do vídeo e tente novamente.'
  } finally {
    exporting = false
  }
}

document.addEventListener('click', (event) => {
  const button = event.target?.closest?.('button')
  if (!button) return
  const text = button.textContent?.trim() || ''
  if (!text.includes('Exportar agora')) return
  if (!window.location.pathname.startsWith('/editor/')) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  void exportWithFFmpeg()
}, true)

const css = document.createElement('style')
css.textContent = `
.vfs-export-progress{margin-top:12px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0d0d11}
.vfs-export-progress-label{font-size:9px;color:#aaa;line-height:1.5;margin-bottom:7px}
.vfs-export-progress-track{height:5px;border-radius:99px;background:#202026;overflow:hidden}
.vfs-export-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width .2s ease}
`
document.head.appendChild(css)
