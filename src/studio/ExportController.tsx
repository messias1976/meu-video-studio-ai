import { useEffect, useMemo, useState } from 'react'
import { Download, Film, Loader2, Video, X } from 'lucide-react'
import type { Clip, MediaAsset } from '../editor/types'
import { useEditorStore } from '../editor/store'

const fmt=(n:number)=>{const v=Math.max(0,n);const m=Math.floor(v/60).toString().padStart(2,'0');const s=Math.floor(v%60).toString().padStart(2,'0');return `${m}:${s}`}

type ExportFormat={id:string;label:string;mime:string;extension:string}

function supportedFormats():ExportFormat[]{
  const list:ExportFormat[]=[]
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) list.push({id:'webm-vp9',label:'WebM • VP9 + Opus',mime:'video/webm;codecs=vp9,opus',extension:'webm'})
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) list.push({id:'webm-vp8',label:'WebM • VP8 + Opus',mime:'video/webm;codecs=vp8,opus',extension:'webm'})
  if (!list.length && typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm')) list.push({id:'webm',label:'WebM',mime:'video/webm',extension:'webm'})
  return list
}

function getContainRect(srcW:number,srcH:number,dstW:number,dstH:number,x:number,y:number,w:number,h:number){
  if (!srcW || !srcH) return {x,y,w,h}
  const scale=Math.min(w/srcW,h/srcH)
  const dw=srcW*scale,dh=srcH*scale
  return {x:x+(w-dw)/2,y:y+(h-dh)/2,w:dw,h:dh}
}

async function waitForMedia(el:HTMLMediaElement){
  if(el.readyState>=2) return
  await new Promise<void>(resolve=>{const done=()=>{el.removeEventListener('loadeddata',done);el.removeEventListener('canplay',done);resolve()};el.addEventListener('loadeddata',done,{once:true});el.addEventListener('canplay',done,{once:true});el.load()})
}

async function renderProject(project:{name:string;fps:number;resolution:{width:number;height:number};clips:Clip[];media:MediaAsset[]},format:ExportFormat,onProgress:(v:number)=>void){
  const width=Math.max(320,project.resolution.width)
  const height=Math.max(320,project.resolution.height)
  const duration=Math.max(0.1,...project.clips.map(c=>c.start+c.duration))
  const visualClips=project.clips.filter(c=>c.track!=='audio')
  const audioClips=project.clips.filter(c=>c.track==='audio')
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')!
  const stream=canvas.captureStream(project.fps)
  const audioCtx=new AudioContext()
  const audioDest=audioCtx.createMediaStreamDestination()
  const elements=new Map<string,HTMLVideoElement|HTMLImageElement>()

  for(const clip of visualClips){
    const asset=project.media.find(a=>a.id===clip.assetId)
    if(!asset?.url) continue
    if(asset.kind==='image'){
      const img=new Image();img.src=asset.url;await new Promise<void>(resolve=>{if(img.complete)resolve();else{img.onload=()=>resolve();img.onerror=()=>resolve()}});elements.set(clip.id,img)
    }else if(asset.kind==='video'){
      const video=document.createElement('video');video.src=asset.url;video.muted=true;video.playsInline=true;video.preload='auto';await waitForMedia(video);elements.set(clip.id,video)
    }
  }

  const audioData=audioClips.map(clip=>{
    const asset=project.media.find(a=>a.id===clip.assetId)
    if(!asset?.url) return null
    const audio=document.createElement('audio');audio.src=asset.url;audio.preload='auto';audio.volume=Math.max(0,Math.min(1,clip.volume));
    const source=audioCtx.createMediaElementSource(audio);const gain=audioCtx.createGain();gain.gain.value=clip.muted?0:1;source.connect(gain);gain.connect(audioDest)
    return {clip,audio}
  }).filter(Boolean) as Array<{clip:Clip;audio:HTMLAudioElement}>
  audioDest.stream.getAudioTracks().forEach(track=>stream.addTrack(track))

  const recorder=new MediaRecorder(stream,{mimeType:format.mime,videoBitsPerSecond:Math.max(2_500_000,width*height*3)})
  const chunks:BlobPart[]=[]
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
  const stopped=new Promise<Blob>(resolve=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:format.mime}))})

  await audioCtx.resume()
  recorder.start(200)
  let startedAt=performance.now()
  let lastTimeline=-1

  await new Promise<void>(resolve=>{
    const frame=async()=>{
      const timeline=Math.min(duration,Math.max(0,(performance.now()-startedAt)/1000))
      if(timeline-lastTimeline>=1/Math.max(10,project.fps)){
        lastTimeline=timeline
        ctx.clearRect(0,0,width,height)
        ctx.fillStyle='#000';ctx.fillRect(0,0,width,height)

        const active=visualClips.filter(c=>timeline>=c.start&&timeline<c.start+c.duration).sort((a,b)=>a.trackIndex-b.trackIndex)
        for(const clip of active){
          const asset=project.media.find(a=>a.id===clip.assetId);const el=elements.get(clip.id);if(!asset||!el) continue
          const px=width*clip.x/100,py=height*clip.y/100,pw=width*clip.width/100,ph=height*clip.height/100
          ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,clip.opacity));ctx.translate(px,py);ctx.rotate(clip.rotation*Math.PI/180);if(clip.flipX)ctx.scale(-1,1)
          const srcW=(el as HTMLVideoElement).videoWidth||(el as HTMLImageElement).naturalWidth||width;const srcH=(el as HTMLVideoElement).videoHeight||(el as HTMLImageElement).naturalHeight||height
          const r=getContainRect(srcW,srcH,pw,ph,-pw/2,-ph/2,pw,ph)
          if(el instanceof HTMLVideoElement){const target=Math.max(0,timeline-clip.start);try{if(Math.abs(el.currentTime-target)>0.08)el.currentTime=target;if(el.paused)void el.play().catch(()=>undefined);ctx.drawImage(el,r.x,r.y,r.w,r.h)}catch{}}
          else ctx.drawImage(el,r.x,r.y,r.w,r.h)
          ctx.restore()
        }

        for(const item of audioData){
          const local=timeline-item.clip.start
          if(local>=0&&local<item.clip.duration){try{if(Math.abs(item.audio.currentTime-local)>0.1)item.audio.currentTime=local;if(item.clip.muted||item.clip.volume<=0)item.audio.pause();else if(item.audio.paused)void item.audio.play().catch(()=>undefined)}catch{}}
          else item.audio.pause()
        }
        onProgress(Math.round((timeline/duration)*100))
      }
      if(timeline>=duration){resolve();return}
      requestAnimationFrame(()=>void frame())
    }
    void frame()
  })

  visualClips.forEach(c=>{const el=elements.get(c.id);if(el instanceof HTMLVideoElement)el.pause()})
  audioData.forEach(a=>a.audio.pause())
  recorder.stop()
  const blob=await stopped
  stream.getTracks().forEach(t=>t.stop())
  await audioCtx.close()
  return blob
}

