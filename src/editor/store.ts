import { create } from 'zustand'
import type { Clip, MediaAsset, MediaKind, Project } from './types'

type Snapshot = { project: Project }
type EditorState = { project: Project; selectedClipId:string|null; history:Snapshot[]; future:Snapshot[]; canUndo:boolean; canRedo:boolean; importMedia:(file:File,kind:MediaKind)=>Promise<MediaAsset>; addClip:(assetId:string)=>void; updateClip:(id:string,patch:Partial<Clip>)=>void; selectClip:(id:string|null)=>void; deleteClip:(id:string)=>void; duplicateClip:(id:string)=>void; undo:()=>void; redo:()=>void; setPlaying:(v:boolean)=>void; setPlayhead:(v:number)=>void }
const STORAGE='meu-video-studio-ai:desktop-project:v1'
const fresh=():Project=>({id:crypto.randomUUID(),name:'Projeto sem título',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),fps:30,resolution:{width:1920,height:1080},playhead:0,isPlaying:false,media:[],clips:[]})
function load():Project{try{const raw=localStorage.getItem(STORAGE);return raw?JSON.parse(raw):fresh()}catch{return fresh()}}
let current=load()
function persist(p:Project){current=p;localStorage.setItem(STORAGE,JSON.stringify(p))}
function durationOf(file:File):Promise<number>{return new Promise(resolve=>{if(file.type.startsWith('video/')){const v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>{resolve(Number.isFinite(v.duration)?v.duration:5);URL.revokeObjectURL(v.src)};v.onerror=()=>resolve(5);v.src=URL.createObjectURL(file)}else if(file.type.startsWith('audio/')){const a=document.createElement('audio');a.preload='metadata';a.onloadedmetadata=()=>{resolve(Number.isFinite(a.duration)?a.duration:5);URL.revokeObjectURL(a.src)};a.onerror=()=>resolve(5);a.src=URL.createObjectURL(file)}else resolve(5)})}
function snapshot():Snapshot{return {project:structuredClone(current)}}
export const useEditorStore=create<EditorState>((set)=>({project:current,selectedClipId:null,history:[],future:[],canUndo:false,canRedo:false,
 importMedia:async(file,kind)=>{const asset:MediaAsset={id:crypto.randomUUID(),name:file.name,kind,url:URL.createObjectURL(file),size:file.size,duration:await durationOf(file)};const p={...current,media:[...current.media,asset],updatedAt:new Date().toISOString()};persist(p);set({project:p});return asset},
 addClip:assetId=>{const a=current.media.find(m=>m.id===assetId);if(!a)return;const isAudio=a.kind==='audio';const same=current.clips.filter(c=>c.track===(isAudio?'audio':'video'));const start=same.length?Math.max(...same.map(c=>c.start+c.duration))+0.2:0;const c:Clip={id:crypto.randomUUID(),assetId,name:a.name,track:isAudio?'audio':'video',trackIndex:isAudio?3:same.length%3,start,duration:Math.max(.5,a.duration),x:0,y:0,width:100,height:100,rotation:0,opacity:1,flipX:false,muted:isAudio?false:true,volume:1};const p={...current,clips:[...current.clips,c],updatedAt:new Date().toISOString()};persist(p);set({project:p,selectedClipId:c.id})},
 updateClip:(id,patch)=>set(s=>{const before=snapshot();const p={...current,clips:current.clips.map(c=>c.id===id?{...c,...patch,width:Math.max(0,Math.min(200,Number(patch.width??c.width))),height:Math.max(0,Math.min(200,Number(patch.height??c.height)))}:c),updatedAt:new Date().toISOString()};persist(p);return{project:p,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 selectClip:id=>set({selectedClipId:id}),
 deleteClip:id=>set(s=>{const before=snapshot();const p={...current,clips:current.clips.filter(c=>c.id!==id),updatedAt:new Date().toISOString()};persist(p);return{project:p,selectedClipId:s.selectedClipId===id?null:s.selectedClipId,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 duplicateClip:id=>set(s=>{const source=current.clips.find(c=>c.id===id);if(!source)return s;const before=snapshot();const c={...source,id:crypto.randomUUID(),start:source.start+source.duration+0.05,name:`${source.name} cópia`};const p={...current,clips:[...current.clips,c],updatedAt:new Date().toISOString()};persist(p);return{project:p,selectedClipId:c.id,history:[...s.history,before],future:[],canUndo:true,canRedo:false}}),
 undo:()=>set(s=>{const prev=s.history.at(-1);if(!prev)return s;const future=[{project:structuredClone(current)},...s.future];const history=s.history.slice(0,-1);persist(prev.project);return{...s,project:prev.project,history,future,canUndo:history.length>0,canRedo:true}}),
 redo:()=>set(s=>{const next=s.future[0];if(!next)return s;const history=[...s.history,{project:structuredClone(current)}];const future=s.future.slice(1);persist(next.project);return{...s,project:next.project,history,future,canUndo:true,canRedo:future.length>0}}),
 setPlaying:v=>set(s=>({project:{...s.project,isPlaying:v}})),
 setPlayhead:v=>set(s=>({project:{...s.project,playhead:v}})),
}))
