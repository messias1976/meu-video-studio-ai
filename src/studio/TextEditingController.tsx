import { useEffect } from 'react'
import { useEditorStore } from '../editor/store'

export default function TextEditingController(){
  const project=useEditorStore(s=>s.project)
  const selected=useEditorStore(s=>s.selectedClipId)
  const update=useEditorStore(s=>s.updateClip)
  useEffect(()=>{
    const run=()=>{
      const layers=Array.from(document.querySelectorAll<HTMLElement>('.fx-layer'))
      const active=project.clips.filter(c=>c.track!=='audio'&&project.playhead>=c.start&&project.playhead<c.start+c.duration).sort((a,b)=>b.trackIndex-a.trackIndex)
      layers.forEach((layer,index)=>{
        const clip=active[index]
        const text=layer.querySelector<HTMLElement>('.fx-text-preview')
        if(!clip||!text||clip.id!==selected)return
        if(document.activeElement!==text && text.textContent!==clip.name) text.textContent=clip.name
        text.contentEditable='true'
        text.spellcheck=false
        text.dataset.clipId=clip.id
        text.style.cursor='text'
        text.onpointerdown=e=>e.stopPropagation()
        text.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();text.blur()}}
        text.onblur=()=>{const value=(text.textContent??'').trim();if(value)update(clip.id,{name:value})}
        text.ondblclick=()=>{text.focus();const range=document.createRange();range.selectNodeContents(text);const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(range)}
      })
    }
    const id=window.setTimeout(run,0)
    const observer=new MutationObserver(()=>window.setTimeout(run,0))
    observer.observe(document.body,{childList:true,subtree:true,characterData:true})
    return()=>{window.clearTimeout(id);observer.disconnect()}
  },[project.playhead,project.clips,selected,update])
  return null
}
