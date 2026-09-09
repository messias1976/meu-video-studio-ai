import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AudioLines,
  Bell,
  Captions,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  Film,
  FolderOpen,
  Gauge,
  Home,
  Image as ImageIcon,
  Layers3,
  Menu,
  Mic2,
  MoreHorizontal,
  Music2,
  Palette,
  Pause,
  Play,
  Plus,
  Redo2,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Scissors,
  Trash2,
  Type,
  Undo2,
  Upload,
  Video,
  WandSparkles,
  X,
} from 'lucide-react'
import './App.css'

type Format = '16:9' | '9:16' | '1:1' | '4:5'
type Resolution = '720p' | '1080p' | '2K' | '4K'
type Fps = 24 | 30 | 60
type MediaKind = 'video' | 'image' | 'audio'
type Tool = 'media' | 'text' | 'audio' | 'elements' | 'effects' | 'transitions' | 'filters' | 'captions' | 'ai'

type MediaAsset = {
  id: string
  name: string
  kind: MediaKind
  url: string
  duration: number
  file?: File
}

type TextLayer = {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  weight: number
  shadow: boolean
}

type Clip = {
  id: string
  assetId: string
  start: number
  duration: number
  track: 'video' | 'audio' | 'overlay'
}

type Project = {
  id: string
  name: string
  format: Format
  resolution: Resolution
  fps: Fps
  createdAt: string
  updatedAt: string
  media: MediaAsset[]
  clips: Clip[]
  texts: TextLayer[]
  filter: string
  filterIntensity: number
  playhead: number
}

const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
const SETTINGS_KEY = 'meu-video-studio-ai:settings:v1'

const toolItems: { id: Tool; label: string; icon: typeof Film }[] = [
  { id: 'media', label: 'Mídia', icon: FolderOpen },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'audio', label: 'Áudio', icon: AudioLines },
  { id: 'elements', label: 'Elementos', icon: Layers3 },
  { id: 'effects', label: 'Efeitos', icon: WandSparkles },
  { id: 'transitions', label: 'Transições', icon: SlidersHorizontal },
  { id: 'filters', label: 'Filtros', icon: Palette },
  { id: 'captions', label: 'Legendas', icon: Captions },
  { id: 'ai', label: 'IA', icon: Sparkles },
]

const defaultFilters = ['Nenhum', 'Cinemático', 'Vintage', 'Quente', 'Frio', 'P&B', 'Vibrante']

function readProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function newProject(name = 'Meu novo vídeo'): Project {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    format: '9:16',
    resolution: '1080p',
    fps: 30,
    createdAt: now,
    updatedAt: now,
    media: [],
    clips: [],
    texts: [],
    filter: 'Nenhum',
    filterIntensity: 100,
    playhead: 0,
  }
}

function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => readProjects())

  const persist = (next: Project[]) => {
    setProjects(next)
    saveProjects(next)
  }

  const upsert = (project: Project) => {
    const next = projects.some((p) => p.id === project.id)
      ? projects.map((p) => (p.id === project.id ? project : p))
      : [...projects, project]
    persist(next)
  }

  return { projects, setProjects, persist, upsert }
}

function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { to: '/', label: 'Início', icon: Home },
    { to: '/projetos', label: 'Meus projetos', icon: FolderOpen },
    { to: '/novo-projeto', label: 'Novo projeto', icon: Plus },
    { to: '/ia', label: 'Ferramentas IA', icon: Sparkles },
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand" onClick={() => navigate('/')} role="button" tabIndex={0}>
          <div className="brand-mark"><Video size={20} /></div>
          <div>
            <strong>Meu Video Studio</strong>
            <span>AI · edição pessoal</span>
          </div>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <Sparkles size={16} />
          <div><strong>100% pessoal</strong><span>Seus projetos ficam no navegador.</span></div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu"><Menu size={18} /></button>
          <div className="search-box"><Search size={17} /><input placeholder="Pesquisar projetos..." /></div>
          <div className="topbar-actions">
            <button className="icon-btn" title="Ajuda"><CircleHelp size={18} /></button>
            <button className="icon-btn" title="Notificações"><Bell size={18} /></button>
            <div className="profile-chip"><div className="profile-avatar">M</div><span>Messias</span><ChevronDown size={15} /></div>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}

