const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'

type Media = { id:string; name:string; kind:'video'|'image'|'audio'; url:string; duration:number }
type Clip = { id:string; assetId:string; start:number; duration:number; track:'video'|'audio'; lane?:number; x?:number; y?:number; width?:number; height?:number; rotation?:number; flipX?:boolean }
type Project = { id:string; media:Media[]; clips:Clip[]; playhead:number }

type Transform = { x:number; y:number; width:number; height:number; rotation:number; flipX:boolean }

const MAX_SIZE = 200
const MIN_SIZE = 1
const CSS = `
.vfs-layer-compositor{position:absolute!important;inset:0!important;overflow:hidden!important;z-index:50!important;pointer-events:none!important}
.vfs-layer{position:absolute;box-sizing:border-box;overflow:visible;pointer-events:auto;cursor:move;user-select:none;touch-action:none;transform-origin:center center}
.vfs-layer img,.vfs-layer video{display:block!important;width:100%!important;height:100%!important;object-fit:fill!important;pointer-events:none!important}
.vfs-layer.vfs-selected{outline:2px solid #a78bfa;box-shadow:0 0 0 1px rgba(167,139,250,.25),0 0 22px rgba(124,58,237,.18)}
.vfs-handle{position:absolute;width:11px;height:11px;border:2px solid #fff;background:#7c3aed;border-radius:3px;z-index:3;box-shadow:0 1px 4px #000;pointer-events:auto}
.vfs-handle.nw{left:-6px;top:-6px;cursor:nwse-resize}.vfs-handle.n{left:50%;top:-6px;transform:translateX(-50%);cursor:ns-resize}.vfs-handle.ne{right:-6px;top:-6px;cursor:nesw-resize}.vfs-handle.e{right:-6px;top:50%;transform:translateY(-50%);cursor:ew-resize}.vfs-handle.se{right:-6px;bottom:-6px;cursor:nwse-resize}.vfs-handle.s{left:50%;bottom:-6px;transform:translateX(-50%);cursor:ns-resize}.vfs-handle.sw{left:-6px;bottom:-6px;cursor:nesw-resize}.vfs-handle.w{left:-6px;top:50%;transform:translateY(-50%);cursor:ew-resize}
.vfs-layer-badge{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.7);color:#fff;padding:3px 6px;border-radius:5px;font:600 9px/1 Inter,system-ui,sans-serif;z-index:4;pointer-events:none}
.vfs-layer-controls{position:fixed;right:18px;top:88px;width:260px;background:rgba(16,16,20,.97);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;z-index:99999;color:#fff;font:12px Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.45)}
.vfs-layer-controls h4{margin:0 0 8px;font-size:12px}.vfs-layer-controls .vfs-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.vfs-layer-controls label{display:grid;gap:4px;font-size:9px;color:#90909a}.vfs-layer-controls input{width:100%;height:30px;background:#0a0a0d;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:0 8px;outline:0}.vfs-layer-controls input[type=number]{appearance:textfield}.vfs-layer-controls .vfs-row{display:flex;gap:6px;margin-top:8px}.vfs-layer-controls button{flex:1;height:30px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:#17171d;color:#ddd;cursor:pointer}.vfs-layer-controls button:hover{background:#22222a;color:#fff}.vfs-layer-controls .primary{background:#6d28d9;border-color:#8b5cf6}.vfs-layer-controls small{display:block;color:#686873;margin-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vfs-layer-controls .vfs-scale-title{grid-column:1/-1;font-size:10px;color:#bdbdc7;margin-top:2px}.vfs-layer-controls .vfs-range{grid-column:1/-1;display:grid;grid-template-columns:1fr 58px;gap:8px;align-items:center}.vfs-layer-controls .vfs-range input[type=range]{height:22px;padding:0}.vfs-layer-controls .vfs-range output{height:30px;display:grid;place-items:center;background:#0a0a0d;border:1px solid rgba(255,255,255,.1);border-radius:7px;font-size:10px;color:#ddd}
.vfs-layer-hint{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);background:rgba(0,0,0,.68);color:#bfc0ca;padding:5px 8px;border-radius:7px;font:10px Inter,system-ui,sans-serif;z-index:60;pointer-events:none}
`

