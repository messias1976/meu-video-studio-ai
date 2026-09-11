import { useEditorStore } from '../editor/store'

type Corner = 'tl' | 'tr' | 'bl' | 'br'

function getCorner(el: HTMLElement): Corner | null {
  const all = Array.from(el.parentElement?.querySelectorAll('i') ?? [])
  const index = all.indexOf(el)
  return index === 0 ? 'tl' : index === 1 ? 'tr' : index === 2 ? 'bl' : index === 3 ? 'br' : null
}

function attach() {
  document.querySelectorAll<HTMLElement>('.preview-layer.selected .selection-box i').forEach((handle) => {
    if (handle.dataset.resizeBound) return
    handle.dataset.resizeBound = '1'
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const corner = getCorner(handle)
      const layer = handle.closest<HTMLElement>('.preview-layer')
      const canvas = handle.closest<HTMLElement>('.preview-canvas')
      if (!corner || !layer || !canvas) return

      const clipId = useEditorStore.getState().selectedClipId
      if (!clipId) return
      const clip = useEditorStore.getState().project.clips.find((c) => c.id === clipId)
      if (!clip) return

      const rect = canvas.getBoundingClientRect()
      const startX = event.clientX
      const startY = event.clientY
      const start = { x: clip.x, y: clip.y, width: clip.width, height: clip.height }
      const min = 5

      const move = (e: PointerEvent) => {
        const dx = ((e.clientX - startX) / rect.width) * 100
        const dy = ((e.clientY - startY) / rect.height) * 100
        let width = start.width
        let height = start.height
        let x = start.x
        let y = start.y

        if (corner.includes('r')) width = Math.max(min, start.width + dx)
        if (corner.includes('l')) width = Math.max(min, start.width - dx)
        if (corner.includes('b')) height = Math.max(min, start.height + dy)
        if (corner.includes('t')) height = Math.max(min, start.height - dy)

        if (corner.includes('l')) x = start.x + (start.width - width) / 2
        if (corner.includes('r')) x = start.x + (width - start.width) / 2
        if (corner.includes('t')) y = start.y + (start.height - height) / 2
        if (corner.includes('b')) y = start.y + (height - start.height) / 2

        useEditorStore.getState().updateClip(clipId, {
          x: Math.max(-100, Math.min(200, x)),
          y: Math.max(-100, Math.min(200, y)),
          width: Math.max(min, Math.min(200, width)),
          height: Math.max(min, Math.min(200, height)),
        })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        document.body.style.cursor = ''
      }
      document.body.style.cursor = handle.style.cursor || 'nwse-resize'
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up, { once: true })
    })
  })
}

const observer = new MutationObserver(attach)
observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
attach()
