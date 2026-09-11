import { create } from 'zustand'
import type { Clip, MediaAsset, MediaKind, Project } from './types'

type Snapshot = { project: Project }
type EditorState = {
  project: Project
  selectedClipId: string | null
  history: Snapshot[]
  future: Snapshot[]
  canUndo: boolean
  canRedo: boolean
  importMedia: (file: File, kind: MediaKind) => Promise<MediaAsset>
  addClip: (assetId: string) => void
  updateClip: (id: string, patch: Partial<Clip>) => void
  setClipTiming: (id: string, start: number, duration: number) => void
  selectClip: (id: string | null) => void
  deleteClip: (id: string) => void
  deleteMedia: (assetId: string) => void
  duplicateClip: (id: string) => void
  setProjectName: (name: string) => void
  setProjectSettings: (resolution: { width: number; height: number }, fps: number) => void
  undo: () => void
  redo: () => void
  setPlaying: (v: boolean) => void
  setPlayhead: (v: number) => void
}

const STORAGE = 'meu-video-studio-ai:desktop-project:v1'
const fresh = (): Project => ({ id: crypto.randomUUID(), name: 'Projeto sem título', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fps: 30, resolution: { width: 1920, height: 1080 }, playhead: 0, isPlaying: false, media: [], clips: [] })

function normalizeProject(value: unknown): Project {
  const base = fresh(); if (!value || typeof value !== 'object') return base
  const raw = value as Partial<Project>
  return { ...base, ...raw,
    id: typeof raw.id === 'string' ? raw.id : base.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : base.name,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
    fps: Number.isFinite(raw.fps) ? Number(raw.fps) : base.fps,
    resolution: raw.resolution && Number.isFinite(raw.resolution.width) && Number.isFinite(raw.resolution.height) ? { width: Number(raw.resolution.width), height: Number(raw.resolution.height) } : base.resolution,
    playhead: Number.isFinite(raw.playhead) ? Math.max(0, Number(raw.playhead)) : 0,
    isPlaying: Boolean(raw.isPlaying),
    media: Array.isArray(raw.media) ? raw.media.filter(Boolean) as MediaAsset[] : [],
    clips: Array.isArray(raw.clips) ? raw.clips.filter(Boolean).map((clip) => {
      const c = clip as Partial<Clip>
      const legacyX = Number.isFinite(c.x) ? Number(c.x) : 50
      const legacyY = Number.isFinite(c.y) ? Number(c.y) : 50
      return { ...c, id: typeof c.id === 'string' ? c.id : crypto.randomUUID(), assetId: typeof c.assetId === 'string' ? c.assetId : '', name: typeof c.name === 'string' ? c.name : 'Clipe', track: c.track === 'audio' ? 'audio' : 'video', trackIndex: Number.isFinite(c.trackIndex) ? Number(c.trackIndex) : 0, start: Number.isFinite(c.start) ? Math.max(0, Number(c.start)) : 0, duration: Number.isFinite(c.duration) ? Math.max(0.01, Number(c.duration)) : 1, x: legacyX === 0 ? 50 : legacyX, y: legacyY === 0 ? 50 : legacyY, width: Number.isFinite(c.width) ? Math.max(1, Math.min(200, Number(c.width))) : 100, height: Number.isFinite(c.height) ? Math.max(1, Math.min(200, Number(c.height))) : 100, rotation: Number.isFinite(c.rotation) ? Number(c.rotation) : 0, opacity: Number.isFinite(c.opacity) ? Math.max(0, Math.min(1, Number(c.opacity))) : 1, flipX: Boolean(c.flipX), muted: Boolean(c.muted), volume: Number.isFinite(c.volume) ? Math.max(0, Math.min(1, Number(c.volume))) : 1 } as Clip
    }) : [],
  }
}

function load(): Project { try { const raw = localStorage.getItem(STORAGE); return raw ? normalizeProject(JSON.parse(raw)) : fresh() } catch { return fresh() } }
let current = load()
function persist(p: Project) { current = p; localStorage.setItem(STORAGE, JSON.stringify(p)) }
function durationOf(file: File): Promise<number> { return new Promise(resolve => { if (file.type.startsWith('video/')) { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { resolve(Number.isFinite(v.duration) ? v.duration : 5); URL.revokeObjectURL(v.src) }; v.onerror = () => resolve(5); v.src = URL.createObjectURL(file) } else if (file.type.startsWith('audio/')) { const a = document.createElement('audio'); a.preload = 'metadata'; a.onloadedmetadata = () => { resolve(Number.isFinite(a.duration) ? a.duration : 5); URL.revokeObjectURL(a.src) }; a.onerror = () => resolve(5); a.src = URL.createObjectURL(file) } else resolve(5) }) }
function snapshot(): Snapshot { return { project: structuredClone(current) } }

