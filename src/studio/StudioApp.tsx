import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AudioLines, Captions, ChevronDown, CircleHelp, Copy, Download, Film, FolderOpen,
  Grid2X2, Image as ImageIcon, Layers3, Lock, Magnet, Maximize2, Menu, Mic2, MoreHorizontal,
  Pause, Play, Plus, Redo2, RotateCcw, Scissors, Search, Settings2, Sparkles, Split, TextCursorInput,
  Trash2, Undo2, Upload, Volume2, VolumeX, WandSparkles, X, ZoomIn, ZoomOut
} from 'lucide-react'
import type { Clip, MediaAsset, MediaKind } from '../editor/types'
import { useEditorStore } from '../editor/store'
import './studio.css'

type ToolId = 'media' | 'templates' | 'elements' | 'audio' | 'text' | 'captions' | 'transcript' | 'effects' | 'transitions' | 'filters' | 'brand' | 'plugins'
type TrackId = 'video' | 'overlay' | 'text' | 'audio'

const tools: Array<{ id: ToolId; label: string; icon: typeof Film; helper: string }> = [
  { id: 'media', label: 'Mídia', icon: Film, helper: 'Importe vídeos, imagens e áudios do computador.' },
  { id: 'templates', label: 'Modelos', icon: Grid2X2, helper: 'Modelos locais para acelerar seus projetos.' },
  { id: 'elements', label: 'Elementos', icon: Layers3, helper: 'Formas, adesivos e elementos gráficos.' },
  { id: 'audio', label: 'Áudio', icon: AudioLines, helper: 'Trilhas, narração e controles de áudio.' },
  { id: 'text', label: 'Texto', icon: TextCursorInput, helper: 'Títulos, textos e estilos tipográficos.' },
  { id: 'captions', label: 'Legendas', icon: Captions, helper: 'Crie e ajuste legendas do projeto.' },
  { id: 'transcript', label: 'Transcrição', icon: Mic2, helper: 'Área preparada para transcrição de fala.' },
  { id: 'effects', label: 'Efeitos', icon: WandSparkles, helper: 'Efeitos visuais e animações locais.' },
  { id: 'transitions', label: 'Transições', icon: Sparkles, helper: 'Transições entre trechos da timeline.' },
  { id: 'filters', label: 'Filtros', icon: RotateCcw, helper: 'Ajustes visuais rápidos.' },
  { id: 'brand', label: 'Kit de marca', icon: AlignCenter, helper: 'Cores, tipografia e identidade do projeto.' },
  { id: 'plugins', label: 'Plugins', icon: Settings2, helper: 'Extensões e integrações futuras.' },
]

const trackMap: Array<{ id: TrackId; label: string; kind: 'video' | 'audio'; index: number }> = [
  { id: 'video', label: 'Vídeo 1', kind: 'video', index: 0 },
  { id: 'overlay', label: 'Vídeo 2', kind: 'video', index: 1 },
  { id: 'text', label: 'Texto', kind: 'video', index: 2 },
  { id: 'audio', label: 'Áudio', kind: 'audio', index: 3 },
]

const formatTime = (value: number) => {
  const total = Math.max(0, value)
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60).toString().padStart(2, '0')
  const ms = Math.floor((total % 1) * 100).toString().padStart(2, '0')
  return `${m.toString().padStart(2, '0')}:${s}.${ms}`
}

const kindFromFile = (file: File): MediaKind => file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : 'video'

function AppIconButton({ label, onClick, active, children, disabled }: { label: string; onClick?: () => void; active?: boolean; children: React.ReactNode; disabled?: boolean }) {
  return <button className={`icon-button ${active ? 'active' : ''}`} title={label} onClick={onClick} disabled={disabled}>{children}</button>
}

function MediaThumb({ asset }: { asset: MediaAsset }) {
  if (asset.kind === 'audio') return <div className="media-thumb audio-thumb"><AudioLines size={26} /></div>
  return <div className="media-thumb"><img src={asset.url} alt="" draggable={false} /><span className="media-type">{asset.kind === 'video' ? 'VIDEO' : 'IMG'}</span></div>
}

