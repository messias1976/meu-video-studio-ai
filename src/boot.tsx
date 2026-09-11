import React from 'react'
import { createRoot } from 'react-dom/client'
import StudioApp from './studio/StudioAppFinal'
import ProjectSettings from './studio/ProjectSettings'
import './studio/final-overrides.css'
import './studio/window-fit.css'
import './studio/media-delete-visible.css'
import './studio/media-actions'
import './studio/media-preview-fix.css'
import './studio/preview-resize'

class RuntimeErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return <div style={{minHeight:'100vh',padding:32,background:'#0a0c11',color:'#fff',fontFamily:'system-ui'}}><h1>Meu Video Studio — erro ao iniciar</h1><p style={{color:'#b7bdc9'}}>O editor encontrou um erro durante a inicialização.</p><pre style={{whiteSpace:'pre-wrap',background:'#11151d',border:'1px solid #292f3b',borderRadius:10,padding:16,color:'#ffb4b4'}}>{this.state.error.message}\n\n{this.state.error.stack ?? ''}</pre><button style={{marginTop:16,padding:'10px 14px',borderRadius:8,border:0,background:'#7356ea',color:'#fff',cursor:'pointer'}} onClick={()=>{localStorage.removeItem('meu-video-studio-ai:desktop-project:v1');location.reload()}}>Limpar projeto local e reiniciar</button></div>
    return this.props.children
  }
}
const root=document.getElementById('root')
if(!root) throw new Error('Elemento #root não encontrado')
createRoot(root).render(<React.StrictMode><RuntimeErrorBoundary><><StudioApp/><ProjectSettings/></></RuntimeErrorBoundary></React.StrictMode>)