let styleInjected = false
let selectedClipId: string | null = null
let raf = 0
let activeStage: HTMLElement | null = null
let controlEl: HTMLElement | null = null

function injectCss(){ if(styleInjected) return; const s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); styleInjected=true }
function projectId(){ const m=location.pathname.match(/\/editor\/([^/]+)/); return m?.[1] ?? null }
function readProject(): Project | null { try{const all=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]') as Project[]; const id=projectId(); return all.find(p=>p.id===id)||null}catch{return null} }
function writeProject(project:Project){ try{ const all=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]') as Project[]; const next=all.map(p=>p.id===project.id?project:p); localStorage.setItem(PROJECTS_KEY,JSON.stringify(next)); window.dispatchEvent(new StorageEvent('storage',{key:PROJECTS_KEY,newValue:JSON.stringify(next)})); }catch{} }
function currentTime(p:Project){ return Number(p.playhead||0) }
function activeVideoClips(p:Project,t:number){ return p.clips.filter(c=>c.track==='video' && t>=Number(c.start||0) && t<Number(c.start||0)+Number(c.duration||0)).sort((a,b)=>(a.lane??0)-(b.lane??0)) }
function getTransform(c:Clip,index:number):Transform{
 const w=Number.isFinite(c.width)?clamp(Number(c.width),MIN_SIZE,MAX_SIZE):(index===0?100:55)
 const h=Number.isFinite(c.height)?clamp(Number(c.height),MIN_SIZE,MAX_SIZE):(index===0?100:55)
 return {x:Number.isFinite(c.x)?Number(c.x):0,y:Number.isFinite(c.y)?Number(c.y):0,width:w,height:h,rotation:Number(c.rotation||0),flipX:Boolean(c.flipX)}
}
function updateClip(project:Project,id:string,patch:Partial<Clip>){ project={...project,clips:project.clips.map(c=>c.id===id?{...c,...patch}:c),updatedAt:new Date().toISOString()} as Project; writeProject(project); render(); }
function assetFor(p:Project,id:string){ return p.media.find(m=>m.id===id) }
function stageElement(){ return document.querySelector<HTMLElement>('.video-stage') }
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function pctDelta(dx:number,dy:number,stage:HTMLElement){ return {x:dx/stage.clientWidth*100,y:dy/stage.clientHeight*100} }
function applyTransform(el:HTMLElement,t:Transform){ el.style.left=`${t.x}%`; el.style.top=`${t.y}%`; el.style.width=`${t.width}%`; el.style.height=`${t.height}%`; el.style.transform=`rotate(${t.rotation}deg) scaleX(${t.flipX?-1:1})`; }

function normalizeSize(value:number){ return clamp(Number.isFinite(value)?value:100,MIN_SIZE,MAX_SIZE) }
function normalizePosition(value:number,size:number){ return clamp(Number.isFinite(value)?value:0,-MAX_SIZE,100) }

function ensureControls(){
 if(controlEl) return controlEl
 controlEl=document.createElement('div'); controlEl.className='vfs-layer-controls'; controlEl.style.display='none'; document.body.appendChild(controlEl); return controlEl
}
function renderControls(project:Project,clip:Clip,t:Transform){
 const el=ensureControls(); el.style.display='block';
 el.innerHTML=`<h4>Camada selecionada</h4><small>${assetFor(project,clip.assetId)?.name||'Mídia'}</small><div class="vfs-grid"><label>X (%)<input data-k="x" type="number" min="-200" max="100" step="0.1" value="${t.x.toFixed(1)}"></label><label>Y (%)<input data-k="y" type="number" min="-200" max="100" step="0.1" value="${t.y.toFixed(1)}"></label><label>Largura (%)<input data-k="width" type="number" min="0" max="200" step="0.1" value="${t.width.toFixed(1)}"></label><label>Altura (%)<input data-k="height" type="number" min="0" max="200" step="0.1" value="${t.height.toFixed(1)}"></label><div class="vfs-scale-title">Tamanho rápido · 0–200%</div><div class="vfs-range"><input data-k="widthRange" type="range" min="0" max="200" step="1" value="${t.width}"><output>${Math.round(t.width)}%</output></div><div class="vfs-range"><input data-k="heightRange" type="range" min="0" max="200" step="1" value="${t.height}"><output>${Math.round(t.height)}%</output></div><label>Rotação (°)<input data-k="rotation" type="number" step="1" value="${t.rotation.toFixed(0)}"></label><label>Camada<input data-k="lane" type="number" step="1" min="0" max="20" value="${clip.lane??0}"></label></div><div class="vfs-row"><button data-action="front" class="primary">Trazer para frente</button><button data-action="back">Enviar para trás</button></div><div class="vfs-row"><button data-action="mirror">Espelhar</button><button data-action="reset">Resetar</button></div>`
 el.querySelectorAll<HTMLInputElement>('input[data-k]').forEach(input=>input.addEventListener('input',()=>{
   const key=input.dataset.k!; const value=Number(input.value); const patch:Partial<Clip>={};
   if(key==='lane') patch.lane=clamp(Math.round(value),0,20)
   else if(key==='width') patch.width=normalizeSize(value)
   else if(key==='height') patch.height=normalizeSize(value)
   else if(key==='widthRange'){ patch.width=normalizeSize(value); const out=input.parentElement?.querySelector('output'); if(out) out.textContent=`${Math.round(patch.width)}%` }
   else if(key==='heightRange'){ patch.height=normalizeSize(value); const out=input.parentElement?.querySelector('output'); if(out) out.textContent=`${Math.round(patch.height)}%` }
   else if(key==='x') patch.x=normalizePosition(value,t.width)
   else if(key==='y') patch.y=normalizePosition(value,t.height)
   else if(key==='rotation') patch.rotation=value
   updateClip(project,clip.id,patch)
 }))
 el.querySelector('[data-action="front"]')?.addEventListener('click',()=>updateClip(project,clip.id,{lane:Math.max(...project.clips.filter(c=>c.track==='video').map(c=>c.lane??0),0)+1}))
 el.querySelector('[data-action="back"]')?.addEventListener('click',()=>updateClip(project,clip.id,{lane:0}))
 el.querySelector('[data-action="mirror"]')?.addEventListener('click',()=>updateClip(project,clip.id,{flipX:!t.flipX}))
 el.querySelector('[data-action="reset"]')?.addEventListener('click',()=>updateClip(project,clip.id,{x:0,y:0,width:100,height:100,rotation:0,flipX:false}))
}

function bindLayer(layer:HTMLElement,project:Project,clip:Clip,t:Transform,index:number,stage:HTMLElement){
 layer.addEventListener('pointerdown',(ev)=>{
   const target=ev.target as HTMLElement
   if(target.classList.contains('vfs-handle')) return
   selectedClipId=clip.id; render();
   const startX=ev.clientX,startY=ev.clientY,startT={...getTransform(clip,index)}
   layer.setPointerCapture(ev.pointerId)
   const move=(e:PointerEvent)=>{const d=pctDelta(e.clientX-startX,e.clientY-startY,stage); updateClip(project,clip.id,{x:clamp(startT.x+d.x,-MAX_SIZE,100),y:clamp(startT.y+d.y,-MAX_SIZE,100)})}
   const up=()=>{layer.releasePointerCapture(ev.pointerId);layer.removeEventListener('pointermove',move);layer.removeEventListener('pointerup',up);}
   layer.addEventListener('pointermove',move);layer.addEventListener('pointerup',up)
 })
 layer.querySelectorAll<HTMLElement>('.vfs-handle').forEach(handle=>handle.addEventListener('pointerdown',(ev)=>{
   ev.stopPropagation(); ev.preventDefault(); selectedClipId=clip.id
   const dir=handle.dataset.dir||'se'; const startX=(ev as PointerEvent).clientX,startY=(ev as PointerEvent).clientY,startT={...getTransform(clip,index)}; layer.setPointerCapture((ev as PointerEvent).pointerId)
   const move=(e:PointerEvent)=>{
     const d=pctDelta(e.clientX-startX,e.clientY-startY,stage); let left=startT.x,top=startT.y,right=startT.x+startT.width,bottom=startT.y+startT.height
     if(dir.includes('w')){ left=clamp(startT.x+d.x,-MAX_SIZE,Math.min(right-MIN_SIZE,100)); }
     if(dir.includes('e')){ right=clamp(startT.x+startT.width+d.x,startT.x+MIN_SIZE,MAX_SIZE); }
     if(dir.includes('n')){ top=clamp(startT.y+d.y,-MAX_SIZE,Math.min(bottom-MIN_SIZE,100)); }
     if(dir.includes('s')){ bottom=clamp(startT.y+startT.height+d.y,startT.y+MIN_SIZE,MAX_SIZE); }
     const width=clamp(right-left,MIN_SIZE,MAX_SIZE); const height=clamp(bottom-top,MIN_SIZE,MAX_SIZE)
     updateClip(project,clip.id,{x:clamp(left,-MAX_SIZE,MAX_SIZE),y:clamp(top,-MAX_SIZE,MAX_SIZE),width,height})
   }
   const up=()=>{layer.releasePointerCapture((ev as PointerEvent).pointerId);layer.removeEventListener('pointermove',move);layer.removeEventListener('pointerup',up);}
   layer.addEventListener('pointermove',move);layer.addEventListener('pointerup',up)
 }))
}
function render(){
 const stage=stageElement(); if(!stage) return; activeStage=stage; const p=readProject(); if(!p) return; const t=currentTime(p); injectCss();
 stage.style.position='relative'; stage.style.overflow='hidden';
 let comp=stage.querySelector<HTMLElement>('.vfs-layer-compositor'); if(!comp){comp=document.createElement('div'); comp.className='vfs-layer-compositor'; stage.appendChild(comp)} comp.innerHTML='';
 stage.querySelectorAll(':scope > video, :scope > img').forEach(el=>(el as HTMLElement).style.visibility='hidden')
 const clips=activeVideoClips(p,t)
 clips.forEach((clip,index)=>{
  const asset=assetFor(p,clip.assetId); if(!asset) return; const layer=document.createElement('div'); layer.className='vfs-layer'+(clip.id===selectedClipId?' vfs-selected':''); layer.dataset.clipId=clip.id; const tr=getTransform(clip,index); applyTransform(layer,tr); layer.style.zIndex=String(100+((clip.lane??0)*10)+index)
  const media=asset.kind==='image'?document.createElement('img'):document.createElement('video'); media.src=asset.url; media.draggable=false; if(media instanceof HTMLVideoElement){media.muted=true;media.playsInline=true;media.preload='auto'; const local=Math.max(0,t-clip.start); try{media.currentTime=local}catch{} }
  layer.appendChild(media); const badge=document.createElement('div'); badge.className='vfs-layer-badge'; badge.textContent=`Camada ${(clip.lane??0)+1}`; layer.appendChild(badge)
  ;(['nw','n','ne','e','se','s','sw','w'] as const).forEach(dir=>{const h=document.createElement('div');h.className=`vfs-handle ${dir}`;h.dataset.dir=dir; if(clip.id!==selectedClipId)h.style.display='none';layer.appendChild(h)})
  bindLayer(layer,p,clip,tr,index,stage); comp!.appendChild(layer)
  if(clip.id===selectedClipId) renderControls(p,clip,tr)
 })
 if(selectedClipId && !clips.some(c=>c.id===selectedClipId)){selectedClipId=null;if(controlEl)controlEl.style.display='none'}
 if(clips.length>1 || selectedClipId){let hint=comp.querySelector('.vfs-layer-hint');if(!hint){hint=document.createElement('div');hint.className='vfs-layer-hint';comp.appendChild(hint)}hint.textContent=clips.length>1?'Camadas sobrepostas · tamanho 0–200% · arraste e redimensione cada mídia':'Arraste para mover · use os 8 pontos ou os controles 0–200%'}
}

function tick(){ render(); raf=requestAnimationFrame(tick) }
function boot(){ if(!document.body) return; injectCss(); cancelAnimationFrame(raf); tick(); }

new MutationObserver(()=>{ if(!activeStage && document.querySelector('.video-stage')) boot() }).observe(document.body,{childList:true,subtree:true})
window.addEventListener('popstate',()=>setTimeout(boot,50))
window.addEventListener('storage',()=>render())
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot()
