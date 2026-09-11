import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../editor/store'
import './project-name-editor.css'

export default function ProjectNameEditor() {
  const name = useEditorStore(s => s.project.name)
  const setProjectName = useEditorStore(s => s.setProjectName)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [draft, setDraft] = useState(name)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(name)
  }, [name])

  useEffect(() => {
    const find = () => {
      const el = document.querySelector<HTMLElement>('.fx-project-title')
      setHost(el)
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!host) return null

  const commit = () => setProjectName(draft)

  return createPortal(
    <input
      ref={input}
      className="fx-project-name-editor"
      value={draft}
      aria-label="Nome do projeto"
      title="Nome do projeto"
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          input.current?.blur()
        }
        if (e.key === 'Escape') {
          setDraft(name)
          input.current?.blur()
        }
      }}
    />,
    host,
  )
}
