import { useEditorStore } from '../editor/store'

const SELECTOR = '.s-card'
const ACTION_CLASS = 's-card-delete'

function assetIdFromCard(card: HTMLElement) {
  const name = card.querySelector(':scope > b')?.textContent?.trim()
  if (!name) return null
  return useEditorStore.getState().project.media.find(asset => asset.name === name)?.id ?? null
}

function addDeleteControl(card: HTMLElement) {
  if (card.querySelector(`.${ACTION_CLASS}`)) return
  const control = document.createElement('span')
  control.className = ACTION_CLASS
  control.title = 'Excluir material'
  control.setAttribute('role', 'button')
  control.setAttribute('aria-label', 'Excluir material')
  control.textContent = '×'
  control.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    const assetId = assetIdFromCard(card)
    if (!assetId) return
    const asset = useEditorStore.getState().project.media.find(item => item.id === assetId)
    if (!asset) return
    const clips = useEditorStore.getState().project.clips.filter(clip => clip.assetId === assetId).length
    const question = clips > 0
      ? `Excluir “${asset.name}”? O material e ${clips} clipe(s) da timeline serão removidos.`
      : `Excluir “${asset.name}” da área de material?`
    if (window.confirm(question)) useEditorStore.getState().deleteMedia(assetId)
  })
  card.appendChild(control)
}

function scan() {
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach(addDeleteControl)
}

scan()
const observer = new MutationObserver(scan)
observer.observe(document.body, { childList: true, subtree: true })
