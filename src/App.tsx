import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, ChevronDown, Film, FolderOpen, Image as ImageIcon, Layers3,
  Maximize2, Music2, Pause, Play, Plus, Redo2, Scissors, Settings2,
  SlidersHorizontal, Sparkles, Trash2, Type, Undo2, Upload, Video,
  Volume2, X, ZoomIn, ZoomOut, FilePlus2, CheckCircle2,
} from 'lucide-react'
import { useEditorStore } from './editor/store'
import type { Clip, MediaAsset } from './editor/types'

type Tab = 'media' | 'text' | 'audio' | 'layers' | 'effects'
const PX_PER_SECOND = 86
const TRACKS = [0, 1, 2, 3]
const TRACK_NAMES = ['Vídeo 1', 'Vídeo 2', 'Vídeo 3', 'Áudio']
const TRACK_COLORS = ['#7c5cff', '#4f8cff', '#32c48d', '#f1a64a']

export default function App() {
  const store = useEditorStore()
  const { project, selectedClipId } = store
  const [tab, setTab] = useState<Tab>('media')
  const [zoom, setZoom] = useState(100)
  const [showWelcome, setShowWelcome] = useState(false)
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
  }, [project.isPlaying, total])

  async function importFiles(files: FileList | File[]) {
    const list = Array.from(files)
    for (const file of list) {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null
      if (!kind) continue
      const asset = await store.importMedia(file, kind)
      store.addClip(asset.id)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    void importFiles(e.dataTransfer.files)
  }

  const ruler = useMemo(() => {
    const count = Math.ceil(total / 5) + 1
    return Array.from({ length: count }, (_, index) => index * 5)
  }, [total])

  return (
    <div className="studio" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo"><Film size={20} /></div>
          <div>
            <div className="brand-name">Meu Video Studio</div>
            <div className="brand-caption">Editor de vídeo para Windows</div>
          </div>
        </div>

        <div className="project-control">
          <button className="project-select"><span className="project-status" />{project.name}<ChevronDown size={14} /></button>
        </div>

        <div className="top-actions">
          <button className="toolbar-icon" onClick={store.undo} disabled={!store.canUndo} title="Desfazer"><Undo2 size={17} /></button>
          <button className="toolbar-icon" onClick={store.redo} disabled={!store.canRedo} title="Refazer"><Redo2 size={17} /></button>
          <span className="top-divider" />
          <button className="toolbar-secondary" onClick={() => setShowWelcome(true)}><FilePlus2 size={16} /> Novo</button>
          <button className="toolbar-secondary"><FolderOpen size={16} /> Abrir</button>
          <button className="toolbar-primary"><Upload size={16} /> Exportar</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav className="side-nav">
            <NavButton active={tab === 'media'} icon={<ImageIcon />} label="Mídia" onClick={() => setTab('media')} />
            <NavButton active={tab === 'text'} icon={<Type />} label="Texto" onClick={() => setTab('text')} />
            <NavButton active={tab === 'audio'} icon={<Music2 />} label="Áudio" onClick={() => setTab('audio')} />
            <NavButton active={tab === 'layers'} icon={<Layers3 />} label="Camadas" onClick={() => setTab('layers')} />
            <NavButton active={tab === 'effects'} icon={<Sparkles />} label="Efeitos" onClick={() => setTab('effects')} />
          </nav>
          <button className="settings-nav" onClick={() => setTab('effects')}><Settings2 size={17} /><span>Config.</span></button>
        </aside>

        <aside className="library">
          <div className="library-head">
            <div>
              <h2>{tabTitle(tab)}</h2>
              <span>{tab === 'media' ? `${project.media.length} arquivo${project.media.length === 1 ? '' : 's'}` : 'Ferramentas'}</span>
            </div>
            {tab === 'media' && <button className="round-add" title="Importar mídia" onClick={() => inputRef.current?.click()}><Plus size={17} /></button>}
          </div>

          {tab === 'media' && (
            <div className="library-body">
              <button className="import-panel" onClick={() => inputRef.current?.click()}>
                <div className="import-panel-icon"><Upload size={21} /></div>
                <div className="import-panel-copy"><strong>Importar mídia</strong><span>Vídeo, imagem ou áudio</span></div>
                <kbd>Ctrl + I</kbd>
              </button>
              <input ref={inputRef} type="file" hidden multiple accept="video/*,image/*,audio/*" onChange={(e) => { if (e.target.files) void importFiles(e.target.files) }} />

              <div className="library-section-title">Biblioteca de mídia</div>
              {project.media.length ? (
                <div className="media-grid">
                  {project.media.map((media) => <MediaItem key={media.id} media={media} onAdd={() => store.addClip(media.id)} />)}
                </div>
              ) : (
                <div className="empty-media">
                  <div className="empty-media-icon"><ImageIcon size={22} /></div>
                  <strong>Nenhuma mídia ainda</strong>
                  <span>Importe seus arquivos para começar a editar.</span>
                </div>
              )}
            </div>
          )}

          {tab === 'layers' && (
            <div className="library-body layer-library">
              <div className="hint-card"><Layers3 size={18} /><span>A ordem das faixas define a profundidade da composição.</span></div>
              {[...project.clips].sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start).map((clip) => {
                const media = project.media.find((m) => m.id === clip.assetId)
                return <button key={clip.id} className={`layer-item ${clip.id === selectedClipId ? 'selected' : ''}`} onClick={() => store.selectClip(clip.id)}>
                  <span className="layer-color" style={{ background: TRACK_COLORS[clip.trackIndex] ?? '#7c5cff' }} />
                  <span className="layer-kind">{media?.kind === 'audio' ? <Music2 size={14} /> : media?.kind === 'image' ? <ImageIcon size={14} /> : <Film size={14} />}</span>
                  <span className="layer-copy"><strong>{clip.name}</strong><small>{TRACK_NAMES[clip.trackIndex] ?? 'Camada'}</small></span>
                </button>
              })}
            </div>
          )}

          {tab !== 'media' && tab !== 'layers' && (
            <div className="module-placeholder">
              <div className="module-icon">{tab === 'text' ? <Type /> : tab === 'audio' ? <AudioLines /> : <Sparkles />}</div>
              <h3>{tabTitle(tab)}</h3>
              <p>O espaço está preparado para este módulo. A base do editor está pronta para receber as ferramentas.</p>
            </div>
          )}
        </aside>

        <main className="editor">
          <div className="editor-toolbar">
            <div className="toolbar-cluster">
              <button className="editor-tool active"><SlidersHorizontal size={16} /></button>
              <button className="editor-tool"><Scissors size={16} /></button>
            </div>
            <div className="toolbar-center-label">PREVIEW</div>
            <div className="toolbar-cluster">
              <button className="editor-tool" onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut size={16} /></button>
              <span className="zoom-text">{zoom}%</span>
              <button className="editor-tool" onClick={() => setZoom(Math.min(150, zoom + 10))}><ZoomIn size={16} /></button>
              <button className="editor-tool"><Maximize2 size={16} /></button>
            </div>
          </div>

          <section className="preview-zone">
            <div className="preview-shadow">
              <div className="preview-stage" style={{ transform: `scale(${zoom / 100})` }}>
                <div className="preview-grid" />
                <div className="safe-lines" />
                {activeClips(project.playhead, project.clips).map((clip) => {
                  const media = project.media.find((m) => m.id === clip.assetId)
                  return <PreviewLayer key={clip.id} clip={clip} media={media} selected={clip.id === selectedClipId} playing={project.isPlaying} playhead={project.playhead} onSelect={() => store.selectClip(clip.id)} />
                })}
                {!activeClips(project.playhead, project.clips).length && (
                  <div className="preview-empty">
                    <div className="preview-empty-mark"><Video size={24} /></div>
                    <h3>Seu vídeo aparecerá aqui</h3>
                    <p>Importe uma mídia e coloque-a na timeline para começar.</p>
                    <button onClick={() => inputRef.current?.click()}><Plus size={16} /> Importar mídia</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="player-bar">
            <div className="player-controls">
              <button className="player-small" onClick={() => store.setPlayhead(Math.max(0, project.playhead - 1))}>−1s</button>
              <button className="player-play" onClick={() => store.setPlaying(!project.isPlaying)}>{project.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
              <span className="time-current">{formatTime(project.playhead)}</span>
              <span className="time-slash">/</span>
              <span className="time-total">{formatTime(total)}</span>
            </div>
            <input className="player-scrub" type="range" min="0" max={total} step="0.01" value={project.playhead} onChange={(e) => store.setPlayhead(Number(e.target.value))} />
            <div className="player-volume"><Volume2 size={16} /><div className="volume-track"><span /></div></div>
          </div>

          <section className="timeline-panel">
            <div className="timeline-head">
              <div><Layers3 size={15} /><strong>Timeline</strong></div>
              <div className="timeline-tools"><span>Zoom</span><button onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut size={14} /></button><button onClick={() => setZoom(Math.min(150, zoom + 10))}><ZoomIn size={14} /></button></div>
            </div>
            <div className="timeline-scroll">
              <div className="ruler" style={{ minWidth: 150 + total * PX_PER_SECOND }}>
                <div className="ruler-label">Tempo</div>
                <div className="ruler-track">
                  {ruler.map((sec) => <span key={sec} style={{ left: sec * PX_PER_SECOND }}>{formatTime(sec)}</span>)}
                </div>
              </div>
              {TRACKS.map((track) => (
                <TimelineTrack key={track} track={track} clips={project.clips.filter((clip) => clip.trackIndex === track)} selectedId={selectedClipId} onSelect={store.selectClip} onMove={(id, start, trackIndex) => store.updateClip(id, { start, trackIndex })} />
              ))}
              <div className="playhead-line" style={{ left: 150 + project.playhead * PX_PER_SECOND }} />
            </div>
          </section>
        </main>

        <aside className="inspector">
          <div className="inspector-head">
            <div><h2>Propriedades</h2><span>{selectedMedia?.name ?? 'Nenhum elemento selecionado'}</span></div>
            <SlidersHorizontal size={17} />
          </div>
          {selected ? <Inspector clip={selected} update={(patch) => store.updateClip(selected.id, patch)} onDelete={() => store.deleteClip(selected.id)} onDuplicate={() => store.duplicateClip(selected.id)} /> : <InspectorEmpty onImport={() => inputRef.current?.click()} />}
        </aside>
      </div>

      {showWelcome && <div className="modal-backdrop" onClick={() => setShowWelcome(false)}>
        <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowWelcome(false)}><X size={18} /></button>
          <div className="modal-mark"><FilePlus2 size={22} /></div>
          <h2>Novo projeto</h2>
          <p>Seu projeto atual está salvo localmente no navegador do aplicativo.</p>
          <button className="modal-primary" onClick={() => { localStorage.removeItem('meu-video-studio-ai:desktop-project:v1'); location.reload() }}>Começar projeto limpo</button>
        </div>
      </div>}
    </div>
  )
}

function NavButton({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>
}

function MediaItem({ media, onAdd }: { media: MediaAsset; onAdd: () => void }) {
  return <button className="media-item" onDoubleClick={onAdd} title="Duplo clique para adicionar à timeline">
    <div className={`media-thumb ${media.kind}`}>
      {media.kind === 'image' ? <img src={media.url} alt="" /> : media.kind === 'video' ? <Video size={18} /> : <Music2 size={18} />}
    </div>
    <div className="media-info"><strong>{media.name}</strong><span>{media.kind === 'video' || media.kind === 'audio' ? formatTime(media.duration) : 'Imagem'}</span></div>
    <div className="media-add"><Plus size={15} /></div>
  </button>
}

function PreviewLayer({ clip, media, selected, playing, playhead, onSelect }: { clip: Clip; media?: MediaAsset; selected: boolean; playing: boolean; playhead: number; onSelect: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video || media?.kind !== 'video') return
    const localTime = Math.max(0, playhead - clip.start)
    if (Math.abs(video.currentTime - localTime) > 0.12) {
      try { video.currentTime = localTime } catch { /* ignore */ }
    }
    if (playing) video.play().catch(() => undefined)
    else video.pause()
  }, [playing, playhead, clip.start, media?.kind])
  return <div className={`preview-layer ${selected ? 'selected' : ''}`} onPointerDown={(e) => { e.stopPropagation(); onSelect() }} style={{ left: `${clip.x}%`, top: `${clip.y}%`, width: `${clip.width}%`, height: `${clip.height}%`, opacity: clip.opacity, transform: `rotate(${clip.rotation}deg) scaleX(${clip.flipX ? -1 : 1})` }}>
    {media?.kind === 'image' && <img src={media.url} alt="" draggable={false} />}
    {media?.kind === 'video' && <video ref={videoRef} src={media.url} muted playsInline preload="metadata" />}
    {selected && <><div className="handle nw" /><div className="handle ne" /><div className="handle sw" /><div className="handle se" /></>}
  </div>
}

