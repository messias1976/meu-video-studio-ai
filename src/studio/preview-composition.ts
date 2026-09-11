import { useEffect } from 'react'
import { useEditorStore } from '../editor/store'

function syncPreview() {
  const { project } = useEditorStore.getState()
  const layers = Array.from(document.querySelectorAll<HTMLElement>('.fx-layer'))
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.fx-layer video'))

  // Cada vídeo recebe o frame correspondente ao ponto atual da agulha.
  // A ordem visual continua sendo a ordem das camadas criada pelo React.
  videos.forEach(video => {
    const layer = video.closest('.fx-layer') as HTMLElement | null
    if (!layer) return
    const layerIndex = layers.indexOf(layer)
    const clip = project.clips.filter(c => c.track !== 'audio' && project.playhead >= c.start && project.playhead < c.start + c.duration)[layerIndex]
    if (!clip) return
    const localTime = Math.max(0, project.playhead - clip.start)
    try {
      if (Number.isFinite(localTime) && Math.abs(video.currentTime - localTime) > 0.04) video.currentTime = localTime
      if (project.isPlaying) void video.play().catch(() => undefined)
      else video.pause()
    } catch {
      // O elemento pode estar sendo desmontado durante uma troca de playhead/camada.
    }
  })
}

export default function PreviewComposition() {
  const playhead = useEditorStore(s => s.project.playhead)
  const playing = useEditorStore(s => s.project.isPlaying)

  useEffect(() => {
    const id = window.setTimeout(syncPreview, 0)
    return () => window.clearTimeout(id)
  }, [playhead, playing])

  useEffect(() => {
    const observer = new MutationObserver(() => syncPreview())
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
