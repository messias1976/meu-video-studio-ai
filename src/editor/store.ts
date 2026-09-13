import { create } from 'zustand'
import type { Clip, EditorTrack, MediaAsset, MediaKind, Project } from './types'

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
  splitClip: (id: string, atTime?: number) => void
  setClipTrack: (id: string, trackIndex: number) => void
  addTrack: (type: 'video' | 'audio', name?: string) => void
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
const baseTracks = (): EditorTrack[] => [
  { id: crypto.randomUUID(), name: 'Vídeo 1', type: 'video', muted: false, locked: false },
  { id: crypto.randomUUID(), name: 'Vídeo 2', type: 'video', muted: false, locked: false },
  { id: crypto.randomUUID(), name: 'Texto', type: 'video', muted: false, locked: false },
  { id: crypto.randomUUID(), name: 'Áudio', type: 'audio', muted: false, locked: false },
]
const fresh = (): Project => ({ id: crypto.randomUUID(), name: 'Projeto sem título', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fps: 30, resolution: { width: 1920, height: 1080 }, playhead: 0, isPlaying: false, media: [], clips: [], tracks: baseTracks() })

function normalizeProject(value: unknown): Project {
  const base=fresh(); if(!value||typeof value!=='object')return base; const raw=value as Partial<Project>
  const tracks=Array.isArray(raw.tracks)&&raw.tracks.length ? raw.tracks.filter(Boolean).map((t,index)=>{const r=t as Partial<EditorTrack>;return {id:typeof r.id==='string'?r.id:crypto.randomUUID(),name:typeof r.name==='string'&&r.name.trim()?r.name:`${r.type==='audio'?'Áudio':'Vídeo'} ${index+1}`,type:r.type==='audio'?'audio':'video',muted:Boolean(r.muted),locked:Boolean(r.locked)}}) : base.tracks
  return {...base,...raw,id:typeof raw.id==='string'?raw.id:base.id,name:typeof raw.name==='string'&&raw.name.trim()?raw.name:base.name,createdAt:typeof raw.createdAt==='string'?raw.createdAt:base.createdAt,updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:base.updatedAt,fps:Number.isFinite(raw.fps)?Number(raw.fps):base.fps,resolution:raw.resolution&&Number.isFinite(raw.resolution.width)&&Number.isFinite(raw.resolution.height)?{width:Number(raw.resolution.width),height:Number(raw.resolution.height)}:base.resolution,playhead:Number.isFinite(raw.playhead)?Math.max(0,Number(raw.playhead)):0,isPlaying:Boolean(raw.isPlaying),media:Array.isArray(raw.media)?raw.media.filter(Boolean) as MediaAsset[]:[],tracks,clips:Array.isArray(raw.clips)?raw.clips.filter(Boolean).map(clip=>{const c=clip as Partial<Clip>;const legacyX=Number.isFinite(c.x)?Number(c.x):50;const legacyY=Number.isFinite(c.y)?Number(c.y):50;return {...c,id:typeof c.id==='string'?c.id:crypto.randomUUID(),assetId:typeof c.assetId==='string'?c.assetId:'',name:typeof c.name==='string'?c.name:'Clipe',text:typeof c.text==='string'?c.text:undefined,textColor:typeof c.textColor==='string'?c.textColor:'#ffffff',fontSize:Number.isFinite(c.fontSize)?Number(c.fontSize):64,fontFamily:typeof c.fontFamily==='string'?c.fontFamily:'Arial',fontWeight:Number.isFinite(c.fontWeight)?Number(c.fontWeight):700,track:c.track==='audio'?'audio':'video',trackIndex:Number.isFinite(c.trackIndex)?Number(c.trackIndex):0,start:Number.isFinite(c.start)?Math.max(0,Number(c.start)):0,duration:Number.isFinite(c.duration)?Math.max(.01,Number(c.duration)):1,x:legacyX===0?50:legacyX,y:legacyY===0?50:legacyY,width:Number.isFinite(c.width)?Math.max(1,Math.min(200,Number(c.width))):100,height:Number.isFinite(c.height)?Math.max(1,Math.min(200,Number(c.height))):100,rotation:Number.isFinite(c.rotation)?Number(c.rotation):0,opacity:Number.isFinite(c.opacity)?Math.max(0,Math.min(1,Number(c.opacity))):1,flipX:Boolean(c.flipX),muted:Boolean(c.muted),volume:Number.isFinite(c.volume)?Math.max(0,Math.min(1,Number(c.volume))):1} as Clip}):[]}
}
function load(): Project { try { const raw=localStorage.getItem(STORAGE); return raw?normalizeProject(JSON.parse(raw)):fresh() } catch { return fresh() } }
let current=load(); function persist(p:Project){current=p;localStorage.setItem(STORAGE,JSON.stringify(p))}
function durationOf(file:File):Promise<number>{return new Promise(resolve=>{if(file.type.startsWith('video/')){const v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>{resolve(Number.isFinite(v.duration)?v.duration:5);URL.revokeObjectURL(v.src)};v.onerror=()=>resolve(5);v.src=URL.createObjectURL(file)}else if(file.type.startsWith('audio/')){const a=document.createElement('audio');a.preload='metadata';a.onloadedmetadata=()=>{resolve(Number.isFinite(a.duration)?a.duration:5);URL.revokeObjectURL(a.src)};a.onerror=()=>resolve(5);a.src=URL.createObjectURL(file)}else resolve(5)})}
function snapshot():Snapshot{return{project:structuredClone(current)}}
function isTextAsset(asset?:MediaAsset){return Boolean(asset&&asset.kind==='image'&&!asset.url)}
function trackForClip(project:Project,trackIndex:number):EditorTrack|undefined{return project.tracks[trackIndex]}