function HomePage() {
  const { projects } = useProjects()
  const navigate = useNavigate()

  return (
    <div className="page fade-in">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> Estúdio pessoal de criação</span>
          <h1>Crie, edite e transforme suas ideias em vídeos.</h1>
          <p>Um editor pessoal para YouTube, Instagram, Reels, Shorts e qualquer projeto que você quiser criar.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => navigate('/novo-projeto')}><Plus size={18} /> Novo projeto</button>
            <button className="ghost-btn" onClick={() => navigate('/projetos')}><FolderOpen size={18} /> Meus projetos</button>
          </div>
        </div>
        <div className="hero-preview">
          <div className="hero-grid" />
          <div className="hero-window">
            <div className="hero-window-top"><span /><span /><span /></div>
            <div className="hero-window-body"><Film size={42} /><strong>Seu próximo vídeo</strong><small>Comece a criar agora</small></div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><div className="stat-icon purple"><Film size={19} /></div><div><span>Projetos</span><strong>{projects.length}</strong></div></div>
        <div className="stat-card"><div className="stat-icon blue"><FolderOpen size={19} /></div><div><span>Armazenamento</span><strong>Local</strong></div></div>
        <div className="stat-card"><div className="stat-icon green"><Sparkles size={19} /></div><div><span>IA</span><strong>Opcional</strong></div></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><h2>Projetos recentes</h2><p>Continue de onde parou.</p></div><Link to="/projetos" className="text-link">Ver todos →</Link></div>
        {projects.length === 0 ? (
          <div className="empty-card"><Film size={34} /><strong>Nenhum projeto ainda</strong><span>Crie seu primeiro vídeo para começar.</span><button className="primary-btn" onClick={() => navigate('/novo-projeto')}>Criar primeiro projeto</button></div>
        ) : (
          <div className="project-grid">{projects.slice(0, 4).map((project) => <ProjectCard key={project.id} project={project} />)}</div>
        )}
      </section>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to={`/editor/${project.id}`} className="project-card">
      <div className="project-thumb"><Film size={30} /><span>{project.format}</span></div>
      <div className="project-card-body"><strong>{project.name}</strong><span>{project.resolution} · {project.fps} FPS · atualizado recentemente</span></div>
    </Link>
  )
}

