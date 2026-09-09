(() => {
  const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
  const DB_NAME = 'meu-video-studio-ai-media'
  const DB_VERSION = 1
  const STORE_NAME = 'files'
  const SESSION_KEY = 'vfs-media-session-v1'
  const MAX_HISTORY = 25

  let undoStack = []
  let redoStack = []
  let restoring = false
  let dbPromise = null
  let activeTextDrag = null
  let rebuildingLanes = false

  const originalSetItem = Storage.prototype.setItem

  function isEditor() {
    return window.location.pathname.startsWith('/editor/')
  }

  function projectId() {
    return window.location.pathname.match(/\/editor\/([^/]+)/)?.[1] || null
  }

  function readProjects() {
    try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') } catch { return [] }
  }

  function writeProjects(projects, recordHistory = true) {
    if (recordHistory) {
      const current = localStorage.getItem(PROJECTS_KEY)
      const next = JSON.stringify(projects)
      if (current !== next) pushHistory(current)
    }
    restoring = true
    originalSetItem.call(localStorage, PROJECTS_KEY, JSON.stringify(projects))
    restoring = false
  }

  function pushHistory(previous) {
    if (!previous || restoring) return
    const last = undoStack[undoStack.length - 1]
    if (last === previous) return
    undoStack.push(previous)
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack = []
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (key === PROJECTS_KEY && !restoring) {
      const previous = this.getItem(key)
      if (previous && previous !== value) pushHistory(previous)
    }
    return originalSetItem.call(this, key, value)
  }

  function restoreSnapshot(snapshot, targetStack, buttonMessage) {
    if (!snapshot) return
    const current = localStorage.getItem(PROJECTS_KEY)
    if (current) targetStack.push(current)
    restoring = true
    originalSetItem.call(localStorage, PROJECTS_KEY, snapshot)
    restoring = false
    showToast(buttonMessage)
    window.setTimeout(() => window.location.reload(), 80)
  }

  function bindUndoRedo() {
    if (!isEditor()) return
    const buttons = [...document.querySelectorAll('.editor-top-actions > .icon-btn')]
    if (buttons.length < 2) return
    const undo = buttons[0]
    const redo = buttons[1]
    if (!undo.dataset.vfsUndoBound) {
      undo.dataset.vfsUndoBound = '1'
      undo.setAttribute('aria-label', 'Desfazer')
      undo.title = 'Desfazer'
      undo.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        const snapshot = undoStack.pop()
        if (!snapshot) return showToast('Nada para desfazer')
        const current = localStorage.getItem(PROJECTS_KEY)
        if (current) redoStack.push(current)
        restoreSnapshot(snapshot, redoStack, 'Desfeito')
      })
    }
    if (!redo.dataset.vfsRedoBound) {
      redo.dataset.vfsRedoBound = '1'
      redo.setAttribute('aria-label', 'Refazer')
      redo.title = 'Refazer'
      redo.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        const snapshot = redoStack.pop()
        if (!snapshot) return showToast('Nada para refazer')
        const current = localStorage.getItem(PROJECTS_KEY)
        if (current) undoStack.push(current)
        restoreSnapshot(snapshot, undoStack, 'Refeito')
      })
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
    window.clearTimeout(Number(toast.dataset.timer || 0))
    toast.dataset.timer = String(window.setTimeout(() => toast?.classList.remove('show'), 1200))
  }

  function openDb() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return dbPromise
  }

  async function storeFile(key, file) {
    try {
      const db = await openDb()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(file, key)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
    } catch (error) {
      console.warn('[Editor] Não foi possível persistir a mídia no IndexedDB.', error)
    }
  }

  async function getStoredFile(key) {
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const request = tx.objectStore(STORE_NAME).get(key)
        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return null
    }
  }

  function sessionToken() {
    let value = sessionStorage.getItem(SESSION_KEY)
    if (!value) {
      value = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, value)
    }
    return value
  }

  async function persistUploadedFiles(input) {
    const files = [...(input.files || [])]
    const id = projectId()
    if (!files.length || !id) return
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    const projects = readProjects()
    const project = projects.find((item) => item.id === id)
    if (!project) return
    const used = new Set()
    const token = sessionToken()
    let changed = false
    for (const file of files) {
      const index = project.media.findIndex((asset) => asset.name === file.name && !used.has(asset.id))
      if (index < 0) continue
      const asset = project.media[index]
      used.add(asset.id)
      const persistentId = `${id}:${asset.id}`
      await storeFile(persistentId, file)
      asset.persistentId = persistentId
      asset.urlGeneration = token
      changed = true
    }
    if (changed) writeProjects(projects, false)
  }

  function bindFilePersistence() {
    document.addEventListener('change', (event) => {
      const input = event.target
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return
      if (!isEditor()) return
      void persistUploadedFiles(input)
    }, true)
  }

  async function restorePersistentMedia() {
    const id = projectId()
    if (!id) return
    const projects = readProjects()
    const project = projects.find((item) => item.id === id)
    if (!project) return
    const token = sessionToken()
    let changed = false
    for (const asset of project.media || []) {
      if (!asset.persistentId || asset.urlGeneration === token) continue
      const file = await getStoredFile(asset.persistentId)
      if (!file) continue
      if (asset.url?.startsWith('blob:')) URL.revokeObjectURL(asset.url)
      asset.url = URL.createObjectURL(file)
      asset.urlGeneration = token
      changed = true
    }
    if (changed) {
      writeProjects(projects, false)
      window.setTimeout(() => window.location.reload(), 50)
    }
  }

  function installPreviewFixes() {
    if (document.getElementById('vfs-editor-fixes-style')) return
    const style = document.createElement('style')
    style.id = 'vfs-editor-fixes-style'
    style.textContent = `
      .preview-area{overflow:hidden!important;min-width:0;min-height:0}
      .video-stage{max-width:calc(100% - 10px)!important;max-height:calc(100% - 10px)!important}
      .video-stage.landscape{max-width:calc(100% - 10px)!important;max-height:calc(100% - 10px)!important}
      .video-stage.square,.video-stage.portrait-feed,.video-stage.portrait{max-height:calc(100% - 10px)!important}
      .vfs-video-lanes{display:flex;flex-direction:column;min-width:1080px}
      .vfs-video-lanes .timeline-track{height:55px!important}
      .vfs-video-lanes .track-label{background:#101014}
      .vfs-video-lanes .track-lane{min-width:1000px}
      .vfs-lane-active .track-label{color:#c4b5fd}
      .vfs-fix-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,8px);padding:8px 12px;border:1px solid rgba(139,92,246,.35);border-radius:9px;background:#17131f;color:#eee;font:11px Inter,system-ui,sans-serif;opacity:0;pointer-events:none;z-index:1000;transition:.18s}
      .vfs-fix-toast.show{opacity:1;transform:translate(-50%,0)}
      .vfs-text-handle{pointer-events:auto!important}
      .overlay-text{touch-action:none!important}
    `
    document.head.appendChild(style)
  }

  function patchTextLocalStorage(textId, patch) {
    const id = projectId()
    if (!id) return
    const projects = readProjects()
    const project = projects.find((item) => item.id === id)
    if (!project) return
    const text = project.texts?.find((item) => item.id === textId)
    if (!text) return
    Object.assign(text, patch)
    writeProjects(projects, true)
  }

  function setNativeInputValue(input, value) {
    if (!input) return
    const prototype = input instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function syncTextControls(x, y, modelSize) {
    const numbers = [...document.querySelectorAll('.right-panel input[type="number"]')]
    if (numbers.length >= 2) {
      setNativeInputValue(numbers[0], Number(x.toFixed(2)))
      setNativeInputValue(numbers[1], Number(y.toFixed(2)))
    }
    const range = document.querySelector('.left-panel .inspector-inline input[type="range"]')
    if (range && Number.isFinite(modelSize)) setNativeInputValue(range, Math.round(modelSize))
  }

  function bindTextControls() {
    if (!isEditor()) return
    // Capture phase blocks the old drag handler from Phase 4 so the pointer math cannot jump to 99/99.
    if (!document.documentElement.dataset.vfsTextCapture) {
      document.documentElement.dataset.vfsTextCapture = '1'
      document.addEventListener('pointerdown', (event) => {
        const target = event.target
        const element = target instanceof Element ? target.closest('.overlay-text') : null
        if (!element || !element.closest('.video-stage')) return
        const stage = element.closest('.video-stage')
        const handle = target instanceof Element && target.classList.contains('vfs-text-handle')
        const style = getComputedStyle(element)
        const startX = Number.parseFloat(style.left) || 50
        const startY = Number.parseFloat(style.top) || 50
        const startCssSize = Number.parseFloat(style.fontSize) || 24
        activeTextDrag = {
          element,
          stage,
          mode: handle ? 'resize' : 'move',
          startClientX: event.clientX,
          startClientY: event.clientY,
          startX,
          startY,
          startCssSize,
          moved: false,
        }
        element.classList.add('selected')
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }, true)
      document.addEventListener('pointermove', (event) => {
        const drag = activeTextDrag
        if (!drag) return
        const rect = drag.stage.getBoundingClientRect()
        const dx = event.clientX - drag.startClientX
        const dy = event.clientY - drag.startClientY
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true
        if (drag.mode === 'move') {
          const x = Math.max(2, Math.min(98, drag.startX + (dx / Math.max(1, rect.width)) * 100))
          const y = Math.max(2, Math.min(98, drag.startY + (dy / Math.max(1, rect.height)) * 100))
          drag.element.style.left = `${x}%`
          drag.element.style.top = `${y}%`
          drag.lastX = x
          drag.lastY = y
        } else {
          const delta = (dx + dy) / 3
          const cssSize = Math.max(8, Math.min(160, drag.startCssSize + delta))
          drag.element.style.fontSize = `${cssSize}px`
          drag.lastCssSize = cssSize
        }
        event.preventDefault()
      }, true)
      const finish = (event) => {
        const drag = activeTextDrag
        if (!drag) return
        if (drag.moved) {
          const x = drag.lastX ?? drag.startX
          const y = drag.lastY ?? drag.startY
          const modelSize = drag.lastCssSize ? Math.max(14, Math.min(120, drag.lastCssSize * 2)) : undefined
          const textId = drag.element.key || drag.element.dataset.textId
          if (drag.mode === 'move') patchTextLocalStorage(findTextId(drag.element), { x, y })
          if (drag.mode === 'resize' && modelSize) patchTextLocalStorage(findTextId(drag.element), { fontSize: modelSize })
          syncTextControls(x, y, modelSize)
        } else {
          drag.element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: event.clientX, clientY: event.clientY }))
        }
        activeTextDrag = null
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
      document.addEventListener('pointerup', finish, true)
      document.addEventListener('pointercancel', finish, true)
    }
  }

  function findTextId(element) {
    const project = readProjects().find((item) => item.id === projectId())
    if (!project) return null
    const textValue = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim() || ''
    const candidates = (project.texts || []).filter((text) => text.text === textValue)
    if (candidates.length === 1) return candidates[0].id
    const x = Number.parseFloat(element.style.left)
    const y = Number.parseFloat(element.style.top)
    return candidates.sort((a, b) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(b.x - x) + Math.abs(b.y - y)))[0]?.id || null
  }

  function assignTextIds() {
    const project = readProjects().find((item) => item.id === projectId())
    if (!project) return
    const texts = project.texts || []
    document.querySelectorAll('.overlay-text').forEach((element, index) => {
      const value = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim() || ''
      const match = texts.find((text) => text.text === value) || texts[index]
      if (match) element.dataset.textId = match.id
      if (!element.querySelector('.vfs-text-handle')) {
        const handle = document.createElement('span')
        handle.className = 'vfs-text-handle'
        handle.setAttribute('aria-hidden', 'true')
        element.appendChild(handle)
      }
    })
  }

  function patchAudioDownload() {
    if (!isEditor()) return
    document.querySelectorAll('.vfs-download-audio').forEach((button) => {
      if (button.dataset.vfsSavePicker) return
      const replacement = button.cloneNode(true)
      button.replaceWith(replacement)
      replacement.dataset.vfsSavePicker = '1'
      replacement.addEventListener('click', async (event) => {
        event.preventDefault()
        event.stopPropagation()
        const row = replacement.closest('.media-row')
        const name = row?.querySelector('.media-meta strong')?.textContent?.trim() || 'audio'
        const project = readProjects().find((item) => item.id === projectId())
        const asset = project?.media?.find((item) => item.kind === 'audio' && item.name === name)
        if (!asset?.url) return
        replacement.disabled = true
        const original = replacement.textContent
        replacement.textContent = 'Salvando...'
        try {
          const response = await fetch(asset.url)
          const blob = await response.blob()
          if (window.showSaveFilePicker) {
            const extension = name.includes('.') ? name.split('.').pop() : 'audio'
            const handle = await window.showSaveFilePicker({
              suggestedName: name,
              types: [{ description: 'Arquivo de áudio', accept: { [blob.type || `audio/${extension}`]: [`.${extension}`] } }],
            })
            const writable = await handle.createWritable()
            await writable.write(blob)
            await writable.close()
          } else {
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = name
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            window.setTimeout(() => URL.revokeObjectURL(url), 1500)
          }
          showToast('Áudio salvo com sucesso')
        } catch (error) {
          if (error?.name !== 'AbortError') {
            const anchor = document.createElement('a')
            anchor.href = asset.url
            anchor.download = name
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
          }
        } finally {
          replacement.disabled = false
          replacement.textContent = original
        }
      })
    })
  }

  function currentVideoClips() {
    const project = readProjects().find((item) => item.id === projectId())
    return (project?.clips || []).filter((clip) => clip.track === 'video')
  }

  function setClipLane(clipId, lane) {
    const projects = readProjects()
    const project = projects.find((item) => item.id === projectId())
    const clip = project?.clips?.find((item) => item.id === clipId)
    if (!clip) return
    clip.lane = lane
    writeProjects(projects, true)
  }

  function buildVideoLanes() {
    if (!isEditor() || rebuildingLanes) return
    const scroll = document.querySelector('.timeline-scroll')
    if (!scroll) return
    const original = [...scroll.querySelectorAll(':scope > .timeline-track')].find((track) => track.querySelector('.track-label')?.textContent?.includes('Vídeo'))
    let wrapper = scroll.querySelector('.vfs-video-lanes')
    if (!original && !wrapper) return

    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = 'vfs-video-lanes'
      original?.replaceWith(wrapper)
    }

    const clips = currentVideoClips()
    const labels = ['Vídeo 1', 'Vídeo 2', 'Vídeo 3']
    rebuildingLanes = true

    const oldClips = wrapper.querySelectorAll('.timeline-clip')
    oldClips.forEach((clip) => clip.remove())
    wrapper.innerHTML = ''

    const tracks = labels.map((label, lane) => {
      const track = document.createElement('div')
      track.className = 'timeline-track vfs-video-track'
      const labelBox = document.createElement('div')
      labelBox.className = 'track-label'
      labelBox.innerHTML = `<span>${label}</span>`
      const laneBox = document.createElement('div')
      laneBox.className = 'track-lane vfs-video-lane'
      laneBox.dataset.lane = String(lane)
      laneBox.style.width = `${Math.max(1000, Number.parseFloat(original?.querySelector('.track-lane')?.style.width || '1080'))}px`
      track.append(labelBox, laneBox)
      wrapper.appendChild(track)
      return laneBox
    })

    const sourceClips = original ? [...original.querySelectorAll('.timeline-clip')] : []
    const allClips = [...document.querySelectorAll('.timeline-clip')].filter((clip) => !clip.closest('.vfs-video-lanes'))
    const candidates = sourceClips.length ? sourceClips : allClips
    candidates.forEach((clipElement, index) => {
      const clip = clips[index]
      if (!clip) return
      clipElement.dataset.vfsClipId = clip.id
      const lane = Math.max(0, Math.min(2, Number(clip.lane || 0)))
      tracks[lane].appendChild(clipElement)
      clipElement.style.top = '10px'
      clipElement.draggable = true
      bindClipLaneDrag(clipElement)
    })

    // React can rerender the original video track. Removing the old one after collecting its children avoids losing DOM nodes.
    if (original?.isConnected) original.remove()
    rebuildingLanes = false
  }

  function bindClipLaneDrag(element) {
    if (element.dataset.vfsLaneDrag) return
    element.dataset.vfsLaneDrag = '1'
    element.addEventListener('dragend', (event) => {
      const wrapper = document.querySelector('.vfs-video-lanes')
      if (!wrapper) return
      const rect = wrapper.getBoundingClientRect()
      const relativeY = event.clientY - rect.top
      const lane = Math.max(0, Math.min(2, Math.floor(relativeY / 55)))
      const id = element.dataset.vfsClipId
      if (!id) return
      setClipLane(id, lane)
      window.setTimeout(rebuildVideoLanes, 0)
    })
  }

  function preserveLanesOnReactSave() {
    if (!isEditor()) return
    if (preserveLanesOnReactSave.bound) return
    preserveLanesOnReactSave.bound = true
    const laneById = new Map()
    const refresh = () => {
      const projects = readProjects()
      const project = projects.find((item) => item.id === projectId())
      ;(project?.clips || []).forEach((clip) => {
        if (clip.track === 'video') laneById.set(clip.id, Number(clip.lane || 0))
      })
    }
    refresh()
    const previousSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function preserveLaneSetItem(key, value) {
      if (key !== PROJECTS_KEY || restoring) return previousSetItem.call(this, key, value)
      try {
        const parsed = JSON.parse(value)
        const project = parsed.find((item) => item.id === projectId())
        if (project) {
          project.clips?.forEach((clip) => {
            if (clip.track === 'video' && laneById.has(clip.id)) clip.lane = laneById.get(clip.id)
          })
          value = JSON.stringify(parsed)
          laneById.clear()
          project.clips?.forEach((clip) => { if (clip.track === 'video') laneById.set(clip.id, Number(clip.lane || 0)) })
        }
      } catch {}
      return previousSetItem.call(this, key, value)
    }
  }

  function rebuildVideoLanes() {
    window.setTimeout(() => buildVideoLanes(), 30)
  }

  function observe() {
    if (!isEditor()) return
    installPreviewFixes()
    bindUndoRedo()
    assignTextIds()
    bindTextControls()
    patchAudioDownload()
    preserveLanesOnReactSave()
    buildVideoLanes()
  }

  bindFilePersistence()
  void restorePersistentMedia()
  if (isEditor()) {
    new MutationObserver(() => {
      if (rebuildingLanes) return
      observe()
    }).observe(document.body, { childList: true, subtree: true })
    observe()
  }
})()
