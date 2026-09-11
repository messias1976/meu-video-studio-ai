import { useEffect } from 'react'
import { useEditorStore } from '../editor/store'
import type { Clip } from '../editor/types'

type Point = { x: number; y: number }

type Box = { left: number; top: number; width: number; height: number }

const HANDLE_CLASS = 'fx-transform-handle'
const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

function activeVisualClips(): Clip[] {
  const { project } = useEditorStore.getState()
  return project.clips
    .filter(c => c.track !== 'audio' && project.playhead >= c.start && project.playhead < c.start + c.duration)
    .sort((a, b) => b.trackIndex - a.trackIndex)
}

function ensureHandles(layer: HTMLElement, clip: Clip) {
  let handles = layer.querySelectorAll<HTMLElement>(`.${HANDLE_CLASS}`)
  if (handles.length === HANDLE_DIRS.length) return
  handles.forEach(h => h.remove())
  HANDLE_DIRS.forEach(dir => {
    const el = document.createElement('div')
    el.className = `${HANDLE_CLASS} ${HANDLE_CLASS}-${dir}`
    el.dataset.dir = dir
    el.title = `Redimensionar ${dir}`
    el.style.position = 'absolute'
    el.style.width = '10px'
    el.style.height = '10px'
    el.style.margin = '-5px'
    el.style.borderRadius = '3px'
    el.style.background = '#ffffff'
    el.style.border = '2px solid #7c5cff'
    el.style.boxSizing = 'border-box'
    el.style.zIndex = '1000'
    el.style.pointerEvents = 'auto'
    const pos: Record<string, Partial<CSSStyleDeclaration>> = {
      nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
      n: { left: '50%', top: '0%', cursor: 'ns-resize' },
      ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
      e: { left: '100%', top: '50%', cursor: 'ew-resize' },
      se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
      s: { left: '50%', top: '100%', cursor: 'ns-resize' },
      sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
      w: { left: '0%', top: '50%', cursor: 'ew-resize' },
    }
    Object.assign(el.style, pos[dir])
    el.addEventListener('pointerdown', e => {
      e.preventDefault()
      e.stopPropagation()
      startResize(e, clip, dir)
    })
    layer.appendChild(el)
  })
}

function startResize(event: PointerEvent, clip: Clip, dir: typeof HANDLE_DIRS[number]) {
  const state = useEditorStore.getState()
  const canvas = document.querySelector<HTMLElement>('.fx-canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const start: Box = { left: clip.x, top: clip.y, width: clip.width, height: clip.height }
  const origin: Point = { x: event.clientX, y: event.clientY }
  const min = 2
  const move = (ev: PointerEvent) => {
    const dx = ((ev.clientX - origin.x) / rect.width) * 100
    const dy = ((ev.clientY - origin.y) / rect.height) * 100
    let left = start.left
    let top = start.top
    let width = start.width
    let height = start.height
    if (dir.includes('e')) width = start.width + dx
    if (dir.includes('w')) { left = start.left + dx; width = start.width - dx }
    if (dir.includes('s')) height = start.height + dy
    if (dir.includes('n')) { top = start.top + dy; height = start.height - dy }
    if (width < min) { width = min; if (dir.includes('w')) left = start.left + start.width - min }
    if (height < min) { height = min; if (dir.includes('n')) top = start.top + start.height - min }
    state.updateClip(clip.id, {
      x: Number(left.toFixed(2)),
      y: Number(top.toFixed(2)),
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
    })
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function bindLayerMovement(layer: HTMLElement, clip: Clip) {
  if (layer.dataset.transformBound === clip.id) return
  layer.dataset.transformBound = clip.id
  layer.addEventListener('pointerdown', event => {
    const target = event.target as HTMLElement
    if (target.closest(`.${HANDLE_CLASS}`)) return
    if (target.closest('video, img')) {
      event.preventDefault()
      event.stopPropagation()
      useEditorStore.getState().selectClip(clip.id)
      const canvas = document.querySelector<HTMLElement>('.fx-canvas')
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const origin = { x: event.clientX, y: event.clientY }
      const start = { x: clip.x, y: clip.y }
      const move = (ev: PointerEvent) => {
        const dx = ((ev.clientX - origin.x) / rect.width) * 100
        const dy = ((ev.clientY - origin.y) / rect.height) * 100
        useEditorStore.getState().updateClip(clip.id, {
          x: Number((start.x + dx).toFixed(2)),
          y: Number((start.y + dy).toFixed(2)),
        })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  })
}

export default function PreviewInteractionController() {
  const project = useEditorStore(s => s.project)
  const selectedClipId = useEditorStore(s => s.selectedClipId)

  useEffect(() => {
    const sync = () => {
      const clips = activeVisualClips()
      const layers = Array.from(document.querySelectorAll<HTMLElement>('.fx-layer'))
      layers.forEach((layer, index) => {
        const clip = clips[index]
        if (!clip) return
        layer.style.zIndex = clip.name === 'Título' || clip.name === 'Subtítulo' || layer.querySelector('.fx-text-preview') ? '999' : String(Math.max(1, 100 - clip.trackIndex))
        bindLayerMovement(layer, clip)
        if (selectedClipId === clip.id) ensureHandles(layer, clip)
        else layer.querySelectorAll(`.${HANDLE_CLASS}`).forEach(h => h.remove())
      })
    }
    const id = window.setTimeout(sync, 0)
    return () => window.clearTimeout(id)
  }, [project.playhead, project.clips, selectedClipId])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      window.setTimeout(() => {
        const clips = activeVisualClips()
        const layers = Array.from(document.querySelectorAll<HTMLElement>('.fx-layer'))
        layers.forEach((layer, index) => {
          const clip = clips[index]
          if (!clip) return
          layer.style.zIndex = clip.name === 'Título' || clip.name === 'Subtítulo' || !!layer.querySelector('.fx-text-preview') ? '999' : String(Math.max(1, 100 - clip.trackIndex))
          bindLayerMovement(layer, clip)
          if (useEditorStore.getState().selectedClipId === clip.id) ensureHandles(layer, clip)
        })
      }, 0)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
