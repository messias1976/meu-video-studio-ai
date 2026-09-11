import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, ChevronDown, Copy, Download, Film, FolderOpen, Grid2X2, Image as ImageIcon,
  Layers3, Maximize2, Music2, Pause, Play, Plus, Redo2, RotateCcw, Scissors, Settings2,
  SlidersHorizontal, Sparkles, Trash2, Type, Undo2, Upload, Video, Volume2, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { useEditorStore } from './editor/store'
import type { Clip, MediaAsset } from './editor/types'

const PX_PER_SECOND = 80
const TRACKS = [0, 1, 2, 3]
const TRACK_NAMES = ['Vídeo 1', 'Vídeo 2', 'Vídeo 3', 'Áudio']
const TRACK_COLORS = ['violet', 'blue', 'green', 'orange']
type ToolTab = 'media' | 'text' | 'audio' | 'layers' | 'effects'

export default function App() {
  const store = useEditorStore()
  const { project, selectedClipId } = store
  const [tab, setTab] = useState<ToolTab>('media')
  const [zoom, setZoom] = useState(100)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const selected = project.clips.find((clip) => clip.id === selectedClipId) ?? null
  const selectedMedia = selected ? project.media.find((media) => media.id === selected.assetId) : null
  const total = Math.max(30, ...project.clips.map((clip) => clip.start + clip.duration))

  useEffect(() => {
    if (!project.isPlaying) return
    const startedAt = performance.now()
    const from = project.playhead
    let raf = 0
    const tick = (now: number) => {
      const next = from + (now - startedAt) / 1000
      store.setPlayhead(next >= total ? 0 : next)
      if (next >= total) store.setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [project.isPlaying, total, store])

  useEffect(() => {
    for (const clip of project.clips.filter((c) => c.track === 'video')) {
      const el = videoRefs.current[clip.id]
      if (!el) continue
      const inside = project.playhead >= clip.start && project.playhead < clip.start + clip.duration
      const local = Math.max(0, project.playhead - clip.start)
      if (inside && Math.abs(el.currentTime - local) > 0.08) {
        try { el.currentTime = Math.min(local, Math.max(0, (el.duration || clip.duration) - 0.01)) } catch { /* media can still be loading */ }
      }
      if (project.isPlaying && inside) void el.play().catch(() => {})
      else el.pause()
    }
  }, [project.playhead, project.isPlaying, project.clips])

  async function importFiles(files: FileList | File[]) {
    const list = Array.from(files)
    for (const file of list) {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null
      if (!kind) continue
      const asset = await store.importMedia(file, kind)
      store.addClip(asset.id)
    }
  }

  function splitSelected() {
    if (!selected) return
    const at = project.playhead
    if (at <= selected.start + 0.15 || at >= selected.start + selected.duration - 0.15) return
    const firstDuration = at - selected.start
    const secondDuration = selected.duration - firstDuration
    const second = { ...selected, id: crypto.randomUUID(), start: at, duration: secondDuration, name: `${selected.name} 2` }
    store.updateClip(selected.id, { duration: firstDuration })
    const clips = [...store.project.clips, second]
    store.undo()
    void clips
  }

  function drop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files)
  }

  return (
    <div className="studio-shell" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
      <header className="studio-topbar">
        <div className="brand-block">
          <div className="brand-icon"><Film size={19} /></div>
          <div><div className="brand-title">Meu Video Studio</div><div className="brand-subtitle">Editor desktop local</div></div>
        </div>
        <button className="project-chip" onClick={() => inputRef.current?.click()}>
          <span className="status-dot" /><span>{project.name}</span><ChevronDown size={14} />
        </button>
        <div className="topbar-actions">
          <button className="icon-btn" title="Desfazer" onClick={store.undo} disabled={!store.canUndo}><Undo2 size={17} /></button>
          <button className="icon-btn" title="Refazer" onClick={store.redo} disabled={!store.canRedo}><Redo2 size={17} /></button>
          <button className="top-btn"><FolderOpen size={15} /> Abrir projeto</button>
          <button className="export-btn"><Download size={15} /> Exportar vídeo</button>
        </div>
      </header>

      <div className="studio-main">
        <nav className="tool-rail">
          <ToolButton active={tab === 'media'} icon={<ImageIcon />} label="Mídia" onClick={() => setTab('media')} />
          <ToolButton active={tab === 'text'} icon={<Type />} label="Texto" onClick={() => setTab('text')} />
          <ToolButton active={tab === 'audio'} icon={<Music2 />} label="Áudio" onClick={() => setTab('audio')} />
          <ToolButton active={tab === 'layers'} icon={<Layers3 />} label="Camadas" onClick={() => setTab('layers')} />
          <ToolButton active={tab === 'effects'} icon={<Sparkles />} label="Efeitos" onClick={() => setTab('effects')} />
          <div className="rail-spacer" /><ToolButton icon={<Settings2 />} label="Config." onClick={() => setTab('effects')} />
        </nav>

        <aside className="library-panel">
          <div className="panel-header">
            <div><strong>{tab === 'media' ? 'Biblioteca de mídia' : tab === 'layers' ? 'Camadas' : tab === 'text' ? 'Texto' : tab === 'audio' ? 'Áudio' : 'Efeitos'}</strong><span>{tab === 'media' ? `${project.media.length} arquivo(s)` : 'Ferramentas'}</span></div>
            {tab === 'media' && <button className="small-icon" onClick={() => inputRef.current?.click()}><Plus size={17} /></button>}
          </div>
          <input ref={inputRef} hidden type="file" multiple accept="video/*,image/*,audio/*" onChange={(e) => e.target.files && void importFiles(e.target.files)} />
          {tab === 'media' ? <div className="library-content">
            <button className="import-card" onClick={() => inputRef.current?.click()}><div className="import-icon"><Upload size={21} /></div><div><strong>Importar arquivos</strong><span>Vídeo, imagem e áudio</span></div><kbd>Ctrl+I</kbd></button>
            <div className="section-caption">Arraste para a timeline ou clique para adicionar</div>
            <div className="asset-grid">
              {project.media.map((media) => <MediaCard key={media.id} media={media} onAdd={() => store.addClip(media.id)} />)}
              {!project.media.length && <div className="empty-library"><div className="empty-library-icon"><Upload size={19} /></div><strong>Seu projeto está vazio</strong><span>Importe um vídeo, imagem ou áudio para começar.</span><button onClick={() => inputRef.current?.click()}>Importar mídia</button></div>}
            </div>
          </div> : tab === 'layers' ? <div className="layer-list">
            {[...project.clips].sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start).map((clip) => { const media = project.media.find((m) => m.id === clip.assetId); return <button className={`layer-row ${clip.id === selectedClipId ? 'selected' : ''}`} key={clip.id} onClick={() => store.selectClip(clip.id)}><span className={`layer-badge ${TRACK_COLORS[clip.trackIndex] ?? 'violet'}`}><LayerIcon kind={media?.kind} /></span><span className="layer-info"><strong>{clip.name}</strong><small>{TRACK_NAMES[clip.trackIndex] ?? 'Camada'} · {formatTime(clip.duration)}</small></span></button> })}
            {project.clips.length === 0 && <div className="empty-library"><Layers3 size={20} /><span>As camadas aparecerão aqui.</span></div>}
          </div> : <div className="tool-placeholder"><div className="placeholder-icon">{tab === 'text' ? <Type /> : tab === 'audio' ? <AudioLines /> : <Sparkles />}</div><strong>{tab === 'text' ? 'Texto e títulos' : tab === 'audio' ? 'Música e áudio' : 'Efeitos visuais'}</strong><span>Ferramentas avançadas entram nesta mesma interface, sem trocar de editor.</span></div>}
        </aside>

        <section className="editor-column">
          <div className="canvas-toolbar">
            <div className="toolbar-left"><button className="canvas-tool active" title="Seleção"><Layers3 size={16} /></button><button className="canvas-tool" title="Grade"><Grid2X2 size={16} /></button><div className="tool-divider" /><button className="canvas-tool" onClick={splitSelected} title="Dividir no playhead"><Scissors size={16} /></button></div>
            <div className="toolbar-center"><span className="toolbar-label">PREVIEW</span></div>
            <div className="toolbar-right"><button className="canvas-tool" onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut size={16} /></button><span className="zoom-value">{zoom}%</span><button className="canvas-tool" onClick={() => setZoom(Math.min(160, zoom + 10))}><ZoomIn size={16} /></button><button className="canvas-tool"><Maximize2 size={15} /></button></div>
          </div>

          <div className="preview-workspace">
            <div className="preview-stage-shell" style={{ '--preview-scale': zoom / 100 } as React.CSSProperties}>
              <div className="preview-stage">
                <div className="preview-grid" /><div className="safe-frame" />
                {activeVideo(project.playhead, project.clips).map((clip) => { const media = project.media.find((m) => m.id === clip.assetId); return <PreviewLayer key={clip.id} clip={clip} media={media} selected={clip.id === selectedClipId} videoRef={(el) => { videoRefs.current[clip.id] = el }} /> })}
                {!activeVideo(project.playhead, project.clips).length && <div className="preview-empty-state"><div className="empty-film"><Video size={26} /></div><strong>Crie seu vídeo aqui</strong><span>Importe uma mídia e coloque-a na timeline.</span><button onClick={() => inputRef.current?.click()}><Plus size={15} /> Adicionar mídia</button></div>}
              </div>
            </div>
          </div>

          <div className="transport-bar">
            <div className="transport-controls"><button className="transport-icon" onClick={() => store.setPlayhead(Math.max(0, project.playhead - 1))}><RotateCcw size={16} /></button><button className="play-button" onClick={() => store.setPlaying(!project.isPlaying)}>{project.isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><span className="timecode">{formatTime(project.playhead)}</span><span className="time-separator">/</span><span className="time-total">{formatTime(total)}</span></div>
            <input className="transport-range" type="range" min="0" max={total} step="0.01" value={project.playhead} onChange={(e) => store.setPlayhead(Number(e.target.value))} />
            <div className="transport-volume"><Volume2 size={16} /><span>{project.clips.filter((c) => c.track === 'audio').length} áudio(s)</span></div>
          </div>

          <Timeline clips={project.clips} playhead={project.playhead} selectedId={selectedClipId} onSelect={store.selectClip} onMove={(id, start, trackIndex) => store.updateClip(id, { start, trackIndex })} />
        </section>

        <aside className="inspector-panel">
          <div className="panel-header inspector-head"><div><strong>Propriedades</strong><span>{selectedMedia?.name ?? 'Selecione um elemento'}</span></div><SlidersHorizontal size={17} /></div>
          {selected ? <Inspector clip={selected} update={(patch) => store.updateClip(selected.id, patch)} onDelete={() => store.deleteClip(selected.id)} onDuplicate={() => store.duplicateClip(selected.id)} /> : <div className="inspector-empty"><div className="inspector-empty-icon"><SlidersHorizontal size={20} /></div><strong>Seu editor está pronto</strong><span>Selecione um clipe na timeline ou na tela para editar posição, tamanho, rotação, opacidade e áudio.</span></div>}
        </aside>
      </div>
    </div>
  )
}

