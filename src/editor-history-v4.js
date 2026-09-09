(() => {
  const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
  const HISTORY_KEY = 'meu-video-studio-ai:editor-history:v1'
  const MAX = 30
  let guard = false
  let last = localStorage.getItem(PROJECTS_KEY) || ''

  function load() {
    try {
      const value = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '{}')
      return {
        undo: Array.isArray(value.undo) ? value.undo : [],
        redo: Array.isArray(value.redo) ? value.redo : [],
      }
    } catch { return { undo: [], redo: [] } }
  }
  function save(history) {
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch {}
  }
  function record(previous, next) {
    if (guard || !previous || previous === next) return
    const history = load()
    if (history.undo[history.undo.length - 1] !== previous) history.undo.push(previous)
    if (history.undo.length > MAX) history.undo.shift()
    history.redo = []
    save(history)
  }

  // Polling is intentional: the editor has legacy code paths that sometimes write
  // localStorage through a saved/native setter, so observing the final value is more
  // reliable than wrapping only one writer.
  setInterval(() => {
    const current = localStorage.getItem(PROJECTS_KEY) || ''
    if (current !== last) {
      record(last, current)
      last = current
    }
  }, 180)

  function bind() {
    if (!location.pathname.startsWith('/editor/')) return
    const buttons = [...document.querySelectorAll('.editor-top-actions > .icon-btn')]
    if (buttons.length < 2) return
    const [undoButton, redoButton] = buttons

    if (!undoButton.dataset.vfsHistoryV4) {
      undoButton.dataset.vfsHistoryV4 = '1'
      document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return
        if (!undoButton.contains(event.target)) return
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
        const history = load()
        const snapshot = history.undo.pop()
        if (!snapshot) return showToast('Nada para desfazer')
        const current = localStorage.getItem(PROJECTS_KEY) || ''
        if (current) history.redo.push(current)
        history.redo = history.redo.slice(-MAX)
        guard = true
        localStorage.setItem(PROJECTS_KEY, snapshot)
        guard = false
        save(history)
        last = snapshot
        showToast('Desfeito')
        setTimeout(() => location.reload(), 70)
      }, true)
    }

    if (!redoButton.dataset.vfsHistoryV4) {
      redoButton.dataset.vfsHistoryV4 = '1'
      document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return
        if (!redoButton.contains(event.target)) return
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
        const history = load()
        const snapshot = history.redo.pop()
        if (!snapshot) return showToast('Nada para refazer')
        const current = localStorage.getItem(PROJECTS_KEY) || ''
        if (current) history.undo.push(current)
        history.undo = history.undo.slice(-MAX)
        guard = true
        localStorage.setItem(PROJECTS_KEY, snapshot)
        guard = false
        save(history)
        last = snapshot
        showToast('Refeito')
        setTimeout(() => location.reload(), 70)
      }, true)
    }
  }

  function showToast(message) {
    let toast = document.querySelector('.vfs-fix-toast')
    if (!toast) {
      toast = document.createElement('div')
      toast.className = 'vfs-fix-toast'
      document.body.appendChild(toast)
    }
    toast.textContent = message
    toast.classList.add('show')
    clearTimeout(Number(toast.dataset.timer || 0))
    toast.dataset.timer = String(setTimeout(() => toast.classList.remove('show'), 1000))
  }

  if (location.pathname.startsWith('/editor/')) {
    const observer = new MutationObserver(() => setTimeout(bind, 0))
    observer.observe(document.body, { childList: true, subtree: true })
    bind()
  }
})()