export const useEditorStore=create<EditorState>((set)=>({
 project:current,selectedClipId:null,history:[],future:[],canUndo:false,canRedo:false,
 importMedia:async(file,kind)=>{const asset:MediaAsset={id:crypto.randomUUID(),name:file.name,kind,url:URL.createObjectURL(file),size:file.size,duration:await durationOf(file)};const p={...current,media:[...current.media,asset],updatedAt:new Date().toISOString()};persist(p);set({project:p});return asset},
 addClip:assetId=>{const base=useEditorStore.getState().project;const asset=base.media.find(m=>m.id===assetId);if(!asset)return;const isAudio=asset.kind==='audio';const isText=isTextAsset(asset);const candidates=base.tracks.map((t,index)=>({t,index})).filter(({t})=>t.type===(isAudio?'audio':'video')&&!t.locked);const textTrack=isText?base.tracks.findIndex(t=>t.name.toLowerCase().includes('texto')&&t.type==='video'&&!t.locked):-1;const trackIndex=textTrack>=0?textTrack:(candidates[0]?.index??0);const same=base.clips.filter(c=>c.trackIndex===trackIndex);const start=same.length?Math.max(...same.map(c=>c.start+c.duration))+.1:0;const initialDuration=asset.kind==='image'?6:Math.max(.05,asset.duration);const c:Clip={id:crypto.randomUUID(),assetId,name:asset.name,text:isText?(asset.name||'Título'):undefined,textColor:'#ffffff',fontSize:isText?64:64,fontFamily:'Arial',fontWeight:700,track:isAudio?'audio':'video',trackIndex,start,duration:initialDuration,x:50,y:50,width:isText?60:100,height:isText?30:100,rotation:0,opacity:1,flipX:false,muted:false,volume:1};const p={...base,clips:[...base.clips,c],updatedAt:new Date().toISOString()};persist(p);set({project:p,selectedClipId:c.id})},
 updateClip:(id,patch)=>set(s=>{const before=snapshot();const p={...current,clips:current.clips.map(c=>c.id===id?{...c,...patch,start:Math.max(0,Number(patch.start??c.start)),duration:Math.max(.05,Number(patch.duration??c.duration)),x:Math.max(-100,Math.min(200,Number(patch.x??c.x))),y:Math.max(-100,Math.min(200,Number(patch.y??c.y))),width:Math.max(1,Math.min(200,Number(patch.width??c.width))),height:Math.max(1,Math.min(200,Number(patch.height??c.height))),rotation:Number(patch.rotation??c.rotation),opacity:Math.max(0,Math.min(1,Number(patch.opacity??c.opacity))),fontSize:Math.max(8,Math.min(500,Number(patch.fontSize??c.fontSize??64))),fontWeight:Math.max(100,Math.min(900,Number(patch.fontWeight??c.fontWeight??700)))}:c),updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 setClipTiming:(id,start,duration)=>set(s=>{const clip=current.clips.find(c=>c.id===id);if(!clip)return s;const asset=current.media.find(m=>m.id===clip.assetId);const maxDuration=asset?.kind==='image'?60:Math.max(.05,asset?.duration??duration);const safeStart=Math.max(0,Number(start)||0);const safeDuration=Math.max(.05,Math.min(maxDuration,Number(duration)||.05));const before=snapshot();const p={...current,clips:current.clips.map(c=>c.id===id?{...c,start:safeStart,duration:safeDuration}:c),updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 splitClip:(id,atTime)=>set(s=>{const clip=current.clips.find(c=>c.id===id);if(!clip)return s;const splitAt=atTime??current.playhead;if(splitAt<=clip.start+.05||splitAt>=clip.start+clip.duration-.05)return s;const leftDuration=splitAt-clip.start;const right:Clip={...clip,id:crypto.randomUUID(),start:splitAt,duration:clip.duration-leftDuration,name:`${clip.name} 2`};const before=snapshot();const p={...current,clips:current.clips.map(c=>c.id===id?{...c,duration:leftDuration}:c).concat(right),updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,selectedClipId:right.id,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 setClipTrack:(id,trackIndex)=>set(s=>{const target=trackForClip(current,trackIndex);const clip=current.clips.find(c=>c.id===id);if(!target||target.locked||!clip||target.type!==clip.track||clip.trackIndex===trackIndex)return s;const before=snapshot();const p={...current,clips:current.clips.map(c=>c.id===id?{...c,trackIndex}:c),updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 addTrack:(type,name)=>set(s=>{const index=current.tracks.filter(t=>t.type===type).length+1;const before=snapshot();const track:EditorTrack={id:crypto.randomUUID(),name:name?.trim()||`${type==='audio'?'Áudio':'Vídeo'} ${index}`,type,muted:false,locked:false};const p={...current,tracks:[...current.tracks,track],updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 selectClip:id=>set({selectedClipId:id}),
 deleteClip:id=>set(s=>{const before=snapshot();const p={...current,clips:current.clips.filter(c=>c.id!==id),updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,selectedClipId:s.selectedClipId===id?null:s.selectedClipId,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 deleteMedia:assetId=>set(s=>{if(!current.media.some(m=>m.id===assetId))return s;const before=snapshot();const p={...current,media:current.media.filter(m=>m.id!==assetId),clips:current.clips.filter(c=>c.assetId!==assetId),updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,selectedClipId:p.clips.some(c=>c.id===s.selectedClipId)?s.selectedClipId:null,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 duplicateClip:id=>set(s=>{const source=current.clips.find(c=>c.id===id);if(!source)return s;const before=snapshot();const c:Clip={...source,id:crypto.randomUUID(),start:source.start+source.duration+.05,name:`${source.name} cópia`};const p={...current,clips:[...current.clips,c],updatedAt:new Date().toISOString()};persist(p);return{project:p,selectedClipId:c.id,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 setProjectName:name=>set(s=>{const clean=name.trim()||'Projeto sem título';if(clean===current.name)return s;const before=snapshot();const p={...current,name:clean,updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 setProjectSettings:(resolution,fps)=>set(s=>{const width=Math.round(Math.max(320,Math.min(7680,resolution.width||1920)));const height=Math.round(Math.max(320,Math.min(7680,resolution.height||1080)));const safeFps=[24,25,30,50,60].includes(fps)?fps:30;if(current.resolution.width===width&&current.resolution.height===height&&current.fps===safeFps)return s;const before=snapshot();const p={...current,resolution:{width,height},fps:safeFps,updatedAt:new Date().toISOString()};persist(p);return{...s,project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 undo:()=>set(s=>{const prev=s.history.at(-1);if(!prev)return s;const future=[{project:structuredClone(current)},...s.future];const history=s.history.slice(0,-1);persist(prev.project);return{...s,project:prev.project,history,future,canUndo:history.length>0,canRedo:true}}),
 redo:()=>set(s=>{const next=s.future[0];if(!next)return s;const history=[...s.history,{project:structuredClone(current)}];const future=s.future.slice(1);persist(next.project);return{...s,project:next.project,history,future,canUndo:true,canRedo:future.length>0}}),
 setPlaying:v=>set(s=>({project:{...s.project,isPlaying:v}})),
 setPlayhead:v=>set(s=>{const end=s.project.clips.reduce((max,clip)=>Math.max(max,clip.start+clip.duration),0);const safe=Math.max(0,Number(v)||0);const clamped=end>0?Math.min(safe,end):safe;const reachedEnd=end>0&&safe>=end;return{...s,project:{...s.project,playhead:clamped,isPlaying:reachedEnd?false:s.project.isPlaying}}}),
}))