function Inspector({ clip }: { clip: Clip | null }) {
  const updateClip = useEditorStore(s => s.updateClip)
  if (!clip) return <div className="inspector-empty"><div className="empty-art"><Settings2 size={28} /></div><strong>Selecione um clipe</strong><span>As propriedades aparecerão aqui.</span></div>
  const field = (label: string, value: number, key: keyof Clip, step = 1, suffix = '') => (
    <label className="prop-field"><span>{label}</span><div className="number-wrap"><input type="number" value={Number(value.toFixed(2))} step={step} onChange={e => updateClip(clip.id, { [key]: Number(e.target.value) } as Partial<Clip>)} /><em>{suffix}</em></div></label>
  )
  return <div className="inspector-content">
    <div className="inspector-title-row"><div><small>CLIPE SELECIONADO</small><h2>{clip.name}</h2></div><AppIconButton label="Mais opções"><MoreHorizontal size={18} /></AppIconButton></div>
    <section className="property-section"><div className="section-heading">Transformação</div><div className="two-col">{field('Posição X', clip.x, 'x', 1, '%')}{field('Posição Y', clip.y, 'y', 1, '%')}</div><div className="two-col">{field('Largura', clip.width, 'width', 1, '%')}{field('Altura', clip.height, 'height', 1, '%')}</div>{field('Rotação', clip.rotation, 'rotation', 1, '°')}{field('Opacidade', clip.opacity * 100, 'opacity', 1, '%')}<div className="inline-actions"><button onClick={() => updateClip(clip.id, { flipX: !clip.flipX })} className={clip.flipX ? 'small-toggle active' : 'small-toggle'}>Virar horizontal</button></div></section>
    <section className="property-section"><div className="section-heading">Áudio</div><label className="range-field"><span>Volume</span><input type="range" min="0" max="1" step="0.01" value={clip.volume} onChange={e => updateClip(clip.id, { volume: Number(e.target.value) })}/><b>{Math.round(clip.volume * 100)}%</b></label><button className="wide-button" onClick={() => updateClip(clip.id, { muted: !clip.muted })}>{clip.muted ? <VolumeX size={16}/> : <Volume2 size={16}/>} {clip.muted ? 'Áudio silenciado' : 'Silenciar áudio'}</button></section>
    <section className="property-section"><div className="section-heading">Atalhos</div><div className="shortcut-row"><span>Duplicar</span><kbd>Ctrl D</kbd></div><div className="shortcut-row"><span>Excluir</span><kbd>Delete</kbd></div></section>
  </div>
}