export default function ExportController(){
  const project=useEditorStore(s=>s.project)
  const formats=useMemo(()=>supportedFormats(),[])
  const[open,setOpen]=useState(false)
  const[formatId,setFormatId]=useState(formats[0]?.id??'')
  const[progress,setProgress]=useState(0)
  const[status,setStatus]=useState('Pronto para renderizar')
  const[rendering,setRendering]=useState(false)

  useEffect(()=>{
    const click=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null
      const button=target?.closest('.fx-export') as HTMLElement|null
      if(!button)return
      event.preventDefault();event.stopImmediatePropagation();setOpen(true);setStatus('Pronto para renderizar');setProgress(0)
    }
    document.addEventListener('click',click,true)
    return()=>document.removeEventListener('click',click,true)
  },[])

  const selected=formats.find(f=>f.id===formatId)??formats[0]
  const start=async()=>{
    if(!selected||rendering)return
    setRendering(true);setProgress(0);setStatus('Preparando mídias...')
    try{
      const blob=await renderProject(project,selected,setProgress)
      setStatus('Renderização concluída. Salvando arquivo...')
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[\\/:*?"<>|]/g,'_')}.${selected.extension}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000)
      setProgress(100);setStatus('Vídeo exportado com sucesso.')
    }catch(error){console.error(error);setStatus(`Falha na renderização: ${error instanceof Error?error.message:'erro desconhecido'}`)}finally{setRendering(false)}
  }

  if(!open)return null
  const duration=Math.max(0,...project.clips.map(c=>c.start+c.duration))
  return <div className="fx-modal-backdrop" onClick={()=>{if(!rendering)setOpen(false)}}><div className="fx-modal fx-export-render-modal" onClick={e=>e.stopPropagation()}>
    <div className="fx-modal-head"><div><small>EXPORTAÇÃO</small><h2>Renderizar vídeo</h2></div><button onClick={()=>{if(!rendering)setOpen(false)}} disabled={rendering}><X size={18}/></button></div>
    <div className="fx-export-card"><Film size={22}/><div><strong>{project.resolution.width} × {project.resolution.height} • {project.fps} FPS</strong><span>Duração da composição: {fmt(duration)}</span></div></div>
    <label className="fx-field"><span>Formato</span><select value={formatId} onChange={e=>setFormatId(e.target.value)} disabled={rendering}>{formats.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
    {!formats.length&&<div className="fx-export-error">Este WebView não oferece um codec de vídeo para exportação.</div>}
    <div className="fx-render-status"><div><span>{status}</span><b>{progress}%</b></div><div className="fx-render-bar"><i style={{width:`${progress}%`}}/></div></div>
    <div className="fx-modal-actions"><button className="fx-modal-close" onClick={()=>{if(!rendering)setOpen(false)}} disabled={rendering}>Fechar</button><button className="fx-export" onClick={()=>void start()} disabled={rendering||!selected}>{rendering?<><Loader2 size={15} className="spin"/> Renderizando…</>:<><Video size={15}/> Renderizar e salvar</>}</button></div>
  </div></div>
}