function Inspector({ clip, update, onDelete, onDuplicate }: { clip: Clip; update: (patch: Partial<Clip>) => void; onDelete: () => void; onDuplicate: () => void }) {
  return <div className="inspector-scroll">
    <section className="inspector-section"><div className="inspector-label">Transformação</div><div className="field-grid"><Field label="X" value={clip.x} suffix="%" min={-300} max={300} onChange={(v) => update({ x: v })} /><Field label="Y" value={clip.y} suffix="%" min={-300} max={300} onChange={(v) => update({ y: v })} /><Field label="Largura" value={clip.width} suffix="%" min={0} max={200} onChange={(v) => update({ width: v })} /><Field label="Altura" value={clip.height} suffix="%" min={0} max={200} onChange={(v) => update({ height: v })} /><Field label="Rotação" value={clip.rotation} suffix="°" min={-360} max={360} onChange={(v) => update({ rotation: v })} /></div></section>
    <section className="inspector-section"><div className="inspector-label">Opacidade <b>{Math.round(clip.opacity * 100)}%</b></div><input className="range" type="range" min="0" max="1" step="0.01" value={clip.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} /></section>
    <section className="inspector-section"><div className="inspector-label">Áudio <b>{Math.round(clip.volume * 100)}%</b></div><div className="audio-control"><Volume2 size={15} /><input className="range" type="range" min="0" max="1" step="0.01" value={clip.volume} onChange={(e) => update({ volume: Number(e.target.value) })} /></div></section>
    <div className="inspector-actions"><button onClick={() => update({ flipX: !clip.flipX })}>Espelhar</button><button onClick={() => update({ x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, flipX: false })}>Resetar</button></div>
    <div className="inspector-actions"><button onClick={onDuplicate}><Plus size={14} /> Duplicar</button><button className="danger" onClick={onDelete}><Trash2 size={14} /> Excluir</button></div>
  </div>
}

