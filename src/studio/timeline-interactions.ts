import { useEffect } from 'react'
import { useEditorStore } from '../editor/store'

function getPps(): number {
  const ticks = Array.from(document.querySelectorAll<HTMLElement>('.fx-ruler span'))
  if (ticks.length >= 2) {
    const a = Number.parseFloat(ticks[0].style.left)
    const b = Number.parseFloat(ticks[1].style.left)
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return b - a
  }
  return 91.2
}

function seekFromClientX(clientX: number) {
  const inner = document.querySelector<HTMLElement>('.fx-timeline-inner')
  if (!inner) return
  const rect = inner.getBoundingClientRect()
  const next = Math.max(0, (clientX - rect.left) / getPps())
  useEditorStore.getState().setPlayhead(Number(next.toFixed(2)))
}

function getClipFromElement(el: HTMLElement) {
  const row = el.closest('.fx-track-row') as HTMLElement | null
  if (!row) return null
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.fx-track-row'))
  const trackIndex = rows.indexOf(row)
  const clipElements = Array.from(row.querySelectorAll<HTMLElement>(':scope > .fx-clip'))
  const clipIndex = clipElements.indexOf(el)
  if (trackIndex < 0 || clipIndex < 0) return null
  const clips = useEditorStore.getState().project.clips.filter(c => c.trackIndex === trackIndex)
  return clips[clipIndex] ?? null
}

export default function TimelineInteractions() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let scheduled = false

    const bind = () => {
      cleanup?.()
      const timeline = document.querySelector<HTMLElement>('.fx-timeline')
      if (!timeline) return
      const disposers: Array<() => void> = []
      const ruler = timeline.querySelector<HTMLElement>('.fx-ruler')
      const playhead = timeline.querySelector<HTMLElement>('.fx-playhead')

      if (ruler) {
        const onRulerDown = (event: PointerEvent) => {
          if ((event.target as HTMLElement).closest('.fx-clip')) return
          event.preventDefault()
          seekFromClientX(event.clientX)
          const move = (ev: PointerEvent) => seekFromClientX(ev.clientX)
          const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }
        ruler.addEventListener('pointerdown', onRulerDown)
        disposers.push(() => ruler.removeEventListener('pointerdown', onRulerDown))
      }

      if (playhead) {
        const onPlayheadDown = (event: PointerEvent) => {
          event.preventDefault()
          event.stopPropagation()
          const move = (ev: PointerEvent) => seekFromClientX(ev.clientX)
          const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
          seekFromClientX(event.clientX)
        }
        playhead.style.cursor = 'ew-resize'
        playhead.style.zIndex = '20'
        playhead.addEventListener('pointerdown', onPlayheadDown)
        disposers.push(() => playhead.removeEventListener('pointerdown', onPlayheadDown))
      }

      const clips = Array.from(timeline.querySelectorAll<HTMLElement>('.fx-clip'))
      clips.forEach(el => {
        const onClipDown = (event: PointerEvent) => {
          const target = event.target as HTMLElement
          if (target.closest('.fx-clip-handle')) return
          const clip = getClipFromElement(el)
          if (!clip) return

          event.preventDefault()
          event.stopPropagation()
          useEditorStore.getState().selectClip(clip.id)

          const startX = event.clientX
          const startY = event.clientY
          const initialStart = clip.start
          const initialTrack = clip.trackIndex
          const initialDuration = clip.duration
          const pps = getPps()
          let draftStart = initialStart
          let draftTrack = initialTrack

          const move = (ev: PointerEvent) => {
            draftStart = Math.max(0, Number((initialStart + (ev.clientX - startX) / pps).toFixed(2)))

            const rows = Array.from(document.querySelectorAll<HTMLElement>('.fx-track-row'))
            const hit = rows.findIndex(row => {
              const rect = row.getBoundingClientRect()
              return ev.clientY >= rect.top && ev.clientY <= rect.bottom
            })
            if (hit >= 0 && Math.abs(ev.clientY - startY) > 8) draftTrack = hit

            // Mantém a posição visual durante o arraste sem reescrever a duração.
            el.style.left = `${draftStart * pps}px`
            el.style.opacity = '0.86'
          }

          const up = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
            const state = useEditorStore.getState()
            if (clip.track === 'video' && draftTrack === 3) draftTrack = initialTrack
            if (clip.track === 'audio' && draftTrack !== 3) draftTrack = initialTrack
            state.updateClip(clip.id, {
              start: draftStart,
              duration: initialDuration,
              trackIndex: draftTrack,
            })
            el.style.opacity = ''
          }

          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }

        el.addEventListener('pointerdown', onClipDown)
        el.style.cursor = 'grab'
        disposers.push(() => el.removeEventListener('pointerdown', onClipDown))
      })

      cleanup = () => disposers.forEach(dispose => dispose())
    }

    const scheduleBind = () => {
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        bind()
      })
    }

    const observer = new MutationObserver(scheduleBind)
    observer.observe(document.body, { childList: true, subtree: true })
    bind()

    return () => {
      cleanup?.()
      observer.disconnect()
    }
  }, [])

  return null
}
