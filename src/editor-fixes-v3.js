(() => {
  const KEY = 'meu-video-studio-ai:projects:v2'
  const DB = 'meu-video-studio-ai-media'
  const STORE = 'files'
  const SESSION = 'vfs-media-session-v3'
  const LIMIT = 30
  const nativeSetItem = Storage.prototype.setItem
  let guard = false
  let dbPromise = null
  let undo = []
  let redo = []
  let active = null
  let building = false
  const pendingText = new Map()

  const editor = () => location.pathname.startsWith('/editor/')
  const pid = () => location.pathname.match(/\/editor\/([^/]+)/)?.[1] || null
  const projects = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }

  function pushHistory(previous) {
    if (!previous || guard || previous === localStorage.getItem(KEY)) return
    if (undo[undo.length - 1] !== previous) undo.push(previous)
    if (undo.length > LIMIT) undo.shift()
    redo = []
  }

  function mergeMeta(previous, value) {
    try {
      const oldList = JSON.parse(previous || '[]')
      const nextList = JSON.parse(value || '[]')
      const id = pid()
      if (!id) return value
      const oldProject = oldList.find((p) => p.id === id)
      const nextProject = nextList.find((p) => p.id === id)
      if (!oldProject || !nextProject) return value

      const oldClips = new Map((oldProject.clips || []).map((c) => [c.id, c]))
      ;(nextProject.clips || []).forEach((c) => {
        const old = oldClips.get(c.id)
        if (old?.lane != null && c.track === 'video') c.lane = old.lane
      })
      const oldMedia = new Map((oldProject.media || []).map((m) => [m.id, m]))
      ;(nextProject.media || []).forEach((m) => {
        const old = oldMedia.get(m.id)
        if (old?.persistentId) m.persistentId = old.persistentId
        if (old?.urlGeneration) m.urlGeneration = old.urlGeneration
      })
      ;(nextProject.texts || []).forEach((t) => {
        const patch = pendingText.get(t.id)
        if (patch) Object.assign(t, patch)
      })
      pendingText.clear()
      return JSON.stringify(nextList)
    } catch { return value }
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (key === KEY && !guard) {
      const previous = this.getItem(key)
      const merged = mergeMeta(previous, value)
      if (previous && previous !== merged) pushHistory(previous)
      value = merged
    }
    return nativeSetItem.call(this, key, value)
  }

  function write(next, history = false) {
    const previous = localStorage.getItem(KEY)
    const value = JSON.stringify(next)
    if (history && previous !== value) pushHistory(previous)
    guard = true
    nativeSetItem.call(localStorage, KEY, value)
    guard = false
  }

  function toast(text) {
    let el = document.querySelector('.vfs-fix-toast')
    if (!el) { el = document.createElement('div'); el.className = 'vfs-fix-toast'; document.body.appendChild(el) }
    el.textContent = text; el.classList.add('show')
    clearTimeout(Number(el.dataset.timer || 0))
    el.dataset.timer = String(setTimeout(() => el.classList.remove('show'), 1100))
  }

  function historyButtons() {
    const buttons = [...document.querySelectorAll('.editor-top-actions > .icon-btn')]
    if (buttons.length < 2) return
    const [undoBtn, redoBtn] = buttons
    if (!undoBtn.dataset.vfsHistoryV3) {
      undoBtn.dataset.vfsHistoryV3 = '1'; undoBtn.title = 'Desfazer'; undoBtn.setAttribute('aria-label', 'Desfazer')
      undoBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopImmediatePropagation()
        const snapshot = undo.pop()
        if (!snapshot) return toast('Nada para desfazer')
        const current = localStorage.getItem(KEY)
        if (current) redo.push(current)
        guard = true; nativeSetItem.call(localStorage, KEY, snapshot); guard = false
        toast('Desfeito'); setTimeout(() => location.reload(), 70)
      })
    }
    if (!redoBtn.dataset.vfsHistoryV3) {
      redoBtn.dataset.vfsHistoryV3 = '1'; redoBtn.title = 'Refazer'; redoBtn.setAttribute('aria-label', 'Refazer')
      redoBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopImmediatePropagation()
        const snapshot = redo.pop()
        if (!snapshot) return toast('Nada para refazer')
        const current = localStorage.getItem(KEY)
        if (current) undo.push(current)
        guard = true; nativeSetItem.call(localStorage, KEY, snapshot); guard = false
        toast('Refeito'); setTimeout(() => location.reload(), 70)
      })
    }
  }

  function openDb() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1)
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return dbPromise
  }

  async function saveBlob(id, file) {
    try {
      const db = await openDb()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(file, id)
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error)
      })
    } catch {}
  }

  async function getBlob(id) {
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly'); const request = tx.objectStore(STORE).get(id)
        request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error)
      })
    } catch { return null }
  }

  function sessionToken() {
    let token = sessionStorage.getItem(SESSION)
    if (!token) { token = crypto.randomUUID(); sessionStorage.setItem(SESSION, token) }
    return token
  }

  async function persistUpload(input) {
    if (!editor() || !input.files?.length) return
    const id = pid(); if (!id) return
    await new Promise((r) => setTimeout(r, 350))
    const list = projects(); const project = list.find((p) => p.id === id); if (!project) return
    const token = sessionToken(); const used = new Set(); let changed = false
    for (const file of [...input.files]) {
      const index = project.media.findIndex((m) => m.name === file.name && !used.has(m.id))
      if (index < 0) continue
      const asset = project.media[index]; used.add(asset.id)
      const persistentId = `${id}:${asset.id}`
      await saveBlob(persistentId, file)
      asset.persistentId = persistentId; asset.urlGeneration = token; changed = true
    }
    if (changed) write(list, false)
  }

  async function restoreMedia() {
    const id = pid(); if (!id) return
    const list = projects(); const project = list.find((p) => p.id === id); if (!project) return
    const token = sessionToken(); let changed = false
    for (const asset of project.media || []) {
      if (!asset.persistentId || asset.urlGeneration === token) continue
      const file = await getBlob(asset.persistentId); if (!file) continue
      asset.url = URL.createObjectURL(file); asset.urlGeneration = token; changed = true
    }
    if (changed) { write(list, false); setTimeout(() => location.reload(), 60) }
  }

  function patchText(id, patch) {
    if (!id) return
    const list = projects(); const project = list.find((p) => p.id === pid()); const text = project?.texts?.find((t) => t.id === id)
    if (!text) return
    Object.assign(text, patch)
    pendingText.set(id, { ...(pendingText.get(id) || {}), ...patch })
    write(list, true)
  }

  function refreshTextIds() {
    const project = projects().find((p) => p.id === pid()); if (!project) return
    const texts = project.texts || []
    document.querySelectorAll('.overlay-text').forEach((el, index) => {
      if (!el.dataset.textId) {
        const raw = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)?.textContent?.trim() || ''
        const found = texts.find((t) => t.text === raw) || texts[index]
        if (found) el.dataset.textId = found.id
      }
      if (!el.querySelector('.vfs-text-handle')) {
        const handle = document.createElement('span'); handle.className = 'vfs-text-handle'; handle.setAttribute('aria-hidden', 'true'); el.appendChild(handle)
      }
    })
  }

  function bindText() {
    if (!editor() || document.documentElement.dataset.vfsTextV3) return
    document.documentElement.dataset.vfsTextV3 = '1'
    document.addEventListener('pointerdown', (e) => {
      const target = e.target
      const el = target instanceof Element ? target.closest('.overlay-text') : null
      const stage = el?.closest('.video-stage')
      if (!el || !stage) return
      refreshTextIds()
      const style = getComputedStyle(el)
      active = { el, stage, id: el.dataset.textId, mode: target instanceof Element && target.classList.contains('vfs-text-handle') ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, x: parseFloat(style.left) || 50, y: parseFloat(style.top) || 50, size: parseFloat(style.fontSize) || 24, moved: false }
      el.classList.add('selected')
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    }, true)
    document.addEventListener('pointermove', (e) => {
      const d = active; if (!d) return
      const rect = d.stage.getBoundingClientRect(); const dx = e.clientX - d.sx; const dy = e.clientY - d.sy
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true
      if (d.mode === 'move') {
        const x = Math.max(3, Math.min(97, d.x + dx / Math.max(1, rect.width) * 100)); const y = Math.max(3, Math.min(97, d.y + dy / Math.max(1, rect.height) * 100))
        d.el.style.left = `${x}%`; d.el.style.top = `${y}%`; d.lastX = x; d.lastY = y
      } else {
        const size = Math.max(8, Math.min(160, d.size + (dx + dy) / 3)); d.el.style.fontSize = `${size}px`; d.lastSize = size
      }
      e.preventDefault(); e.stopPropagation()
    }, true)
    const end = (e) => {
      const d = active; if (!d) return
      if (d.moved) {
        if (d.id && d.mode === 'move') patchText(d.id, { x: d.lastX ?? d.x, y: d.lastY ?? d.y })
        if (d.id && d.mode === 'resize' && d.lastSize != null) patchText(d.id, { fontSize: Math.round(Math.max(14, Math.min(120, d.lastSize * 2))) })
      } else d.el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: e.clientX, clientY: e.clientY }))
      active = null; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    }
    document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true)
  }

  function replaceAudioButton(button) {
    if (button.dataset.vfsAudioV3) return
    const clone = button.cloneNode(true); button.replaceWith(clone); clone.dataset.vfsAudioV3 = '1'
    clone.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation()
      const row = clone.closest('.media-row'); const name = row?.querySelector('.media-meta strong')?.textContent?.trim() || 'audio'
      const project = projects().find((p) => p.id === pid()); const asset = project?.media?.find((m) => m.kind === 'audio' && m.name === name)
      if (!asset?.url) return
      clone.disabled = true; const old = clone.textContent; clone.textContent = 'Salvando...'
      try {
        const response = await fetch(asset.url); const blob = await response.blob()
        if (window.showSaveFilePicker) {
          const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : 'mp3'; const type = blob.type || (ext === 'wav' ? 'audio/wav' : 'audio/mpeg')
          const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Arquivo de áudio', accept: { [type]: [`.${ext}`] } }] })
          const stream = await handle.createWritable(); await stream.write(blob); await stream.close()
        } else {
          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500)
        }
        toast('Áudio salvo')
      } catch (error) {
        if (error?.name !== 'AbortError') { const a = document.createElement('a'); a.href = asset.url; a.download = name; document.body.appendChild(a); a.click(); a.remove() }
      } finally { clone.disabled = false; clone.textContent = old }
    })
  }

  function bindAudio() { document.querySelectorAll('.vfs-download-audio').forEach(replaceAudioButton) }

  function videoClips() { return (projects().find((p) => p.id === pid())?.clips || []).filter((c) => c.track === 'video') }

  function createLanes(width) {
    const wrapper = document.createElement('div'); wrapper.className = 'vfs-video-lanes'
    ;['Vídeo 1', 'Vídeo 2', 'Vídeo 3'].forEach((label, lane) => {
      const track = document.createElement('div'); track.className = 'timeline-track vfs-video-track'
      const labelEl = document.createElement('div'); labelEl.className = 'track-label'; labelEl.innerHTML = `<span>${label}</span>`
      const laneEl = document.createElement('div'); laneEl.className = 'track-lane vfs-video-lane'; laneEl.dataset.lane = String(lane); laneEl.style.width = `${width}px`
      track.append(labelEl, laneEl); wrapper.appendChild(track)
    })
    return wrapper
  }

  function bindLane(element) {
    if (element.dataset.vfsLaneV3) return
    element.dataset.vfsLaneV3 = '1'
    element.addEventListener('dragend', (e) => {
      const wrapper = document.querySelector('.vfs-video-lanes'); const id = element.dataset.vfsClipId; if (!wrapper || !id) return
      const lane = Math.max(0, Math.min(2, Math.floor((e.clientY - wrapper.getBoundingClientRect().top) / 55)))
      const target = wrapper.querySelector(`.vfs-video-lane[data-lane="${lane}"]`)
      if (target && element.parentElement !== target) target.appendChild(element)
      const list = projects(); const project = list.find((p) => p.id === pid()); const clip = project?.clips?.find((c) => c.id === id)
      if (clip) { clip.lane = lane; write(list, true) }
      toast(`Vídeo ${lane + 1}`)
    })
  }

  function buildLanes() {
    if (!editor() || building) return
    const scroll = document.querySelector('.timeline-scroll'); if (!scroll) return
    const original = [...scroll.querySelectorAll(':scope > .timeline-track')].find((t) => t.querySelector('.track-label')?.textContent?.includes('Vídeo'))
    if (!original) return
    const clips = videoClips(); if (!clips.length) return
    building = true
    const source = [...original.querySelectorAll('.timeline-clip')]
    let wrapper = scroll.querySelector('.vfs-video-lanes')
    if (!wrapper) {
      const width = Math.max(1000, parseFloat(original.querySelector('.track-lane')?.style.width || '1080')); wrapper = createLanes(width); original.replaceWith(wrapper)
    }
    source.forEach((el, index) => {
      const clip = clips[index]; if (!clip) return
      el.dataset.vfsClipId = clip.id; bindLane(el)
      const lane = Math.max(0, Math.min(2, Number(clip.lane || 0))); const target = wrapper.querySelector(`.vfs-video-lane[data-lane="${lane}"]`); if (target) target.appendChild(el)
    })
    original.remove()
    building = false
  }

  function styles() {
    if (document.getElementById('vfs-fix-v3-style')) return
    const style = document.createElement('style'); style.id = 'vfs-fix-v3-style'
    style.textContent = `
      .preview-area{overflow:hidden!important;min-width:0;min-height:0}
      .video-stage{max-width:calc(100% - 12px)!important;max-height:calc(100% - 12px)!important}
      .video-stage.landscape,.video-stage.square,.video-stage.portrait-feed,.video-stage.portrait{max-width:calc(100% - 12px)!important;max-height:calc(100% - 12px)!important}
      .overlay-text{touch-action:none!important;user-select:none!important;cursor:grab!important}
      .vfs-text-handle{position:absolute!important;right:-9px!important;bottom:-9px!important;width:12px!important;height:12px!important;border-radius:3px!important;background:#8b5cf6!important;border:2px solid #fff!important;z-index:20!important;cursor:nwse-resize!important}
      .vfs-video-lanes{display:flex;flex-direction:column;min-width:1080px}
      .vfs-video-lanes .timeline-track{height:55px!important}
      .vfs-video-lanes .track-lane{min-width:1000px}
      .vfs-video-lanes .track-label{font-size:8px}
      .vfs-fix-toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,8px);opacity:0;pointer-events:none;z-index:1000;padding:8px 12px;border-radius:9px;border:1px solid rgba(139,92,246,.35);background:#17131f;color:#eee;font:11px Inter,system-ui,sans-serif;transition:.16s}
      .vfs-fix-toast.show{opacity:1;transform:translate(-50%,0)}
    `
    document.head.appendChild(style)
  }

  function observe() { if (!editor()) return; styles(); historyButtons(); refreshTextIds(); bindText(); bindAudio(); buildLanes() }

  document.addEventListener('change', (e) => { const input = e.target; if (input instanceof HTMLInputElement && input.type === 'file') void persistUpload(input) }, true)
  if (editor()) {
    void restoreMedia()
    const observer = new MutationObserver(() => { if (!building) setTimeout(observe, 0) })
    observer.observe(document.body, { childList: true, subtree: true })
    observe()
  }
})()