function Field({ label, value, suffix, min, max, onChange }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{label}</span><div><input type="number" min={min} max={max} step="0.1" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} /><em>{suffix}</em></div></label>
}

function InspectorEmpty({ onImport }: { onImport: () => void }) {
  return <div className="inspector-empty"><div className="inspector-empty-icon"><SlidersHorizontal size={21} /></div><h3>Nada selecionado</h3><p>Selecione uma mídia na timeline ou no preview para editar suas propriedades.</p><button onClick={onImport}><Plus size={15} /> Importar mídia</button><div className="selection-tip"><CheckCircle2 size={14} /> Atalhos e propriedades aparecem aqui.</div></div>
}

function TimelineTrack({ track, clips, selectedId, onSelect, onMove }: { track: number; clips: Clip[]; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string, start: number, trackIndex: number) => void }) {
  const drag = useRef<{ id: string; offset: number } | null>(null)
  return <div className="timeline-row">
    <div className="track-name"><span style={{ background: TRACK_COLORS[track] }} />{TRACK_NAMES[track]}</div>
    <div className="track-lane">
      {clips.map((clip) => <button key={clip.id} className={`timeline-clip ${clip.id === selectedId ? 'selected' : ''}`} style={{ left: clip.start * PX_PER_SECOND, width: Math.max(62, clip.duration * PX_PER_SECOND), borderColor: TRACK_COLORS[track] }} onPointerDown={(e) => { onSelect(clip.id); drag.current = { id: clip.id, offset: e.clientX - clip.start * PX_PER_SECOND }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={(e) => { if (!drag.current || drag.current.id !== clip.id) return; const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); const start = Math.max(0, (e.clientX - rect.left + rect.left - drag.current.offset) / PX_PER_SECOND); onMove(clip.id, Number(Math.max(0, start).toFixed(2)), track) }} onPointerUp={() => { drag.current = null }}>{clip.name}</button>)}
    </div>
  </div>
}

function activeClips(time: number, clips: Clip[]) {
  return clips.filter((clip) => clip.trackIndex < 3 && time >= clip.start && time < clip.start + clip.duration).sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start)
}

function tabTitle(tab: Tab) {
  return tab === 'media' ? 'Biblioteca' : tab === 'text' ? 'Texto' : tab === 'audio' ? 'Áudio' : tab === 'layers' ? 'Camadas' : 'Efeitos'
}

function formatTime(value: number) {
  const total = Math.max(0, Math.floor(value))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
