(() => {
  const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
  const DB_NAME = 'meu-video-studio-ai-media'
  const DB_VERSION = 1
  const STORE = 'files'
  const SESSION_KEY = 'vfs-media-session-v2'
  const MAX_HISTORY = 30

  let undoStack = []
  let redoStack = []
  let restoring = false
  let dbPromise = null
  let activeTextDrag = null
  let rebuildingLanes = false
  let historyLock = false
  const pendingTextPatches = new Map()

  const nativeSetItem = Storage.prototype.setItem

  const isEditor = () => window.location.pathname.startsWith('/editor/')
  const getProjectId = () => window.location.pathname.match(/\/editor\/([^/]+)/)?.[1] || null
  const readProjects = () => {
    try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') } catch { return [] }
  }

  function pushHistory(previous) {
    if (!previous || restoring || historyLock) return
    if (undoStack[undoStack.length - 1] === previous) return
    undoStack.push(previous)
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack = []
  }

  function mergeEditorMetadata(previousText, nextText) {
    try {
      const previous = JSON.parse(previousText || '[]')
      const next = JSON.parse(nextText || '[]')
      const prevProject = previous.find((item) => item.id === getProjectId())
      const nextProject = next.find((item) => item.id === getProjectId())
      if (!prevProject || !nextProject) return nextText

      const prevClips = new Map((prevProject.clips || []).map((clip) => [clip.id, clip]))
      nextProject.clips?.forEach((clip) => {
        const old = prevClips.get(clip.id)
        if (old && clip.track === 'video' && old.lane != null) clip.lane = old.lane
      })

      const prevMedia = new Map((prevProject.media || []).map((asset) => [asset.id, asset]))
      nextProject.media?.forEach((asset) => {
        const old = prevMedia.get(asset.id)
        if (!old) return
        if (old.persistentId) asset.persistentId = old.persistentId
        if (old.urlGeneration) asset.urlGeneration = old.urlGeneration
      })

      const projectPatches = pendingTextPatches
      const textMap = new Map((nextProject.texts || []).map((text) => [text.id, text]))
      projectPatches.forEach((patch, textId) => {
        const text = textMap.get(textId)
        if (text) Object.assign(text, patch)
      })
      pendingTextPatches.clear()
      return JSON.stringify(next)
    } catch {
      return nextText
    }
  }

  Storage.prototype.setItem = function editorSafeSetItem(key, value) {
    if (key === PROJECTS_KEY && !restoring) {
      const previous = this.getItem(key)
      const merged = mergeEditorMetadata(previous, value)
      if (previous && previous !== merged) pushHistory(previous)
      value = merged
    }
    return nativeSetItem.call(this, key, value)
  }

  function writeProjects(projects, recordHistory = true) {
    const previous = localStorage.getItem(PROJECTS_KEY)
    const next = JSON.stringify(projects)
    if (recordHistory && previous !== next) pushHistory(previous)
    restoring = true
    nativeSetItem.call(localStorage, PROJECTS_KEY, next)
    restoring = false
  }

  function restoreSnapshot(snapshot, stack, message) {
    const current = localStorage.getItem(PROJECTS_KEY)
    if (current) stack.push(current)
    restoring = true
    nativeSetItem.call(localStorage, PROJECTS_KEY, snapshot)
    restoring = false
    showToast(message)
    window.setTimeout(() => window.location.reload(), 80)
  }

  function bindUndoRedo() {
    if (!isEditor()) return
    const buttons = [...document.querySelectorAll('.editor-top-actions > .icon-btn')]
    if (buttons.length < 2) return
    const undo = buttons[0]
    const redo = buttons[1]
    if (!undo.dataset.vfsHistoryBound) {
      undo.dataset.vfsHistoryBound = '1'
      undo.title = 'Desfazer'
      undo.setAttribute('aria-label', 'Desfazer')
      undo.addEventListener('click', (event) => {
        event.preventDefault(); event.stopImmediatePropagation()
        const snapshot = undoStack.pop()
        if (!snapshot) return showToast('Nada para desfazer')
        restoreSnapshot(snapshot, redoStack, 'Desfeito')
      })
    }
    if (!redo.dataset.vfsHistoryBound) {
      redo.dataset.vfsHistoryBound = '1'
      redo.title = 'Refazer'
      redo.setAttribute('aria-label', 'Refazer')
      redo.addEventListener('click', (event) => {
        event.preventDefault(); event.stopImmediatePropagation()
        const snapshot = redoStack.pop()
        if (!snapshot) return showToast('Nada para refazer')
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
    clearTimeout(Number(toast.dataset.timer || 0))
    toast.dataset.timer = String(window.setTimeout(() => toast.classList.remove('show'), 1100))
  }

  function openDb() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }

  async function saveFile(key, file) {
    try {
      const db = await openDb()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(file, key)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
    } catch (error) {
      console.warn('[Editor] Persistência de mídia indisponível.', error)
    }
  }

  async function loadFile(key) {
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
    } catch { return null }
  }

  function sessionToken() {
    let token = sessionStorage.getItem(SESSION_KEY)
    if (!token) {
      token = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, token)
    }
    return token
  }

  async function persistUpload(input) {
    const files = [...(input.files || [])]
    const id = getProjectId()
    if (!isEditor() || !id || !files.length) return
    await new Promise((resolve) => setTimeout(resolve, 350))
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
      await saveFile(persistentId, file)
      asset.persistentId = persistentId
      asset.urlGeneration = token
      changed = true
    }
    if (changed) writeProjects(projects, false)
  }

  async function restoreMedia() {
    const id = getProjectId()
    if (!id) return
    const projects = readProjects()
    const project = projects.find((item) => item.id === id)
    if (!project) return
    const token = sessionToken()
    let changed = false
    for (const asset of project.media || []) {
      if (!asset.persistentId || asset.urlGeneration === token) continue
      const file = await loadFile(asset.persistentId)
      if (!file) continue
      asset.url = URL.createObjectURL(file)
      asset.urlGeneration = token
      changed = true
    }
    if (changed) {
      writeProjects(projects, false)
      setTimeout(() => window.location.reload(), 60)
    }
  }

  function setControlValue(input, value) {
    if (!input) return
    const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function patchText(textId, patch) {
    if (!textId) return
    const projects = readProjects()
    const project = projects.find((item) => item.id === getProjectId())
    const text = project?.texts?.find((item) => item.id === textId)
    if (!text) return
    Object.assign(text, patch)
    Object.assign(pendingTextPatches.get(textId) || {}, patch)
    pendingTextPatches.set(textId, { ...(pendingTextPatches.get(textId) || {}), ...patch })
    writeProjects(projects, true)
  }

  function textIds() {
    const project = readProjects().find((item) => item.id === getProjectId())
    return project?.texts || []
  }

  function refreshTextIds() {
    const texts = textIds()
    document.querySelectorAll('.overlay-text').forEach((element, index) => {
      if (!element.dataset.textId) {
        const raw = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim() || ''
        const match = texts.find((text) => text.text === raw) || texts[index]
        if (match) element.dataset.textId = match.id
      }
      if (!element.querySelector('.vfs-text-handle')) {
        const handle = document.createElement('span')
        handle.className = 'vfs-text-handle'
        handle.setAttribute('aria-hidden', 'true')
        element.appendChild(handle)
      }
    })
  }

  function bindTextDrag() {
    if (!isEditor() || document.documentElement.dataset.vfsTextV2) return
    document.documentElement.dataset.vfsTextV2 = '1'

    document.addEventListener('pointerdown', (event) => {
      const target = event.target
      const element = target instanceof Element ? target.closest('.overlay-text') : null
      if (!element || !element.closest('.video-stage')) return
      refreshTextIds()
      const stage = element.closest('.video-stage')
      const style = getComputedStyle(element)
      activeTextDrag = {
        element,
        stage,
        textId: element.dataset.textId,
        mode: target instanceof Element && target.classList.contains('vfs-text-handle') ? 'resize' : 'move',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: Number.parseFloat(style.left) || 50,
        startY: Number.parseFloat(style.top) || 50,
        startSize: Number.parseFloat(style.fontSize) || 24,
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
        const x = Math.max(3, Math.min(97, drag.startX + (dx / Math.max(1, rect.width)) * 100))
        const y = Math.max(3, Math.min(97, drag.startY + (dy / Math.max(1, rect.height)) * 100))
        drag.element.style.left = `${x}%`
        drag.element.style.top = `${y}%`
        drag.lastX = x
        drag.lastY = y
      } else {
        const size = Math.max(8, Math.min(160, drag.startSize + (dx + dy) / 3))
        drag.element.style.fontSize = `${size}px`
        drag.lastSize = size
      }
      event.preventDefault()
    }, true)

    const finish = (event) => {
      const drag = activeTextDrag
      if (!drag) return
      if (drag.moved) {
        const x = drag.lastX ?? drag.startX
        const y = drag.lastY ?? drag.startY
        if (drag.textId) {
          if (drag.mode === 'move') {
            patchText(drag.textId, { x, y })
          } else if (drag.lastSize != null) {
            patchText(drag.textId, { fontSize: Math.round(Math.max(14, Math.min(120, drag.lastSize * 2))) })
          }
          setTimeout(() => {
            const numbers = [...document.querySelectorAll('.right-panel input[type="number"]')]
            if (numbers.length >= 2 && drag.mode === 'move') {
              setControlValue(numbers[0], x.toFixed(2))
              setControlValue(numbers[1], y.toFixed(2))
            }
            const range = document.querySelector('.left-panel .inspector-inline input[type="range"]')
            if (range && drag.mode === 'resize' && drag.lastSize != null) setControlValue(range, Math.round(Math.max(14, Math.min(120, drag.lastSize * 2))))
          }, 0)
        }
      } else {
        // Preserve React's normal selection click without allowing the old pointerdown handlers to move the text.
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

  function patchAudioSavePicker(button) {
    if (!button || button.dataset.vfsAudioV2) return
    const clone = button.cloneNode(true)
    button.replaceWith(clone)
    clone.dataset.vfsAudioV2 = '1'
    clone.addEventListener('click', async (event) => {
      event.preventDefault(); event.stopPropagation()
      const row = clone.closest('.media-row')
      const name = row?.querySelector('.media-meta strong')?.textContent?.trim() || 'audio'
      const project = readProjects().find((item) => item.id === getProjectId())
      const asset = project?.media?.find((item) => item.kind === 'audio' && item.name === name)
      if (!asset?.url) return
      const previous = clone.textContent
      clone.textContent = 'Salvando...'; clone.disabled = true
      try {
        const response = await fetch(asset.url)
        const blob = await response.blob()
        if (window.showSaveFilePicker) {
          const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : 'mp3'
          const type = blob.type || (extension === 'wav' ? 'audio/wav' : extension === 'ogg' ? 'audio/ogg' : 'audio/mpeg')
          const handle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: 'Arquivo de áudio', accept: { [type]: [`.${extension}`] } }],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
        } else {
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url; anchor.download = name
          document.body.appendChild(anchor); anchor.click(); anchor.remove()
          setTimeout(() => URL.revokeObjectURL(url), 1500)
        }
        showToast('Áudio salvo')
      } catch (error) {
        if (error?.name !== 'AbortError') {
          const anchor = document.createElement('a')
          anchor.href = asset.url; anchor.download = name
          document.body.appendChild(anchor); anchor.click(); anchor.remove()
        }
      } finally {
        clone.textContent = previous; clone.disabled = false
      }
    })
  }

  function bindAudio() {
    if (!isEditor()) return
    document.querySelectorAll('.vfs-download-audio').forEach(patchAudioSavePicker)
  }

  function projectVideoClips() {
    const project = readProjects().find((item) => item.id === getProjectId())
    return (project?.clips || []).filter((clip) => clip.track === 'video')
  }

  function saveLane(clipId, lane) {
    const projects = readProjects()
    const project = projects.find((item) => item.id === getProjectId())
    const clip = project?.clips?.find((item) => item.id === clipId)
    if (!clip) return
    clip.lane = lane
    writeProjects(projects, true)
  }

  function createLaneElements(width) {
    const wrapper = document.createElement('div')
    wrapper.className = 'vfs-video-lanes'
    ;['Vídeo 1', 'Vídeo 2', 'Vídeo 3'].forEach((label, lane) => {
      const track = document.createElement('div')
      track.className = 'timeline-track vfs-video-track'
      const labelBox = document.createElement('div')
      labelBox.className = 'track-label'
      labelBox.innerHTML = `<span>${label}</span>`
      const laneBox = document.createElement('div')
      laneBox.className = 'track-lane vfs-video-lane'
      laneBox.dataset.lane = String(lane)
      laneBox.style.width = `${width}px`
      track.append(labelBox, laneBox)
      wrapper.appendChild(track)
    })
    return wrapper
  }

  function bindLaneDrag(element) {
    if (element.dataset.vfsLaneV2) return
    element.dataset.vfsLaneV2 = '1'
    element.addEventListener('dragend', (event) => {
      const wrapper = document.querySelector('.vfs-video-lanes')
      const id = element.dataset.vfsClipId
      if (!wrapper || !id) return
      const rect = wrapper.getBoundingClientRect()
      const lane = Math.max(0, Math.min(2, Math.floor((event.clientY - rect.top) / 55)))
      saveLane(id, lane)
      setTimeout(() => arrangeVideoClips(), 0)
    })
  }

  function arrangeVideoClips() {
    if (!isEditor() || rebuildingLanes) return
    const scroll = document.querySelector('.timeline-scroll')
    if (!scroll) return
    const projectClips = projectVideoClips()
    if (!projectClips.length) return
    let wrapper = scroll.querySelector('.vfs-video-lanes')
    const original = [...scroll.querySelectorAll(':scope > .timeline-track')].find((track) => track.querySelector('.track-label')?.textContent?.includes('Vídeo'))

    rebuildingLanes = true
    const source = original ? [...original.querySelectorAll('.timeline-clip')] : []
    if (!wrapper) {
      const width = Math.max(1000, Number.parseFloat(original?.querySelector('.track-lane')?.style.width || '1080'))
      wrapper = createLaneElements(width)
      if (original) original.replaceWith(wrapper)
    }

    const lanes = [...wrapper.querySelectorAll('.vfs-video-lane')]
    const existing = [...wrapper.querySelectorAll('.timeline-clip')]
    const candidates = source.length ? source : existing
    if (source.length) existing.forEach((clip) => clip.remove())

    candidates.forEach((element, index) => {
      let id = element.dataset.vfsClipId
      let clip = id ? projectClips.find((item) => item.id === id) : null
      if (!clip) clip = projectClips[index]
      if (!clip) return
      element.dataset.vfsClipId = clip.id
      element.draggable = true
      element.style.top = '10px'
      const lane = Math.max(0, Math.min(2, Number(clip.lane || 0)))
      lanes[lane]?.appendChild(element)
      bindLaneDrag(element)
    })
    if (original?.isConnected) original.remove()
    rebuildingLanes = false
  }

  function installStyles() {
    if (document.getElementById('vfs-editor-v2-styles')) return
    const style = document.createElement('style')
    style.id = 'vfs-editor-v2-styles'
    style.textContent = `
      .preview-area{overflow:hidden!important;min-width:0;min-height:0}
      .video-stage{max-width:calc(100% - 12px)!important;max-height:calc(100% - 12px)!important}
      .video-stage.landscape,.video-stage.square,.video-stage.portrait-feed,.video-stage.portrait{max-height:calc(100% - 12px)!important;max-width:calc(100% - 12px)!important}
      .overlay-text{touch-action:none!important;user-select:none!important;cursor:grab!important}
      .overlay-text:active{cursor:grabbing!important}
      .vfs-text-handle{position:absolute!important;right:-9px!important;bottom:-9px!important;width:12px!important;height:12px!important;border-radius:3px!important;background:#8b5cf6!important;border:2px solid #fff!important;box-shadow:0 2px 8px rgba(0,0,0,.4)!important;cursor:nwse-resize!important;z-index:20!important}
      .vfs-video-lanes{display:flex;flex-direction:column;min-width:1080px}
      .vfs-video-lanes .timeline-track{height:55px!important}
      .vfs-video-lanes .track-lane{min-width:1000px}
      .vfs-video-lanes .track-label{font-size:8px;color:#666771}
      .vfs-video-lanes .vfs-video-track:nth-child(2) .track-label{color:#8e73bd}
      .vfs-fix-toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,8px);opacity:0;pointer-events:none;z-index:1000;padding:8px 12px;border-radius:9px;border:1px solid rgba(139,92,246,.35);background:#17131f;color:#eee;font:11px Inter,system-ui,sans-serif;transition:.16s}
      .vfs-fix-toast.show{opacity:1;transform:translate(-50%,0)}
    `
    document.head.appendChild(style)
  }

  function observe() {
    if (!isEditor()) return
    installStyles()
    bindUndoRedo()
    refreshTextIds()
    bindTextDrag()
    bindAudio()
    arrangeVideoClips()
  }

  document.addEventListener('change', (event) => {
    const input = event.target
    if (input instanceof HTMLInputElement && input.type === 'file' && isEditor()) void persistUpload(input)
  }, true)

  if (isEditor()) {
    void restoreMedia()
    const observer = new MutationObserver(() => {
      if (rebuildingLanes) return
      window.setTimeout(observe, 0)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    observe()
  }
})()
