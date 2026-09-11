import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../editor/store'
import type { Clip, MediaAsset } from '../editor/types'

function syncVideoPreview() {
  const { project } = useEditorStore.getState()
  const activeVideos = project.clips
    .filter(c => c.track !== 'audio' && project.playhead >= c.start && project.playhead < c.start + c.duration)
    .sort((a, b) => b.trackIndex - a.trackIndex)

  const layers = Array.from(document.querySelectorAll<HTMLElement>('.fx-layer'))
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.fx-layer video'))

  videos.forEach(video => {
    const layer = video.closest('.fx-layer') as HTMLElement | null
    if (!layer) return
    const index = layers.indexOf(layer)
    const clip = activeVideos[index]
    if (!clip) return

    const localTime = Math.max(0, project.playhead - clip.start)
    try {
      video.muted = true
      video.volume = 0
      video.playsInline = true
      if (Math.abs(video.currentTime - localTime) > 0.025) video.currentTime = localTime
      if (project.isPlaying) void video.play().catch(() => undefined)
      else {
        video.currentTime = localTime
        video.pause()
      }
    } catch {
      // O elemento pode ser desmontado durante a troca da agulha/camada.
    }
  })
}

function AudioClip({ clip, asset, playing, playhead }: { clip: Clip; asset: MediaAsset; playing: boolean; playhead: number }) {
  useEffect(() => {
    const audio = document.querySelector<HTMLAudioElement>(`audio[data-audio-clip="${clip.id}"]`)
    if (!audio) return

    const sync = () => {
      try {
        const localTime = Math.max(0, playhead - clip.start)
        audio.volume = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume))
        if (Math.abs(audio.currentTime - localTime) > 0.035) audio.currentTime = localTime
        if (playing && !clip.muted && audio.volume > 0) void audio.play().catch(() => undefined)
        else audio.pause()
      } catch {
        // O elemento pode ser desmontado durante a troca da agulha.
      }
    }

    if (audio.readyState >= 1) sync()
    else audio.addEventListener('loadedmetadata', sync, { once: true })
    return () => audio.removeEventListener('loadedmetadata', sync)
  }, [clip.id, clip.start, clip.duration, clip.volume, clip.muted, playing, playhead])

  return <audio data-audio-clip={clip.id} src={asset.url} preload="auto" />
}

export default function PreviewComposition() {
  const project = useEditorStore(s => s.project)
  const activeAudio = project.clips.filter(
    c => c.track === 'audio' && project.playhead >= c.start && project.playhead < c.start + c.duration,
  )

  useEffect(() => {
    const id = window.setTimeout(syncVideoPreview, 0)
    return () => window.clearTimeout(id)
  }, [project.playhead, project.isPlaying, project.clips])

  useEffect(() => {
    const observer = new MutationObserver(() => syncVideoPreview())
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return createPortal(
    <>
      {activeAudio.map(clip => {
        const asset = project.media.find(item => item.id === clip.assetId)
        return asset?.url ? (
          <AudioClip key={clip.id} clip={clip} asset={asset} playing={project.isPlaying} playhead={project.playhead} />
        ) : null
      })}
    </>,
    document.body,
  )
}