export const useEditorStore = create<EditorState>((set) => ({
  project: current, selectedClipId: null, history: [], future: [], canUndo: false, canRedo: false,
  importMedia: async (file, kind) => { const asset: MediaAsset = { id: crypto.randomUUID(), name: file.name, kind, url: URL.createObjectURL(file), size: file.size, duration: await durationOf(file) }; const p = { ...current, media: [...current.media, asset], updatedAt: new Date().toISOString() }; persist(p); set({ project: p }); return asset },
  addClip: assetId => { const a = current.media.find(m => m.id === assetId); if (!a) return; const isAudio = a.kind === 'audio'; const same = current.clips.filter(c => c.track === (isAudio ? 'audio' : 'video')); const start = same.length ? Math.max(...same.map(c => c.start + c.duration)) + 0.2 : 0; const initialDuration = a.kind === 'image' ? 6 : Math.max(.05, a.duration); const c: Clip = { id: crypto.randomUUID(), assetId, name: a.name, track: isAudio ? 'audio' : 'video', trackIndex: isAudio ? 3 : same.length % 3, start, duration: initialDuration, x: 50, y: 50, width: 100, height: 100, rotation: 0, opacity: 1, flipX: false, muted: !isAudio, volume: 1 }; const p = { ...current, clips: [...current.clips, c], updatedAt: new Date().toISOString() }; persist(p); set({ project: p, selectedClipId: c.id }) },
  updateClip: (id, patch) => set(s => { const before = snapshot(); const p = { ...current, clips: current.clips.map(c => c.id === id ? { ...c, ...patch, start: Math.max(0, Number(patch.start ?? c.start)), duration: Math.max(.05, Number(patch.duration ?? c.duration)), width: Math.max(1, Math.min(200, Number(patch.width ?? c.width))), height: Math.max(1, Math.min(200, Number(patch.height ?? c.height))) } : c), updatedAt: new Date().toISOString() }; persist(p); return { ...s, project: p, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  setClipTiming: (id, start, duration) => set(s => { const clip = current.clips.find(c => c.id === id); if (!clip) return s; const asset = current.media.find(m => m.id === clip.assetId); const maxDuration = asset?.kind === 'image' ? 60 : Math.max(.05, asset?.duration ?? duration); const safeStart = Math.max(0, Number(start) || 0); const safeDuration = Math.max(.05, Math.min(maxDuration, Number(duration) || .05)); const before = snapshot(); const p = { ...current, clips: current.clips.map(c => c.id === id ? { ...c, start: safeStart, duration: safeDuration } : c), updatedAt: new Date().toISOString() }; persist(p); return { ...s, project: p, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  selectClip: id => set({ selectedClipId: id }),
  deleteClip: id => set(s => { const before = snapshot(); const p = { ...current, clips: current.clips.filter(c => c.id !== id), updatedAt: new Date().toISOString() }; persist(p); return { ...s, project: p, selectedClipId: s.selectedClipId === id ? null : s.selectedClipId, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  deleteMedia: assetId => set(s => { if (!current.media.some(m => m.id === assetId)) return s; const before = snapshot(); const p = { ...current, media: current.media.filter(m => m.id !== assetId), clips: current.clips.filter(c => c.assetId !== assetId), updatedAt: new Date().toISOString() }; persist(p); return { ...s, project: p, selectedClipId: p.clips.some(c => c.id === s.selectedClipId) ? s.selectedClipId : null, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  duplicateClip: id => set(s => { const source = current.clips.find(c => c.id === id); if (!source) return s; const before = snapshot(); const c: Clip = { ...source, id: crypto.randomUUID(), start: source.start + source.duration + 0.05, name: `${source.name} cópia` }; const p = { ...current, clips: [...current.clips, c], updatedAt: new Date().toISOString() }; persist(p); return { project: p, selectedClipId: c.id, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  setProjectName: name => set(s => { const clean = name.trim() || 'Projeto sem título'; if (clean === current.name) return s; const before = snapshot(); const p = { ...current, name: clean, updatedAt: new Date().toISOString() }; persist(p); return { ...s, project: p, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  setProjectSettings: (resolution, fps) => set(s => { const width = Math.round(Math.max(320, Math.min(7680, resolution.width || 1920))); const height = Math.round(Math.max(320, Math.min(7680, resolution.height || 1080))); const safeFps = [24, 25, 30, 50, 60].includes(fps) ? fps : 30; if (current.resolution.width === width && current.resolution.height === height && current.fps === safeFps) return s; const before = snapshot(); const p = { ...current, resolution: { width, height }, fps: safeFps, updatedAt: new Date().toISOString() }; persist(p); return { ...s, project: p, history: [...s.history, before], future: [], canUndo: true, canRedo: false } }),
  undo: () => set(s => { const prev = s.history.at(-1); if (!prev) return s; const future = [{ project: structuredClone(current) }, ...s.future]; const history = s.history.slice(0, -1); persist(prev.project); return { ...s, project: prev.project, history, future, canUndo: history.length > 0, canRedo: true } }),
  redo: () => set(s => { const next = s.future[0]; if (!next) return s; const history = [...s.history, { project: structuredClone(current) }]; const future = s.future.slice(1); persist(next.project); return { ...s, project: next.project, history, future, canUndo: true, canRedo: future.length > 0 } }),
  setPlaying: v => set(s => ({ project: { ...s.project, isPlaying: v } })),
  setPlayhead: v => set(s => ({ project: { ...s.project, playhead: Math.max(0, v) } })),
}))