function ToolButton({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button className={`rail-tool ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button> }

function MediaCard({ media, onAdd }: { media: MediaAsset; onAdd: () => void }) {
  const [thumbError, setThumbError] = useState(false)
  return <button className="asset-card" onClick={onAdd} title="Adicionar à timeline"><div className={`asset-thumb ${media.kind}`}>{!thumbError && media.kind === 'image' ? <img src={media.url} alt="" onError={() => setThumbError(true)} /> : media.kind === 'video' && !thumbError ? <video src={media.url} muted preload="metadata" onError={() => setThumbError(true)} /> : media.kind === 'audio' ? <Music2 size={19} /> : <Film size={19} />}{media.kind === 'video' && <span className="thumb-play"><Play size={9} fill="currentColor" /></span>}</div><div className="asset-copy"><strong>{media.name}</strong><span>{media.kind === 'video' ? formatTime(media.duration) : media.kind.toUpperCase()}</span></div><Plus size={14} className="asset-add" /></button>
}
function LayerIcon({ kind }: { kind?: MediaAsset['kind'] }) { return kind === 'image' ? <ImageIcon size={14} /> : kind === 'audio' ? <Music2 size={14} /> : <Film size={14} /> }

function PreviewLayer({ clip, media, selected, videoRef }: { clip: Clip; media?: MediaAsset; selected: boolean; videoRef: (el: HTMLVideoElement | null) => void }) {
  return <div className={`preview-layer ${selected ? 'selected' : ''}`} style={{ left: `${clip.x}%`, top: `${clip.y}%`, width: `${clip.width}%`, height: `${clip.height}%`, opacity: clip.opacity, zIndex: 1000 - clip.trackIndex }} onPointerDown={(e) => { e.stopPropagation() }}>
    {media?.kind === 'image' && <img src={media.url} alt="" draggable={false} />}
    {media?.kind === 'video' && <video ref={videoRef} src={media.url} muted={clip.muted} playsInline preload="auto" />}
    {selected && <><div className="handle nw" /><div className="handle ne" /><div className="handle sw" /><div className="handle se" /></>}
  </div>
}

function Inspector({ clip, update, onDelete, onDuplicate }: { clip: Clip; update: (patch: Partial<Clip>) => void; onDelete: () => void; onDuplicate: () => void }) {
  return <div className="inspector-scroll"><div className="inspector-section"><div className="inspector-section-title">Transformação</div><div className="field-grid"><Field label="X" value={clip.x} suffix="%" min={-300} max={300} onChange={(v) => update({ x: v })} /><Field label="Y" value={clip.y} suffix="%" min={-300} max={300} onChange={(v) => update({ y: v })} /><Field label="Largura" value={clip.width} suffix="%" min={0} max={200} onChange={(v) => update({ width: v })} /><Field label="Altura" value={clip.height} suffix="%" min={0} max={200} onChange={(v) => update({ height: v })} /><Field label="Rotação" value={clip.rotation} suffix="°" min={-360} max={360} onChange={(v) => update({ rotation: v })} /></div></div><div className="inspector-section"><div className="inspector-section-title">Opacidade</div><div className="slider-row"><input type="range" min="0" max="1" step="0.01" value={clip.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} /><span>{Math.round(clip.opacity * 100)}%</span></div></div><div className="inspector-section"><div className="inspector-section-title">Áudio</div><div className="slider-row"><Volume2 size={15} /><input type="range" min="0" max="1" step="0.01" value={clip.volume} onChange={(e) => update({ volume: Number(e.target.value) })} /><span>{Math.round(clip.volume * 100)}%</span></div></div><div className="inspector-actions"><button onClick={() => update({ flipX: !clip.flipX })}>Espelhar</button><button onClick={() => update({ x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, flipX: false })}>Resetar</button></div><div className="inspector-actions"><button onClick={onDuplicate}><Copy size={14} /> Duplicar</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> Excluir</button></div></div>
}
function Field({ label, value, suffix, min, max, onChange }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void }) { return <label className="field-label"><span>{label}</span><div className="field-box"><input type="number" min={min} max={max} step="0.1" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} /><em>{suffix}</em></div></label> }

function Timeline({ clips, playhead, selectedId, onSelect, onMove }: { clips: Clip[]; playhead: number; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string, start: number, trackIndex: number) => void }) {
  const [drag, setDrag] = useState<{ id: string; offset: number; originalStart: number; originalTrack: number } | null>(null)
  const total = Math.max(30, ...clips.map((c) => c.start + c.duration))
  const ticks = useMemo(() => Array.from({ length: Math.ceil(total / 5) + 1 }, (_, i) => i * 5), [total])
  const timelineRef = useRef<HTMLDivElement>(null)
  const leftLabel = 132
  return <div className="timeline" ref={timelineRef}><div className="timeline-ruler"><div className="track-label-spacer" />{ticks.map((t) => <span key={t} style={{ left: leftLabel + t * PX_PER_SECOND }}>{formatTime(t)}</span>)}</div>{TRACKS.map((track) => <div className="timeline-track" key={track}><div className={`track-label ${TRACK_COLORS[track]}`}><i />{TRACK_NAMES[track]}</div><div className="track-content"><div className="grid-lines" />{clips.filter((c) => c.trackIndex === track).map((clip) => <button key={clip.id} className={`timeline-clip ${clip.id === selectedId ? 'selected' : ''} ${clip.track}`} style={{ left: clip.start * PX_PER_SECOND, width: Math.max(54, clip.duration * PX_PER_SECOND) }} onPointerDown={(e) => { onSelect(clip.id); setDrag({ id: clip.id, offset: e.clientX, originalStart: clip.start, originalTrack: track }); e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={(e) => { if (!drag || drag.id !== clip.id) return; const delta = (e.clientX - drag.offset) / PX_PER_SECOND; const laneY = (e.clientY - 30) / 56; const nextTrack = Math.max(0, Math.min(2, drag.originalTrack + Math.round(laneY))); onMove(clip.id, Number(Math.max(0, drag.originalStart + delta).toFixed(2)), clip.track === 'audio' ? 3 : nextTrack) }} onPointerUp={() => setDrag(null)}><span>{clip.name}</span><small>{formatTime(clip.duration)}</small></button>)}</div></div>)}<div className="playhead" style={{ left: leftLabel + playhead * PX_PER_SECOND }}><span /></div></div>
}
function activeVideo(time: number, clips: Clip[]) { return clips.filter((c) => c.track === 'video' && time >= c.start && time < c.start + c.duration).sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start) }
function formatTime(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
