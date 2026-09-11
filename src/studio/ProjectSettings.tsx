import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Settings2, X } from 'lucide-react'
import type { Project } from '../editor/types'
import { useEditorStore } from '../editor/store'
import './project-settings.css'

type Preset = { label: string; description: string; width: number; height: number }

const PRESETS: Preset[] = [
  { label: '1920 × 1080', description: 'Full HD • 16:9 • YouTube', width: 1920, height: 1080 },
  { label: '1280 × 720', description: 'HD • 16:9', width: 1280, height: 720 },
  { label: '1080 × 1920', description: 'Full HD vertical • 9:16 • Reels / Shorts', width: 1080, height: 1920 },
  { label: '1080 × 1080', description: 'Quadrado • 1:1 • Social', width: 1080, height: 1080 },
  { label: '1080 × 1350', description: 'Feed vertical • 4:5 • Instagram', width: 1080, height: 1350 },
  { label: '3840 × 2160', description: '4K • 16:9', width: 3840, height: 2160 },
  { label: '2160 × 3840', description: '4K vertical • 9:16', width: 2160, height: 3840 },
]

const FPS = [24, 25, 30, 50, 60]

function ratioOf(width: number, height: number) {
  const r = width / height
  const known = [
    [16 / 9, '16:9'], [9 / 16, '9:16'], [1, '1:1'], [4 / 5, '4:5'], [4 / 3, '4:3'],
  ] as const
  const match = known.find(([value]) => Math.abs(r - value) < 0.01)
  return match?.[1] ?? `${width}:${height}`
}

function readResolution(text: string) {
  const match = text.match(/(\d+)\s*[×x]\s*(\d+)/i)
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

export default function ProjectSettings() {
  const project = useEditorStore(s => s.project)
  const setProjectSettings = useEditorStore(s => s.setProjectSettings)
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(project.resolution.width)
  const [height, setHeight] = useState(project.resolution.height)
  const [fps, setFps] = useState(project.fps)

  useEffect(() => {
    if (!open) return
    setWidth(project.resolution.width)
    setHeight(project.resolution.height)
    setFps(project.fps)
  }, [open, project.resolution.width, project.resolution.height, project.fps])

  useEffect(() => {
    const bind = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.toolbar-pill'))
      const button = buttons.find(b => Boolean(readResolution(b.textContent ?? '')))
      if (!button) return
      button.dataset.projectSettingsBound = 'true'
      button.style.cursor = 'pointer'
      const handler = () => setOpen(true)
      button.addEventListener('click', handler)
      return () => button.removeEventListener('click', handler)
    }

    let cleanup: (() => void) | undefined
    const observer = new MutationObserver(() => {
      cleanup?.()
      cleanup = bind()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    cleanup = bind()
    return () => {
      cleanup?.()
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  const ratio = useMemo(() => ratioOf(width, height), [width, height])
  const selectedPreset = PRESETS.find(p => p.width === width && p.height === height)

  const apply = () => {
    const safeWidth = Math.round(Math.max(320, Math.min(7680, width || 1920)))
    const safeHeight = Math.round(Math.max(320, Math.min(7680, height || 1080)))
    setProjectSettings({ width: safeWidth, height: safeHeight }, fps)
    setOpen(false)
  }

  if (!open) return null

  return <div className="project-settings-backdrop" onMouseDown={() => setOpen(false)}>
    <div className="project-settings-modal" onMouseDown={e => e.stopPropagation()}>
      <div className="project-settings-header">
        <div>
          <span className="project-settings-kicker">CONFIGURAÇÃO DO PROJETO</span>
          <h2>Formato e resolução</h2>
          <p>Defina o tamanho do canvas, proporção e taxa de quadros antes de editar.</p>
        </div>
        <button className="project-settings-close" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18}/></button>
      </div>

      <div className="project-settings-body">
        <section className="project-settings-section">
          <div className="settings-section-title"><Settings2 size={16}/> Presets</div>
          <div className="preset-grid">
            {PRESETS.map(p => <button key={`${p.width}x${p.height}`} className={`preset-card ${selectedPreset === p ? 'selected' : ''}`} onClick={() => { setWidth(p.width); setHeight(p.height) }}>
              <span className="preset-top"><strong>{p.label}</strong>{selectedPreset === p && <Check size={15}/>}</span>
              <small>{p.description}</small>
            </button>)}
          </div>
        </section>

        <section className="project-settings-section settings-two-col">
          <label className="settings-field"><span>Largura</span><input type="number" min="320" max="7680" value={width} onChange={e => setWidth(Number(e.target.value))}/></label>
          <label className="settings-field"><span>Altura</span><input type="number" min="320" max="7680" value={height} onChange={e => setHeight(Number(e.target.value))}/></label>
          <div className="settings-readout"><span>Proporção</span><strong>{ratio}</strong></div>
          <label className="settings-field"><span>FPS</span><div className="settings-select-wrap"><select value={fps} onChange={e => setFps(Number(e.target.value))}>{FPS.map(value => <option key={value} value={value}>{value} FPS</option>)}</select><ChevronDown size={15}/></div></label>
        </section>
      </div>

      <div className="project-settings-footer">
        <span>Canvas atual: <strong>{width} × {height}</strong> • {ratio} • {fps} FPS</span>
        <div className="project-settings-actions"><button className="settings-cancel" onClick={() => setOpen(false)}>Cancelar</button><button className="settings-apply" onClick={apply}>Aplicar alterações</button></div>
      </div>
    </div>
  </div>
}
