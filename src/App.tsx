import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, ChevronDown, Copy, Download, Film, FolderOpen, Gauge, Grid2X2,
  Image as ImageIcon, Layers3, Maximize2, Music2, Pause, Play, Plus, Redo2,
  RotateCcw, Scissors, Settings2, SlidersHorizontal, Sparkles, Trash2, Type,
  Undo2, Upload, Video, Volume2, ZoomIn, ZoomOut
} from 'lucide-react'
import { useEditorStore } from './editor/store'
import type { Clip, MediaAsset } from './editor/types'

const PX = 92
const TRACKS = [0, 1, 2, 3]
const TRACK_NAMES = ['Vídeo 1', 'Vídeo 2', 'Vídeo 3', 'Áudio']

type ToolTab = 'media' | 'text' | 'audio' | 'layers' | 'effects'

export default function App() {
  const store = useEditorStore()
  const { project, selectedClipId } = store
  const [tab, setTab] = useState<ToolTab>('media')
  const [zoom, setZoom] = useState(100)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = project.clips.find((clip) => clip.id === selectedClipId) ?? null
  const selectedMedia = selected ? project.media.find((media) => media.id === selected.assetId) : null
  const total = Math.max(30, ...project.clips.map((clip) => clip.start + clip.duration))

  useEffect(() => {
    if (!project.isPlaying) return
    let raf = 0
    const startedAt = performance.now()
    const from = project.playhead
    const tick = (now: number) => {
      const next = from + (now - startedAt) / 1000
      if (next >= total) {
        store.setPlayhead(total)
        store.setPlaying(false)
        return
      }
      store.setPlayhead(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [project.isPlaying, total, store])

  async function importFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null
      if (!kind) continue
      const asset = await store.importMedia(file, kind)
      store.addClip(asset.id)
    }
  }

  function drop(e: React.DragEvent) {
    e.preventDefault()
    void importFiles(e.dataTransfer.files)
  }

  return (
    <div className="studio-shell" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
      <header className="studio-topbar">
        <div className="brand-block">
          <div className="brand-icon"><Film size={18} /></div>
          <div>
            <div className="brand-title">Meu Video Studio</div>
            <div className="brand-subtitle">Editor desktop</div>
          </div>
        </div>

        <div className="project-chip">
          <span className="status-dot" />
          <span>{project.name}</span>
          <ChevronDown size={14} />
        </div>

        <div className="topbar-actions">
          <button className="icon-btn" title="Desfazer" onClick={store.undo} disabled={!store.canUndo}><Undo2 size={17} /></button>
          <button className="icon-btn" title="Refazer" onClick={store.redo} disabled={!store.canRedo}><Redo2 size={17} /></button>
          <button className="top-btn"><FolderOpen size={15} /> Abrir</button>
          <button className="export-btn"><Download size={15} /> Exportar</button>
        </div>
      </header>

      <div className="studio-body">
        <nav className="tool-rail">
          <ToolButton active={tab === 'media'} icon={<ImageIcon />} label="Mídia" onClick={() => setTab('media')} />
          <ToolButton active={tab === 'text'} icon={<Type />} label="Texto" onClick={() => setTab('text')} />
          <ToolButton active={tab === 'audio'} icon={<Music2 />} label="Áudio" onClick={() => setTab('audio')} />
          <ToolButton active={tab === 'layers'} icon={<Layers3 />} label="Camadas" onClick={() => setTab('layers')} />
          <ToolButton active={tab === 'effects'} icon={<Sparkles />} label="Efeitos" onClick={() => setTab('effects')} />
          <div className="rail-spacer" />
          <ToolButton icon={<Settings2 />} label="Config." onClick={() => setTab('effects')} />
        </nav>

        <aside className="library-panel">
          <div className="panel-header">
            <div>
              <strong>{tab === 'media' ? 'Biblioteca' : tab === 'text' ? 'Texto' : tab === 'audio' ? 'Áudio' : tab === 'layers' ? 'Camadas' : 'Efeitos'}</strong>
              <span>{tab === 'media' ? `${project.media.length} arquivos` : 'Ferramentas do editor'}</span>
            </div>
            {tab === 'media' && <button className="small-icon" onClick={() => inputRef.current?.click()}><Plus size={16} /></button>}
          </div>

          {tab === 'media' ? (
            <div className="library-content">
              <button className="import-card" onClick={() => inputRef.current?.click()}>
                <div className="import-icon"><Upload size={20} /></div>
                <div><strong>Importar mídia</strong><span>Vídeo, imagem e áudio</span></div>
                <div className="import-key">Ctrl+I</div>
              </button>
              <input ref={inputRef} hidden type="file" multiple accept="video/*,image/*,audio/*" onChange={(e) => e.target.files && void importFiles(e.target.files)} />
              <div className="section-caption">Seus arquivos</div>
              <div className="asset-grid">
                {project.media.map((media) => <MediaCard key={media.id} media={media} onAdd={() => store.addClip(media.id)} />)}
                {!project.media.length && <div className="empty-library"><Sparkles size={18} /><span>Arraste arquivos para o editor<br />ou use Importar mídia.</span></div>}
              </div>
            </div>
          ) : tab === 'layers' ? (
            <div className="layer-list">
              {[...project.clips].sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start).map((clip) => {
                const media = project.media.find((m) => m.id === clip.assetId)
                return <button key={clip.id} className={`layer-row ${clip.id === selectedClipId ? 'selected' : ''}`} onClick={() => store.selectClip(clip.id)}>
                  <span className="layer-badge"><LayerIcon kind={media?.kind} /></span>
                  <span className="layer-info"><strong>{clip.name}</strong><small>{TRACK_NAMES[clip.trackIndex] ?? 'Camada'}</small></span>
                </button>
              })}
            </div>
          ) : (
            <div className="tool-placeholder">
              <div className="placeholder-icon">{tab === 'text' ? <Type /> : tab === 'audio' ? <AudioLines /> : <Sparkles />}</div>
              <strong>{tab === 'text' ? 'Texto sobre o vídeo' : tab === 'audio' ? 'Áudio e música' : 'Efeitos visuais'}</strong>
              <span>Esta área está preparada para os próximos módulos do editor.</span>
            </div>
          )}
        </aside>

        <main className="editor-center">
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button className="canvas-tool active"><Scissors size={16} /></button>
              <button className="canvas-tool"><Grid2X2 size={16} /></button>
            </div>
            <div className="canvas-toolbar-spacer" />
            <button className="canvas-tool" onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut size={16} /></button>
            <span className="zoom-value">{zoom}%</span>
            <button className="canvas-tool" onClick={() => setZoom(Math.min(200, zoom + 10))}><ZoomIn size={16} /></button>
            <button className="canvas-tool"><Maximize2 size={15} /></button>
          </div>

          <div className="preview-workspace">
            <div className="preview-stage-wrap">
              <div className="preview-stage" style={{ transform: `scale(${zoom / 100})` }}>
                <div className="preview-grid" />
                <div className="safe-frame" />
                {activeVideo(project.playhead, project.clips).map((clip) => {
                  const media = project.media.find((m) => m.id === clip.assetId)
                  return <PreviewLayer key={clip.id} clip={clip} media={media} selected={clip.id === selectedClipId} onSelect={() => store.selectClip(clip.id)} />
                })}
                {!activeVideo(project.playhead, project.clips).length && (
                  <div className="preview-empty-state">
                    <div className="empty-film"><Video size={22} /></div>
                    <strong>Seu vídeo aparece aqui</strong>
                    <span>Importe uma mídia e adicione-a à timeline.</span>
                    <button onClick={() => inputRef.current?.click()}><Plus size={15} /> Importar mídia</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="transport-bar">
            <div className="transport-left">
              <button className="transport-icon" onClick={() => store.setPlayhead(Math.max(0, project.playhead - 1))}><RotateCcw size={16} /></button>
              <button className="play-button" onClick={() => store.setPlaying(!project.isPlaying)}>{project.isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
              <span className="timecode">{formatTime(project.playhead)}</span>
              <span className="time-separator">/</span>
              <span className="time-total">{formatTime(total)}</span>
            </div>
            <input className="transport-range" type="range" min="0" max={total} step="0.01" value={project.playhead} onChange={(e) => store.setPlayhead(Number(e.target.value))} />
            <div className="transport-right"><Volume2 size={16} /><div className="volume-line" /></div>
          </div>

          <Timeline clips={project.clips} playhead={project.playhead} selectedId={selectedClipId} onSelect={store.selectClip} onMove={(id, start, trackIndex) => store.updateClip(id, { start, trackIndex })} />
        </main>

        <aside className="inspector-panel">
          <div className="panel-header inspector-title"><div><strong>Propriedades</strong><span>{selectedMedia?.name ?? 'Nenhuma seleção'}</span></div><SlidersHorizontal size={17} /></div>
          {selected ? <Inspector clip={selected} update={(patch) => store.updateClip(selected.id, patch)} onDelete={() => store.deleteClip(selected.id)} onDuplicate={() => store.duplicateClip(selected.id)} /> : <div className="inspector-empty"><div className="inspector-empty-icon"><SlidersHorizontal size={19} /></div><strong>Selecione um elemento</strong><span>Clique em uma mídia na timeline ou no preview para editar suas propriedades.</span></div>}
        </aside>
      </div>
    </div>
  )
}

function ToolButton({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`rail-tool ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>
}

function MediaCard({ media, onAdd }: { media: MediaAsset; onAdd: () => void }) {
  return <button className="asset-card" onDoubleClick={onAdd} title="Duplo clique para adicionar à timeline">
    <div className={`asset-thumb ${media.kind}`}>{media.kind === 'video' ? <Film size={18} /> : media.kind === 'audio' ? <Music2 size={18} /> : <ImageIcon size={18} />}</div>
    <div className="asset-copy"><strong>{media.name}</strong><span>{media.kind === 'video' ? `${formatTime(media.duration)}` : media.kind.toUpperCase()}</span></div>
  </button>
}

function LayerIcon({ kind }: { kind?: MediaAsset['kind'] }) {
  return kind === 'image' ? <ImageIcon size={14} /> : kind === 'audio' ? <Music2 size={14} /> : <Film size={14} />
}

function PreviewLayer({ clip, media, selected, onSelect }: { clip: Clip; media?: MediaAsset; selected: boolean; onSelect: () => void }) {
  return <div className={`preview-layer ${selected ? 'selected' : ''}`} onPointerDown={(e) => { e.stopPropagation(); onSelect() }} style={{ left: `${clip.x}%`, top: `${clip.y}%`, width: `${clip.width}%`, height: `${clip.height}%`, opacity: clip.opacity, transform: `rotate(${clip.rotation}deg) scaleX(${clip.flipX ? -1 : 1})` }}>
    {media?.kind === 'image' && <img src={media.url} draggable={false} alt="" />}
    {media?.kind === 'video' && <video src={media.url} muted playsInline />}
    {selected && <><div className="handle nw" /><div className="handle ne" /><div className="handle sw" /><div className="handle se" /></>}
  </div>
}

function Inspector({ clip, update, onDelete, onDuplicate }: { clip: Clip; update: (patch: Partial<Clip>) => void; onDelete: () => void; onDuplicate: () => void }) {
  return <div className="inspector-scroll">
    <div className="inspector-section"><div className="inspector-section-title">Transformação</div><div className="field-grid"><Field label="X" value={clip.x} suffix="%" min={-300} max={300} onChange={(v) => update({ x: v })} /><Field label="Y" value={clip.y} suffix="%" min={-300} max={300} onChange={(v) => update({ y: v })} /><Field label="Largura" value={clip.width} suffix="%" min={0} max={200} onChange={(v) => update({ width: v })} /><Field label="Altura" value={clip.height} suffix="%" min={0} max={200} onChange={(v) => update({ height: v })} /><Field label="Rotação" value={clip.rotation} suffix="°" min={-360} max={360} onChange={(v) => update({ rotation: v })} /></div></div>
    <div className="inspector-section"><div className="inspector-section-title">Opacidade</div><div className="slider-row"><input type="range" min="0" max="1" step="0.01" value={clip.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} /><span>{Math.round(clip.opacity * 100)}%</span></div></div>
    <div className="inspector-section"><div className="inspector-section-title">Áudio</div><div className="slider-row"><Volume2 size={15} /><input type="range" min="0" max="1" step="0.01" value={clip.volume} onChange={(e) => update({ volume: Number(e.target.value) })} /><span>{Math.round(clip.volume * 100)}%</span></div></div>
    <div className="inspector-actions"><button onClick={() => update({ flipX: !clip.flipX })}><Gauge size={14} /> Espelhar</button><button onClick={() => update({ x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, flipX: false })}>Resetar</button></div>
    <div className="inspector-actions"><button onClick={onDuplicate}><Copy size={14} /> Duplicar</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> Excluir</button></div>
  </div>
}

function Field({ label, value, suffix, min, max, onChange }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="number-field"><span>{label}</span><div><input type="number" min={min} max={max} step="0.1" value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} /><em>{suffix}</em></div></label>
}

function Timeline({ clips, playhead, selectedId, onSelect, onMove }: { clips: Clip[]; playhead: number; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string, start: number, trackIndex: number) => void }) {
  const [drag, setDrag] = useState<{ id: string; x: number; track: number } | null>(null)
  const total = Math.max(30, ...clips.map((c) => c.start + c.duration))
  const ticks = Array.from({ length: Math.ceil(total / 5) + 1 }, (_, i) => i * 5)
  return <section className="timeline-shell">
    <div className="timeline-head"><div className="timeline-title"><Layers3 size={14} /> Timeline</div><div className="timeline-tools"><button><ZoomOut size={13} /></button><button><ZoomIn size={13} /></button></div></div>
    <div className="timeline-scroll">
      <div className="ruler"><div className="track-head-spacer" />{ticks.map((tick) => <span key={tick} style={{ left: 146 + tick * PX }}>{formatTime(tick)}</span>)}</div>
      {TRACKS.map((track) => <div className="timeline-track" key={track}><div className="track-head"><div className="track-dot" />{TRACK_NAMES[track]}</div><div className="track-lane">{clips.filter((c) => c.trackIndex === track).map((clip) => <button key={clip.id} className={`clip-pill ${clip.id === selectedId ? 'selected' : ''}`} style={{ left: clip.start * PX, width: Math.max(56, clip.duration * PX) }} onPointerDown={(e) => { onSelect(clip.id); setDrag({ id: clip.id, x: e.clientX, track }) ; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={(e) => { if (!drag || drag.id !== clip.id) return; const start = Math.max(0, clip.start + (e.clientX - drag.x) / PX); const nextTrack = Math.max(0, Math.min(3, track + Math.round((e.clientY - (e.currentTarget.parentElement?.getBoundingClientRect().top ?? 0) - 25) / 58))); onMove(clip.id, Number(start.toFixed(2)), nextTrack) }} onPointerUp={() => setDrag(null)}>{clip.name}</button>)}</div></div>)}
      <div className="playhead" style={{ left: 146 + playhead * PX }}><span /></div>
    </div>
  </section>
}

function activeVideo(time: number, clips: Clip[]) {
  return clips.filter((c) => c.track === 'video' && time >= c.start && time < c.start + c.duration).sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start)
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