export default function StudioApp() {
  const { project, selectedClipId, history, future, importMedia, addClip, selectClip, deleteClip, duplicateClip, undo, redo, setPlaying, setPlayhead } = useEditorStore()
  const [activeTool, setActiveTool] = useState<ToolId>('media')
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(60)
  const [snap, setSnap] = useState(true)
  const [timelineHeight, setTimelineHeight] = useState(330)
  const [libraryWidth, setLibraryWidth] = useState(312)
  const [inspectorWidth, setInspectorWidth] = useState(328)
  const [saving, setSaving] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaMap = useMemo(() => new Map(project.media.map(m => [m.id, m])), [project.media])
  const selectedClip = project.clips.find(c => c.id === selectedClipId) ?? null
  const duration = Math.max(6, project.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0) + 2)
  const filteredMedia = project.media.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
  const pxPerSecond = 42 + zoom * 0.72

  useEffect(() => {
    if (!project.isPlaying) return
    const id = window.setInterval(() => {
      const next = project.playhead + 0.1
      if (next >= duration) { setPlayhead(0); setPlaying(false) } else setPlayhead(next)
    }, 100)
    return () => window.clearInterval(id)
  }, [project.isPlaying, project.playhead, duration, setPlayhead, setPlaying])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedClipId) { e.preventDefault(); duplicateClip(selectedClipId); return }
      if (e.key === 'Delete' && selectedClipId) { deleteClip(selectedClipId); return }
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setPlaying(!project.isPlaying) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedClipId, project.isPlaying, undo, redo, duplicateClip, deleteClip, setPlaying])

  const importFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const asset = await importMedia(file, kindFromFile(file))
      addClip(asset.id)
    }
  }

  const resize = (setter: (value: number) => void, min: number, max: number, initial: number, reverse = false) => {
    return (event: React.PointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const start = event.clientX
      const move = (e: PointerEvent) => setter(Math.max(min, Math.min(max, initial + (reverse ? start - e.clientX : e.clientX - start))))
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    }
  }

  const addDemoText = () => {
    const synthetic: MediaAsset = { id: crypto.randomUUID(), name: 'Título', kind: 'image', url: '', size: 0, duration: 4 }
    // The store only accepts imported media, so this creates a lightweight visual asset for the timeline.
    useEditorStore.setState(s => ({ project: { ...s.project, media: [...s.project.media, synthetic] } }))
    window.setTimeout(() => addClip(synthetic.id), 0)
  }

  return <div className="studio-app">
    <input ref={fileRef} hidden type="file" multiple accept="video/*,image/*,audio/*" onChange={e => { if (e.target.files) void importFiles(e.target.files); e.currentTarget.value = '' }} />
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><Film size={20} /></div><div><strong>Meu Video Studio</strong><span>AI • Desktop</span></div></div>
      <div className="project-name"><input value={project.name} readOnly aria-label="Nome do projeto"/><ChevronDown size={15}/><span className="status-dot"/> <span>{saving ? 'Salvando…' : 'Salvo localmente'}</span></div>
      <div className="top-actions"><AppIconButton label="Desfazer" onClick={undo} disabled={!history.length}><Undo2 size={18}/></AppIconButton><AppIconButton label="Refazer" onClick={redo} disabled={!future.length}><Redo2 size={18}/></AppIconButton><div className="top-divider"/><button className="ghost-top" onClick={() => fileRef.current?.click()}><Upload size={16}/> Importar</button><button className="export-button" onClick={() => setShowExport(true)}><Download size={16}/> Exportar</button><AppIconButton label="Configurações"><Settings2 size={18}/></AppIconButton></div>
    </header>

    <div className="workbench" style={{ gridTemplateColumns: `64px ${libraryWidth}px minmax(460px,1fr) ${inspectorWidth}px`, gridTemplateRows: `minmax(0,1fr) ${timelineHeight}px` }}>
      <aside className="rail">
        <div className="rail-scroll">
          {tools.map(tool => { const Icon = tool.icon; return <button key={tool.id} title={tool.label} className={`rail-tool ${activeTool === tool.id ? 'active' : ''}`} onClick={() => setActiveTool(tool.id)}><Icon size={19}/><span>{tool.label}</span></button> })}
        </div>
        <button className="rail-help" title="Ajuda"><CircleHelp size={18}/></button>
      </aside>

      <section className="library-panel">
        <div className="panel-header"><div><small>WORKSPACE</small><h2>{tools.find(t => t.id === activeTool)?.label}</h2></div><AppIconButton label="Menu"><Menu size={18}/></AppIconButton></div>
        <div className="library-toolbar"><div className="search-field"><Search size={16}/><input placeholder="Pesquisar" value={query} onChange={e => setQuery(e.target.value)}/></div><button className="load-button" onClick={() => fileRef.current?.click()}><Upload size={15}/> Carregar</button></div>
        <div className="context-help">{tools.find(t => t.id === activeTool)?.helper}</div>
        <div className="library-subnav"><button className="subtab active">Meu material</button><button className="subtab">Favoritos</button><button className="subtab">Recentes</button></div>
        <div className="asset-grid">
          {activeTool === 'media' && filteredMedia.map(asset => <button className="asset-card" key={asset.id} onDoubleClick={() => addClip(asset.id)} title="Duplo clique adiciona à timeline"><MediaThumb asset={asset}/><div className="asset-meta"><span>{asset.name}</span><small>{asset.kind === 'audio' ? formatTime(asset.duration) : asset.kind === 'video' ? `${formatTime(asset.duration)} • vídeo` : 'imagem'}</small></div><span className="asset-add"><Plus size={16}/></span><div className="asset-actions"><button onClick={(e) => { e.stopPropagation(); addClip(asset.id) }}><Plus size={15}/></button></div></button>)}
          {activeTool === 'text' && <><button className="template-card title-card" onClick={addDemoText}><span>Adicionar</span><strong>Título</strong></button><button className="template-card subtitle-card" onClick={addDemoText}><span>Adicionar</span><strong>Subtítulo</strong></button></>}
          {activeTool !== 'media' && activeTool !== 'text' && <div className="module-placeholder"><div className="module-icon"><Sparkles size={26}/></div><strong>{tools.find(t => t.id === activeTool)?.label}</strong><span>Este módulo está preparado para trabalhar integrado à timeline. Comece importando um material ou selecione um clipe.</span><button className="outline-button" onClick={() => setActiveTool('media')}>Voltar para Mídia</button></div>}
          {!filteredMedia.length && activeTool === 'media' && <div className="module-placeholder"><div className="module-icon"><Upload size={26}/></div><strong>Seu projeto começa aqui</strong><span>Carregue vídeos, imagens ou áudios. Depois, dê duplo clique no item para adicionar à timeline.</span><button className="outline-button" onClick={() => fileRef.current?.click()}>Carregar arquivos</button></div>}
        </div>
      </section>

      <main className="editor-panel">
        <div className="editor-toolbar"><div className="breadcrumbs"><span>{project.name}</span><ChevronDown size={14}/></div><div className="editor-tools"><button className="toolbar-pill"><span>{project.resolution.width} × {project.resolution.height}</span><ChevronDown size={14}/></button><button className="toolbar-pill"><span>{project.fps} FPS</span><ChevronDown size={14}/></button><AppIconButton label="Ajustar visual"><Maximize2 size={16}/></AppIconButton></div></div>
        <div className="preview-area" onClick={() => selectClip(null)}>
          <div className="preview-shadow"><div className="preview-canvas" style={{ aspectRatio: `${project.resolution.width}/${project.resolution.height}` }}>
            {project.clips.filter(c => c.track !== 'audio').sort((a,b) => b.trackIndex-a.trackIndex).map(clip => { const asset = mediaMap.get(clip.assetId); if (!asset) return null; const visible = project.playhead >= clip.start && project.playhead <= clip.start + clip.duration; if (!visible) return null; const isSelected = clip.id === selectedClipId; return <div key={clip.id} className={`preview-layer ${isSelected ? 'selected' : ''}`} style={{ transform: `translate(${clip.x - 50}%, ${clip.y - 50}%) rotate(${clip.rotation}deg) scaleX(${clip.flipX ? -1 : 1})`, width: `${clip.width}%`, height: `${clip.height}%`, opacity: clip.opacity }} onClick={e => { e.stopPropagation(); selectClip(clip.id) }}><div className="layer-media">{asset.url ? <img src={asset.url} alt=""/> : <div className="text-preview">Seu título</div>}</div>{isSelected && <div className="selection-box"><i/><i/><i/><i/></div>}</div> })}
            {!project.clips.some(c => c.track !== 'audio' && project.playhead >= c.start && project.playhead <= c.start + c.duration) && <div className="preview-empty"><Film size={34}/><strong>Pré-visualização</strong><span>Adicione um vídeo ou imagem à timeline</span></div>}
          </div></div>
        </div>
        <div className="player-bar"><div className="timecode">{formatTime(project.playhead)} <span>/</span> {formatTime(duration)}</div><div className="player-controls"><AppIconButton label="Voltar 5s" onClick={() => setPlayhead(Math.max(0, project.playhead - 5))}><RotateCcw size={17}/></AppIconButton><button className="play-button" onClick={() => setPlaying(!project.isPlaying)}>{project.isPlaying ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><AppIconButton label="Avançar 5s" onClick={() => setPlayhead(Math.min(duration, project.playhead + 5))}><RotateCcw size={17} style={{ transform: 'scaleX(-1)' }}/></AppIconButton></div><div className="player-extra"><span>Preview</span><AppIconButton label="Tela cheia"><Maximize2 size={17}/></AppIconButton></div></div>
      </main>

      <section className="inspector-panel"><Inspector clip={selectedClip}/></section>

      <div className="splitter-v splitter-library" onPointerDown={resize(setLibraryWidth, 250, 430, libraryWidth)} title="Arraste para redimensionar"/>
      <div className="splitter-v splitter-inspector" onPointerDown={resize(setInspectorWidth, 280, 430, inspectorWidth, true)} title="Arraste para redimensionar"/>
      <div className="splitter-h" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const start = e.clientY; const initial = timelineHeight; const move = (ev: PointerEvent) => setTimelineHeight(Math.max(250, Math.min(520, initial + start - ev.clientY))); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up) }}/>

      <section className="timeline-panel">
        <div className="timeline-toolbar"><div className="timeline-tool-left"><button className="timeline-action" onClick={() => selectedClipId && deleteClip(selectedClipId)} disabled={!selectedClipId}><Trash2 size={16}/><span>Excluir</span></button><button className="timeline-action" onClick={() => selectedClipId && duplicateClip(selectedClipId)} disabled={!selectedClipId}><Copy size={16}/><span>Duplicar</span></button><button className="timeline-action" onClick={() => selectedClip && setPlayhead(selectedClip.start)} disabled={!selectedClip}><Split size={16}/><span>Ir para início</span></button></div><div className="timeline-tool-center"><button className={`timeline-icon ${snap ? 'active':''}`} title="Magnetismo" onClick={() => setSnap(v=>!v)}><Magnet size={17}/></button><button className="timeline-icon" title="Dividir" onClick={() => selectedClip && setPlayhead(selectedClip.start + selectedClip.duration/2)}><Scissors size={17}/></button><span className="timeline-time">{formatTime(project.playhead)}</span></div><div className="timeline-tool-right"><button className="zoom-button" onClick={() => setZoom(Math.max(10, zoom - 10))}><ZoomOut size={15}/></button><div className="zoom-track"><div className="zoom-fill" style={{ width: `${zoom}%` }}/></div><button className="zoom-button" onClick={() => setZoom(Math.min(100, zoom + 10))}><ZoomIn size={15}/></button></div></div>
        <div className="timeline-body">
          <div className="track-head-column"><div className="ruler-corner"/><div className="track-heads">{trackMap.map(track => <div className="track-head" key={track.id}><div className="track-head-name">{track.label}</div><div className="track-controls"><button><VolumeX size={14}/></button><button><Lock size={14}/></button></div></div>)}</div></div>
          <div className="timeline-scroll" onWheel={e => { if (e.shiftKey) e.currentTarget.scrollLeft += e.deltaY }}>
            <div className="timeline-content" style={{ width: Math.max(980, duration * pxPerSecond + 120) }}>
              <div className="ruler" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setPlayhead(Math.max(0, Math.min(duration, (e.clientX - rect.left) / pxPerSecond))) }}>
                {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => <span key={i} style={{ left: i * pxPerSecond }}>{i % 5 === 0 ? <b>{formatTime(i).slice(0,5)}</b> : null}</span>)}
                <div className="playhead" style={{ left: project.playhead * pxPerSecond }} />
              </div>
              <div className="track-list">
                {trackMap.map(track => <div className="track-row" key={track.id}>
                  {project.clips.filter(c => c.track === track.kind && c.trackIndex === track.index).map(clip => <div key={clip.id} className={`timeline-clip ${track.kind} ${selectedClipId === clip.id ? 'selected':''}`} style={{ left: clip.start * pxPerSecond, width: Math.max(54, clip.duration * pxPerSecond) }} onClick={() => selectClip(clip.id)} title={`${clip.name} • ${formatTime(clip.duration)}`}>
                    <div className="clip-strip">{track.kind === 'video' && mediaMap.get(clip.assetId)?.url ? <img src={mediaMap.get(clip.assetId)?.url} alt=""/> : null}<div className="clip-label"><strong>{clip.name}</strong><span>{formatTime(clip.duration)}</span></div></div><div className="trim-handle left"/><div className="trim-handle right"/>
                  </div>)}
                </div>)}
              </div>
              <div className="playhead-line" style={{ left: project.playhead * pxPerSecond }} />
            </div>
          </div>
        </div>
      </section>
    </div>

    {showExport && <div className="modal-backdrop" onClick={() => setShowExport(false)}><div className="export-modal" onClick={e => e.stopPropagation()}><div className="modal-title"><div><small>EXPORTAR PROJETO</small><h2>Renderizar vídeo</h2></div><AppIconButton label="Fechar" onClick={() => setShowExport(false)}><X size={18}/></AppIconButton></div><div className="export-grid"><label>Formato<select><option>MP4 (H.264)</option></select></label><label>Qualidade<select><option>1080p • Alta</option><option>720p • Alta</option></select></label><label>FPS<select><option>{project.fps}</option><option>24</option><option>60</option></select></label><label>Intervalo<select><option>Projeto inteiro</option><option>Clipe selecionado</option></select></label></div><div className="export-note"><Download size={20}/><div><strong>Exportação local</strong><span>O próximo passo do motor nativo usará FFmpeg/Tauri para renderizar o arquivo diretamente no computador.</span></div></div><div className="modal-footer"><button className="ghost-top" onClick={() => setShowExport(false)}>Cancelar</button><button className="export-button" onClick={() => { setSaving(true); window.setTimeout(() => { setSaving(false); setShowExport(false) }, 700) }}><Download size={16}/> Iniciar exportação</button></div></div></div>}
  </div>
}