function ProjectsPage() {
  const { projects, persist } = useProjects()
  const navigate = useNavigate()

  const duplicate = (project: Project) => {
    const clone = { ...project, id: crypto.randomUUID(), name: `${project.name} — cópia`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    persist([...projects, clone])
  }

  const rename = (project: Project) => {
    const value = window.prompt('Novo nome:', project.name)
    if (!value?.trim()) return
    persist(projects.map((p) => p.id === project.id ? { ...p, name: value.trim(), updatedAt: new Date().toISOString() } : p))
  }

  const remove = (project: Project) => {
    if (!window.confirm(`Excluir “${project.name}”?`)) return
    persist(projects.filter((p) => p.id !== project.id))
  }

  return (
    <div className="page fade-in">
      <PageTitle title="Meus projetos" subtitle="Todos os seus projetos de vídeo ficam organizados aqui." action={<button className="primary-btn" onClick={() => navigate('/novo-projeto')}><Plus size={18} /> Novo projeto</button>} />
      {projects.length === 0 ? <div className="empty-card large"><FolderOpen size={42} /><strong>Seu espaço de criação está vazio</strong><span>Crie o primeiro projeto e comece a editar.</span><button className="primary-btn" onClick={() => navigate('/novo-projeto')}>Criar projeto</button></div> : (
        <div className="project-grid">{projects.map((project) => (
          <div key={project.id} className="project-card project-card-managed">
            <Link to={`/editor/${project.id}`} className="project-thumb"><Film size={30} /><span>{project.format}</span></Link>
            <div className="project-card-body"><strong>{project.name}</strong><span>{project.resolution} · {project.fps} FPS</span></div>
            <div className="project-actions"><button onClick={() => navigate(`/editor/${project.id}`)}>Abrir</button><button onClick={() => rename(project)} title="Renomear"><Type size={15} /></button><button onClick={() => duplicate(project)} title="Duplicar"><Copy size={15} /></button><button onClick={() => remove(project)} className="danger" title="Excluir"><Trash2 size={15} /></button></div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function NewProjectPage() {
  const navigate = useNavigate()
  const { projects, persist } = useProjects()
  const [name, setName] = useState('Meu novo vídeo')
  const [format, setFormat] = useState<Format>('9:16')
  const [resolution, setResolution] = useState<Resolution>('1080p')
  const [fps, setFps] = useState<Fps>(30)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const project = newProject(name.trim() || 'Projeto sem nome')
    const ready = { ...project, format, resolution, fps }
    persist([...projects, ready])
    navigate(`/editor/${ready.id}`)
  }

  return (
    <div className="page narrow fade-in">
      <PageTitle title="Novo projeto" subtitle="Defina o formato e a qualidade do seu vídeo." />
      <form className="form-card" onSubmit={submit}>
        <label>Nome do projeto<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reels de campanha" /></label>
        <div><span className="field-label">Formato</span><div className="option-grid four">{(['16:9', '9:16', '1:1', '4:5'] as Format[]).map((value) => <button key={value} type="button" onClick={() => setFormat(value)} className={`option-card ${format === value ? 'selected' : ''}`}><strong>{value}</strong><span>{value === '9:16' ? 'Reels / Shorts' : value === '16:9' ? 'YouTube' : 'Social'}</span></button>)}</div></div>
        <div className="two-cols"><label>Resolução<select value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}><option>720p</option><option>1080p</option><option>2K</option><option>4K</option></select></label><label>FPS<select value={fps} onChange={(e) => setFps(Number(e.target.value) as Fps)}><option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label></div>
        <div className="form-actions"><Link className="ghost-btn" to="/">Cancelar</Link><button className="primary-btn" type="submit"><Film size={17} /> Criar e editar</button></div>
      </form>
    </div>
  )
}

function EditorPage() {
  const { id } = useParams()
  const { projects, persist } = useProjects()
  const project = projects.find((item) => item.id === id)
  const [activeTool, setActiveTool] = useState<Tool>('media')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(project?.media[0]?.id ?? null)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResult, setAiResult] = useState('')
  const [apiKey, setApiKey] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').apiKey || '' } catch { return '' }
  })
  const [showExport, setShowExport] = useState(false)
  const [status, setStatus] = useState('Salvo localmente')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef(project)

  useEffect(() => { projectRef.current = project }, [project])

  if (!project) return <div className="empty-card large"><strong>Projeto não encontrado</strong><Link className="primary-btn" to="/projetos">Voltar aos projetos</Link></div>

  const update = (patch: Partial<Project>) => {
    const next = { ...project, ...patch, updatedAt: new Date().toISOString() }
    persist(projects.map((p) => p.id === project.id ? next : p))
    setStatus('Salvo localmente')
  }

  const currentAsset = project.media.find((m) => m.id === selectedAssetId) ?? project.media.find((m) => m.kind === 'video' || m.kind === 'image')
  const selectedText = project.texts.find((t) => t.id === selectedTextId)

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const media: MediaAsset[] = files.map((file) => ({ id: crypto.randomUUID(), name: file.name, kind: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image', url: URL.createObjectURL(file), duration: 0, file }))
    const videoClipCount = project.clips.filter((c) => c.track === 'video').length
    const newClips = media.filter((m) => m.kind !== 'audio').map((m, index) => ({ id: crypto.randomUUID(), assetId: m.id, start: videoClipCount + index * 5, duration: 5, track: 'video' as const }))
    update({ media: [...project.media, ...media], clips: [...project.clips, ...newClips] })
    setSelectedAssetId(media[0]?.id ?? null)
    setActiveTool('media')
    event.target.value = ''
  }

  const removeAsset = (assetId: string) => update({ media: project.media.filter((m) => m.id !== assetId), clips: project.clips.filter((c) => c.assetId !== assetId) })

  const addText = (text = 'Seu texto') => {
    const layer: TextLayer = { id: crypto.randomUUID(), text, x: 50, y: 50, fontSize: 40, color: '#ffffff', weight: 700, shadow: true }
    update({ texts: [...project.texts, layer] })
    setSelectedTextId(layer.id)
    setActiveTool('text')
  }

  const updateText = (patch: Partial<TextLayer>) => {
    if (!selectedTextId) return
    update({ texts: project.texts.map((t) => t.id === selectedTextId ? { ...t, ...patch } : t) })
  }

  const deleteText = () => {
    if (!selectedTextId) return
    update({ texts: project.texts.filter((t) => t.id !== selectedTextId) })
    setSelectedTextId(null)
  }

  const handleVideoMeta = () => {
    const duration = videoRef.current?.duration || 0
    if (!currentAsset || duration <= 0) return
    const media = project.media.map((m) => m.id === currentAsset.id ? { ...m, duration } : m)
    const clips = project.clips.map((c) => c.assetId === currentAsset.id ? { ...c, duration } : c)
    update({ media, clips })
  }

  const playPause = async () => {
    if (!videoRef.current || currentAsset?.kind !== 'video') return
    if (videoRef.current.paused) { await videoRef.current.play(); setIsPlaying(true) } else { videoRef.current.pause(); setIsPlaying(false) }
  }

  const onTimeUpdate = () => {
    const value = videoRef.current?.currentTime ?? 0
    update({ playhead: value })
  }

  const changeFilter = (filter: string) => update({ filter })

  const useTool = (tool: Tool) => setActiveTool(tool)

  const addAudioClip = (asset: MediaAsset) => {
    const start = project.clips.filter((c) => c.track === 'audio').reduce((max, c) => Math.max(max, c.start + c.duration), 0)
    const clip: Clip = { id: crypto.randomUUID(), assetId: asset.id, start, duration: asset.duration || 10, track: 'audio' }
    update({ clips: [...project.clips, clip] })
  }

  const splitSelectedClip = () => {
    if (!selectedAssetId) return
    const clip = project.clips.find((c) => c.assetId === selectedAssetId)
    if (!clip || clip.duration < 1) return
    const half = clip.duration / 2
    const a = { ...clip, id: crypto.randomUUID(), duration: half }
    const b = { ...clip, id: crypto.randomUUID(), start: clip.start + half, duration: half }
    update({ clips: [...project.clips.filter((c) => c.id !== clip.id), a, b] })
  }

  const changeSpeed = (speed: number) => {
    if (!selectedAssetId) return
    update({ clips: project.clips.map((c) => c.assetId === selectedAssetId ? { ...c, duration: Math.max(.5, c.duration / speed) } : c) })
  }

  const generateAi = async () => {
    if (!apiKey) {
      setAiResult('Adicione sua chave do Gemini em Configurações para usar a IA. O editor funciona sem IA.')
      return
    }
    if (!aiPrompt.trim()) return
    setAiResult('Gerando...')
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] }),
      })
      const data = await response.json()
      const result = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || 'Não foi possível obter resposta.'
      setAiResult(result)
    } catch (error) {
      setAiResult(error instanceof Error ? error.message : 'Falha ao conectar com a IA.')
    }
  }

  const saveApiKey = (value: string) => {
    setApiKey(value)
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: value })) } catch { /* local only */ }
  }

  const exportVideo = async () => {
    setShowExport(false)
    if (!currentAsset || currentAsset.kind !== 'video' || !videoRef.current) {
      setStatus('Selecione um vídeo para exportar.')
      return
    }
    const video = videoRef.current
    if (video.readyState < 2) { setStatus('Aguarde o vídeo carregar.') ; return }
    setStatus('Preparando exportação...')
    const width = project.format === '9:16' ? 1080 : project.format === '1:1' ? 1080 : project.format === '4:5' ? 1080 : 1920
    const height = project.format === '9:16' ? 1920 : project.format === '1:1' ? 1080 : project.format === '4:5' ? 1350 : 1080
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { setStatus('Canvas indisponível.') ; return }
    const stream = canvas.captureStream(project.fps)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.webm`; a.click(); URL.revokeObjectURL(url)
      setStatus('Exportado com sucesso')
    }
    const wasPlaying = !video.paused
    video.pause(); setIsPlaying(false)
    recorder.start()
    const duration = Math.min(video.duration || 5, 30)
    video.currentTime = 0
    const draw = () => {
      if (video.currentTime >= duration || video.ended) { recorder.stop(); return }
      const vw = video.videoWidth || 16, vh = video.videoHeight || 9
      const scale = Math.max(width / vw, height / vh)
      const dw = vw * scale, dh = vh * scale
      ctx.filter = project.filter === 'P&B' ? 'grayscale(1)' : project.filter === 'Quente' ? 'sepia(.3) saturate(1.3)' : project.filter === 'Frio' ? 'saturate(.85) hue-rotate(10deg)' : project.filter === 'Vintage' ? 'sepia(.45) contrast(.95)' : project.filter === 'Cinemático' ? 'contrast(1.1) saturate(1.05)' : project.filter === 'Vibrante' ? 'saturate(1.35)' : 'none'
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height)
      ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh)
      ctx.filter = 'none'
      project.texts.forEach((t) => { ctx.font = `${t.weight} ${t.fontSize * (width / 1080)}px Arial`; ctx.fillStyle = t.color; ctx.textAlign = 'center'; if (t.shadow) { ctx.shadowColor = '#000'; ctx.shadowBlur = 10 } ctx.fillText(t.text, width * t.x / 100, height * t.y / 100); ctx.shadowBlur = 0 })
      requestAnimationFrame(draw)
    }
    draw()
    if (wasPlaying) video.play().catch(() => undefined)
  }

  const visibleTexts = project.texts

  return (
    <div className="editor-shell fade-in">
      <div className="editor-topbar">
        <div className="editor-project-name"><Link to="/projetos" className="icon-btn"><X size={17} /></Link><div><strong>{project.name}</strong><span>{project.format} · {project.resolution} · {project.fps} FPS</span></div></div>
        <div className="editor-top-actions"><span className="save-state"><span className="status-dot" /> {status}</span><button className="icon-btn"><Undo2 size={17} /></button><button className="icon-btn"><Redo2 size={17} /></button><button className="export-btn" onClick={() => setShowExport(true)}><Download size={16} /> Exportar</button></div>
      </div>

      <div className="editor-body">
        <aside className="tool-rail">{toolItems.map((tool) => { const Icon = tool.icon; return <button key={tool.id} onClick={() => useTool(tool.id)} className={`tool-rail-btn ${activeTool === tool.id ? 'active' : ''}`} title={tool.label}><Icon size={19} /><span>{tool.label}</span></button> })}</aside>

        <aside className="editor-panel left-panel">
          {activeTool === 'media' && <MediaPanel project={project} onAdd={addFiles} onRemove={removeAsset} selectedAssetId={selectedAssetId} onSelect={setSelectedAssetId} fileRef={fileRef} />}
          {activeTool === 'text' && <TextPanel texts={project.texts} selected={selectedText} onAdd={() => addText()} onChange={updateText} onDelete={deleteText} />}
          {activeTool === 'audio' && <AudioPanel project={project} onAdd={addAudioClip} />}
          {activeTool === 'elements' && <ElementsPanel onAddText={() => addText('Elemento')} />}
          {activeTool === 'effects' && <EffectsPanel onSelect={(effect) => setAiResult(`Efeito selecionado: ${effect}`)} />}
          {activeTool === 'transitions' && <TransitionsPanel />}
          {activeTool === 'filters' && <FiltersPanel selected={project.filter} intensity={project.filterIntensity} onSelect={changeFilter} onIntensity={(v) => update({ filterIntensity: v })} />}
          {activeTool === 'captions' && <CaptionsPanel captionText={captionText} onText={setCaptionText} onAdd={() => addText(captionText || 'Legenda')} />}
          {activeTool === 'ai' && <AIPanel prompt={aiPrompt} onPrompt={setAiPrompt} result={aiResult} onGenerate={generateAi} apiKey={apiKey} onApiKey={saveApiKey} />}
        </aside>

        <section className="editor-center">
          <div className="canvas-toolbar"><button className="mini-btn"><Gauge size={14} /> Ajustar</button><span>{currentAsset ? currentAsset.name : 'Nenhuma mídia selecionada'}</span><button className="mini-btn"><MoreHorizontal size={16} /></button></div>
          <div className="preview-area">
            <div className={`video-stage ${project.format === '16:9' ? 'landscape' : project.format === '1:1' ? 'square' : project.format === '4:5' ? 'portrait-feed' : 'portrait'}`}>
              {currentAsset?.kind === 'video' && <video ref={videoRef} src={currentAsset.url} onLoadedMetadata={handleVideoMeta} onTimeUpdate={onTimeUpdate} playsInline style={{ filter: project.filter === 'P&B' ? 'grayscale(1)' : project.filter === 'Quente' ? 'sepia(.25) saturate(1.2)' : project.filter === 'Frio' ? 'saturate(.85) hue-rotate(8deg)' : project.filter === 'Vintage' ? 'sepia(.35)' : project.filter === 'Cinemático' ? 'contrast(1.08)' : project.filter === 'Vibrante' ? 'saturate(1.3)' : 'none' }} />}
              {currentAsset?.kind === 'image' && <img src={currentAsset.url} alt="Mídia" />}
              {!currentAsset && <div className="preview-empty"><Film size={42} /><strong>Adicione sua primeira mídia</strong><span>Arraste um vídeo, imagem ou áudio para começar.</span><button className="primary-btn" onClick={() => { setActiveTool('media'); fileRef.current?.click() }}><Upload size={17} /> Enviar mídia</button></div>}
              {visibleTexts.map((text) => <button key={text.id} className={`overlay-text ${selectedTextId === text.id ? 'selected' : ''}`} style={{ left: `${text.x}%`, top: `${text.y}%`, color: text.color, fontSize: `${Math.max(12, text.fontSize / 2)}px`, fontWeight: text.weight, textShadow: text.shadow ? '0 3px 12px #000' : 'none' }} onClick={() => setSelectedTextId(text.id)}>{text.text}</button>)}
            </div>
          </div>
          <div className="playback-bar"><button className="play-circle" onClick={playPause}>{isPlaying ? <Pause size={17} /> : <Play size={17} />}</button><span>{formatTime(project.playhead)}</span><input aria-label="Posição" type="range" min="0" max={currentAsset?.duration || 1} step="0.01" value={Math.min(project.playhead, currentAsset?.duration || 1)} onChange={(e) => { const value = Number(e.target.value); if (videoRef.current) videoRef.current.currentTime = value; update({ playhead: value }) }} /><span>{formatTime(currentAsset?.duration || 0)}</span></div>
        </section>

        <aside className="editor-panel right-panel"><Inspector project={project} selectedText={selectedText} onText={updateText} onSpeed={changeSpeed} onSplit={splitSelectedClip} /></aside>
      </div>

      <Timeline project={project} selectedAssetId={selectedAssetId} onSelectAsset={setSelectedAssetId} onDeleteClip={(id) => update({ clips: project.clips.filter((c) => c.id !== id) })} onMoveClip={(id, start) => update({ clips: project.clips.map((c) => c.id === id ? { ...c, start: Math.max(0, start) } : c) })} />

      {showExport && <ExportModal project={project} onClose={() => setShowExport(false)} onExport={exportVideo} />}
    </div>
  )
}

function MediaPanel({ project, onAdd, onRemove, selectedAssetId, onSelect, fileRef }: { project: Project; onAdd: (e: ChangeEvent<HTMLInputElement>) => void; onRemove: (id: string) => void; selectedAssetId: string | null; onSelect: (id: string) => void; fileRef: React.RefObject<HTMLInputElement | null> }) {
  return <div className="panel-content"><PanelHeader title="Mídia" action={<button className="small-icon-btn" onClick={() => fileRef.current?.click()}><Plus size={15} /></button>} /><input ref={fileRef} hidden type="file" multiple accept="video/*,image/*,audio/*" onChange={onAdd} /><button className="upload-zone" onClick={() => fileRef.current?.click()}><Upload size={22} /><strong>Enviar arquivos</strong><span>Vídeos, imagens e áudios</span></button><div className="panel-list">{project.media.map((asset) => <div key={asset.id} className={`media-row ${selectedAssetId === asset.id ? 'selected' : ''}`} onClick={() => onSelect(asset.id)}><div className="media-thumb">{asset.kind === 'video' ? <Film size={17} /> : asset.kind === 'audio' ? <Music2 size={17} /> : <ImageIcon size={17} />}</div><div className="media-meta"><strong>{asset.name}</strong><span>{asset.kind}</span></div><button className="row-action" onClick={(e) => { e.stopPropagation(); onRemove(asset.id) }}><Trash2 size={14} /></button></div>)}{project.media.length === 0 && <div className="muted-empty">Sua biblioteca está vazia.</div>}</div></div>
}

function TextPanel({ texts, selected, onAdd, onChange, onDelete }: { texts: TextLayer[]; selected?: TextLayer; onAdd: () => void; onChange: (p: Partial<TextLayer>) => void; onDelete: () => void }) {
  return <div className="panel-content"><PanelHeader title="Texto" action={<button className="small-icon-btn" onClick={onAdd}><Plus size={15} /></button>} /><button className="text-template" onClick={onAdd}><Type size={18} /><div><strong>Adicionar texto</strong><span>Crie títulos, frases e legendas.</span></div></button>{selected && <div className="inspector-inline"><label>Texto<input value={selected.text} onChange={(e) => onChange({ text: e.target.value })} /></label><label>Tamanho<input type="range" min="14" max="120" value={selected.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} /></label><label>Cor<input type="color" value={selected.color} onChange={(e) => onChange({ color: e.target.value })} /></label><button className="danger-btn" onClick={onDelete}><Trash2 size={15} /> Excluir texto</button></div>}{!selected && texts.length > 0 && <p className="helper">Selecione um texto diretamente no preview.</p>}</div>
}

function AudioPanel({ project, onAdd }: { project: Project; onAdd: (asset: MediaAsset) => void }) {
  const audio = project.media.filter((m) => m.kind === 'audio')
  return <div className="panel-content"><PanelHeader title="Áudio" /><div className="feature-card"><Music2 size={20} /><strong>Biblioteca local</strong><span>Use seus próprios arquivos de áudio no projeto.</span></div>{audio.map((asset) => <button key={asset.id} className="list-button" onClick={() => onAdd(asset)}><Music2 size={16} /><span>{asset.name}</span><Plus size={15} /></button>)}{audio.length === 0 && <div className="muted-empty">Adicione um arquivo de áudio pela aba Mídia.</div>}</div>
}

function ElementsPanel({ onAddText }: { onAddText: () => void }) { return <div className="panel-content"><PanelHeader title="Elementos" /><div className="element-grid">{['Forma', 'Seta', 'Círculo', 'Emoji', 'Stickers', 'Texto'].map((item) => <button key={item} onClick={item === 'Texto' ? onAddText : undefined} className="element-card"><Layers3 size={17} /><span>{item}</span></button>)}</div></div> }
function EffectsPanel({ onSelect }: { onSelect: (effect: string) => void }) { return <div className="panel-content"><PanelHeader title="Efeitos" /><div className="effect-grid">{['Glitch', 'Flash', 'Zoom', 'Partículas', 'Luz', 'Retro', 'Desfoque', 'Cinema'].map((effect) => <button key={effect} onClick={() => onSelect(effect)} className="effect-card"><span>{effect}</span></button>)}</div></div> }
function TransitionsPanel() { return <div className="panel-content"><PanelHeader title="Transições" /><div className="effect-grid">{['Fade', 'Slide', 'Zoom', 'Blur', 'Flash', 'Rotate', 'Glitch'].map((x) => <button key={x} className="effect-card"><span>{x}</span></button>)}</div><p className="helper">Arraste a transição para a Timeline na próxima evolução do editor.</p></div> }
function FiltersPanel({ selected, intensity, onSelect, onIntensity }: { selected: string; intensity: number; onSelect: (v: string) => void; onIntensity: (v: number) => void }) { return <div className="panel-content"><PanelHeader title="Filtros" /><div className="effect-grid">{defaultFilters.map((x) => <button key={x} onClick={() => onSelect(x)} className={`effect-card ${selected === x ? 'selected' : ''}`}><span>{x}</span></button>)}</div><label className="range-label">Intensidade <span>{intensity}%</span><input type="range" min="0" max="100" value={intensity} onChange={(e) => onIntensity(Number(e.target.value))} /></label></div> }
function CaptionsPanel({ captionText, onText, onAdd }: { captionText: string; onText: (v: string) => void; onAdd: () => void }) { return <div className="panel-content"><PanelHeader title="Legendas" /><div className="feature-card"><Captions size={20} /><strong>Legenda manual</strong><span>A legenda automática por IA fica disponível quando você conectar uma API.</span></div><label>Texto da legenda<textarea value={captionText} onChange={(e) => onText(e.target.value)} placeholder="Digite uma legenda..." /></label><button className="primary-btn full" onClick={onAdd}><Plus size={16} /> Adicionar à tela</button></div> }
function AIPanel({ prompt, onPrompt, result, onGenerate, apiKey, onApiKey }: { prompt: string; onPrompt: (v: string) => void; result: string; onGenerate: () => void; apiKey: string; onApiKey: (v: string) => void }) { return <div className="panel-content"><PanelHeader title="Assistente IA" /><div className="feature-card purple-card"><Sparkles size={20} /><strong>IA opcional</strong><span>Seu editor funciona sem uma chave. Quando quiser, conecte o Gemini.</span></div><label>Chave Gemini<input type="password" value={apiKey} onChange={(e) => onApiKey(e.target.value)} placeholder="Cole sua API key" /></label><label>O que você quer criar?<textarea value={prompt} onChange={(e) => onPrompt(e.target.value)} placeholder="Ex.: Crie um roteiro de 30 segundos sobre marketing digital." /></label><button className="primary-btn full" onClick={onGenerate}><Sparkles size={16} /> Gerar com IA</button>{result && <div className="ai-result">{result}</div>}</div> }

function Inspector({ project, selectedText, onText, onSpeed, onSplit }: { project: Project; selectedText?: TextLayer; onText: (p: Partial<TextLayer>) => void; onSpeed: (s: number) => void; onSplit: () => void }) { return <div className="panel-content"><PanelHeader title="Propriedades" />{selectedText ? <><label>Texto<input value={selectedText.text} onChange={(e) => onText({ text: e.target.value })} /></label><div className="two-cols"><label>Pos. X<input type="number" value={selectedText.x} onChange={(e) => onText({ x: Number(e.target.value) })} /></label><label>Pos. Y<input type="number" value={selectedText.y} onChange={(e) => onText({ y: Number(e.target.value) })} /></label></div><label>Tamanho<input type="range" min="14" max="120" value={selectedText.fontSize} onChange={(e) => onText({ fontSize: Number(e.target.value) })} /></label></> : <><div className="property-card"><span>Formato</span><strong>{project.format}</strong></div><div className="property-card"><span>Resolução</span><strong>{project.resolution}</strong></div><div className="property-card"><span>FPS</span><strong>{project.fps}</strong></div><div className="tool-group-title">Edição rápida</div><div className="quick-actions"><button onClick={onSplit}><Scissors size={15} /> Dividir</button><button onClick={() => onSpeed(.5)}>0.5×</button><button onClick={() => onSpeed(2)}>2×</button></div></>}</div> }
function PanelHeader({ title, action }: { title: string; action?: ReactNode }) { return <div className="panel-header"><strong>{title}</strong>{action}</div> }

function Timeline({ project, selectedAssetId, onSelectAsset, onDeleteClip, onMoveClip }: { project: Project; selectedAssetId: string | null; onSelectAsset: (id: string) => void; onDeleteClip: (id: string) => void; onMoveClip: (id: string, start: number) => void }) {
  const videoClips = project.clips.filter((c) => c.track === 'video')
  const audioClips = project.clips.filter((c) => c.track === 'audio')
  const duration = Math.max(20, ...project.clips.map((c) => c.start + c.duration), 20)
  const px = 60
  return <div className="timeline"><div className="timeline-head"><div><strong>Timeline</strong><span>{formatTime(duration)} projeto</span></div><div className="timeline-controls"><button className="icon-btn"><SlidersHorizontal size={15} /></button><button className="icon-btn"><Search size={15} /></button></div></div><div className="timeline-scroll"><div className="time-ruler" style={{ width: duration * px + 120 }}>{Array.from({ length: Math.ceil(duration / 5) + 1 }).map((_, i) => <span key={i} style={{ left: i * 5 * px }}>{formatTime(i * 5)}</span>)}</div><Track label="Vídeo" icon={<Film size={14} />} clips={videoClips} project={project} selectedAssetId={selectedAssetId} onSelectAsset={onSelectAsset} onDeleteClip={onDeleteClip} onMoveClip={onMoveClip} duration={duration} px={px} /><Track label="Áudio" icon={<AudioLines size={14} />} clips={audioClips} project={project} selectedAssetId={selectedAssetId} onSelectAsset={onSelectAsset} onDeleteClip={onDeleteClip} onMoveClip={onMoveClip} duration={duration} px={px} /></div></div>
}
function Track({ label, icon, clips, project, selectedAssetId, onSelectAsset, onDeleteClip, onMoveClip, duration, px }: { label: string; icon: ReactNode; clips: Clip[]; project: Project; selectedAssetId: string | null; onSelectAsset: (id: string) => void; onDeleteClip: (id: string) => void; onMoveClip: (id: string, start: number) => void; duration: number; px: number }) {
  return <div className="timeline-track"><div className="track-label">{icon}<span>{label}</span></div><div className="track-lane" style={{ width: duration * px + 20 }}>{clips.map((clip) => { const asset = project.media.find((m) => m.id === clip.assetId); if (!asset) return null; return <div key={clip.id} className={`timeline-clip ${selectedAssetId === asset.id ? 'selected' : ''}`} draggable onDragEnd={(e) => { const lane = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); const x = e.clientX - lane.left; onMoveClip(clip.id, Math.max(0, x / px)) }} onClick={() => onSelectAsset(asset.id)} style={{ left: clip.start * px, width: Math.max(60, clip.duration * px) }}><span>{asset.kind === 'audio' ? '♫ ' : ''}{asset.name}</span><button onClick={(e) => { e.stopPropagation(); onDeleteClip(clip.id) }}><Trash2 size={13} /></button></div> })}</div></div>
}

function ExportModal({ project, onClose, onExport }: { project: Project; onClose: () => void; onExport: () => void }) { return <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><div><h2>Exportar vídeo</h2><p>Processamento local no navegador.</p></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div><div className="export-options"><div className="property-card"><span>Formato</span><strong>{project.format}</strong></div><div className="property-card"><span>Qualidade</span><strong>{project.resolution}</strong></div><div className="property-card"><span>FPS</span><strong>{project.fps}</strong></div><div className="property-card"><span>Saída</span><strong>WebM</strong></div></div><div className="export-note"><Download size={17} /> A versão atual exporta a composição do vídeo selecionado, texto e filtros. Áudio/multiclipes podem ser ampliados com FFmpeg na próxima etapa.</div><div className="form-actions"><button className="ghost-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" onClick={onExport}><Download size={17} /> Exportar agora</button></div></div></div> }

function IAPage() { const [prompt, setPrompt] = useState(''); const [result, setResult] = useState(''); const [apiKey, setApiKey] = useState(() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').apiKey || '' } catch { return '' } }); const generate = async () => { if (!apiKey) { setResult('Configure sua chave do Gemini primeiro.'); return } setResult('Gerando...'); try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); const d = await r.json(); setResult(d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || 'Sem resposta.') } catch { setResult('Não foi possível conectar à IA.') } }; return <div className="page narrow fade-in"><PageTitle title="Ferramentas IA" subtitle="Use IA somente quando quiser. O editor principal não depende dela." /><div className="form-card"><div className="feature-card purple-card"><Sparkles size={22} /><strong>Assistente de criação</strong><span>Roteiros, ideias, títulos, descrições e outros textos.</span></div><label>Chave Gemini<input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey: e.target.value })) }} placeholder="Sua API key" /></label><label>Prompt<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: Crie 5 ideias de Reels sobre marketing imobiliário." /></label><button className="primary-btn" onClick={generate}><Sparkles size={17} /> Gerar</button>{result && <div className="ai-result">{result}</div>}</div></div> }

function SettingsPage() { const [apiKey, setApiKey] = useState(() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').apiKey || '' } catch { return '' } }); const [saved, setSaved] = useState(false); const save = () => { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ apiKey })); setSaved(true); setTimeout(() => setSaved(false), 1800) }; return <div className="page narrow fade-in"><PageTitle title="Configurações" subtitle="Preferências do seu estúdio pessoal." /><div className="form-card"><div className="feature-card"><Settings size={20} /><strong>Armazenamento local</strong><span>Projetos e preferências são gravados neste navegador.</span></div><label>Chave do Gemini (opcional)<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Somente se quiser usar IA" /></label><div className="two-cols"><div className="property-card"><span>Tema</span><strong>Escuro</strong></div><div className="property-card"><span>Idioma</span><strong>Português</strong></div></div><button className="primary-btn" onClick={save}><Settings size={17} /> {saved ? 'Salvo!' : 'Salvar configurações'}</button></div></div> }

function App() { return <BrowserRouter><Routes><Route path="*" element={<AppRouter />} /></Routes></BrowserRouter> }
function AppRouter() { const location = useLocation(); const isEditor = location.pathname.startsWith('/editor/'); return isEditor ? <Routes><Route path="/editor/:id" element={<EditorPage />} /></Routes> : <AppShell><Routes><Route path="/" element={<HomePage />} /><Route path="/projetos" element={<ProjectsPage />} /><Route path="/novo-projeto" element={<NewProjectPage />} /><Route path="/ia" element={<IAPage />} /><Route path="/configuracoes" element={<SettingsPage />} /><Route path="*" element={<HomePage />} /></Routes></AppShell> }

export default App
