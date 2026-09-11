import { useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useEditorStore } from '../editor/store'
import type { Clip } from '../editor/types'

const isText=(c:Clip)=>!!c.text||c.name==='Título'||c.name==='Subtítulo'||c.name.toLowerCase().startsWith('texto')

function TextStylePanel({clip}:{clip:Clip}){
  const update=useEditorStore(s=>s.updateClip)
  const text=clip.text??clip.name
  return <div className="fx-text-style-panel">
    <div className="fx-inspector-subtitle">TEXTO</div>
    <label className="fx-field"><span>Conteúdo</span><div><input value={text} onChange={e=>update(clip.id,{text:e.target.value,name:e.target.value})}/></div></label>
    <div className="fx-two">
      <label className="fx-field"><span>Tamanho</span><div><input type="number" min="8" max="500" value={clip.fontSize??64} onChange={e=>update(clip.id,{fontSize:Math.max(8,Math.min(500,Number(e.target.value)||64))})}/><em>px</em></div></label>
      <label className="fx-field"><span>Peso</span><div><input type="number" min="100" max="900" step="100" value={clip.fontWeight??700} onChange={e=>update(clip.id,{fontWeight:Math.max(100,Math.min(900,Number(e.target.value)||700))})}/></div></label>
    </div>
    <label className="fx-field"><span>Cor</span><div><input type="color" value={clip.textColor??'#ffffff'} onChange={e=>update(clip.id,{textColor:e.target.value})}/><em>{clip.textColor??'#ffffff'}</em></div></label>
    <div className="fx-two">
      <label className="fx-field"><span>X</span><div><input type="number" step="0.1" value={Number(clip.x.toFixed(1))} onChange={e=>update(clip.id,{x:Number(e.target.value)||0})}/><em>%</em></div></label>
      <label className="fx-field"><span>Y</span><div><input type="number" step="0.1" value={Number(clip.y.toFixed(1))} onChange={e=>update(clip.id,{y:Number(e.target.value)||0})}/><em>%</em></div></label>
    </div>
    <div className="fx-two">
      <label className="fx-field"><span>Largura</span><div><input type="number" min="1" max="200" step="0.1" value={Number(clip.width.toFixed(1))} onChange={e=>update(clip.id,{width:Number(e.target.value)||1})}/><em>%</em></div></label>
      <label className="fx-field"><span>Altura</span><div><input type="number" min="1" max="200" step="0.1" value={Number(clip.height.toFixed(1))} onChange={e=>update(clip.id,{height:Number(e.target.value)||1})}/><em>%</em></div></label>
    </div>
  </div>
}

export default function TextStyleController(){
  const project=useEditorStore(s=>s.project)
  const selected=useEditorStore(s=>s.selectedClipId)
  useEffect(()=>{
    let root:Root|undefined
    const mount=()=>{
      const host=document.querySelector<HTMLElement>('.fx-inspector')
      if(!host)return
      const clip=project.clips.find(c=>c.id===selected)
      const textClip=clip&&isText(clip)?clip:null
      let panel=host.querySelector<HTMLElement>('.fx-text-style-mount')
      if(!textClip){panel?.remove();root?.unmount();root=undefined;return}
      if(!panel){panel=document.createElement('section');panel.className='fx-text-style-mount';host.appendChild(panel)}
      if(!root)root=createRoot(panel)
      root.render(<TextStylePanel clip={textClip}/>)
    }
    const id=window.setTimeout(mount,0)
    return()=>{window.clearTimeout(id)}
  },[project,selected])
  return null
}
