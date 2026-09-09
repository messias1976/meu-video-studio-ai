(() => {
  const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
  const MEDIA_DB = 'meu-video-studio-ai-media'
  const MEDIA_STORE = 'files'
  const VIEW_KEY = 'meu-video-studio-ai:editor-view:v1'
  const HISTORY_KEY = 'meu-video-studio-ai:editor-history:final'
  const nativeSetItem = Storage.prototype.setItem
  let dbPromise = null
  let restoring = false
  let textDrag = null
  let timelineDrag = null
  let raf = 0

  const isEditor = () => location.pathname.startsWith('/editor/')
  const projectId = () => location.pathname.match(/\/editor\/([^/]+)/)?.[1] || null
  const readProjects = () => { try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') } catch { return [] } }
  const currentProject = () => readProjects().find((p) => p.id === projectId()) || null

  function viewState() {
    try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') } catch { return {} }
  }
  function saveView(patch) {
    const next = { ...viewState(), ...patch }
    localStorage.setItem(VIEW_KEY, JSON.stringify(next))
  }

  function historyState() {
    try {
      const x = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '{}')
      return { undo: Array.isArray(x.undo) ? x.undo : [], redo: Array.isArray(x.redo) ? x.redo : [] }
    } catch { return { undo: [], redo: [] } }
  }
  function saveHistory(value) { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(value)) }
  function remember(previous, next) {
    if (restoring || !previous || previous === next) return
    const h = historyState()
    if (h.undo[h.undo.length - 1] !== previous) h.undo.push(previous)
    if (h.undo.length > 40) h.undo.shift()
    h.redo = []
    saveHistory(h)
  }
  Storage.prototype.setItem = function(key, value) {
    if (key === PROJECTS_KEY && !restoring) remember(this.getItem(key), value)
    return nativeSetItem.call(this, key, value)
  }
  function writeProjects(list, history = false) {
    const previous = localStorage.getItem(PROJECTS_KEY)
    const next = JSON.stringify(list)
    if (history) remember(previous, next)
    restoring = true
    nativeSetItem.call(localStorage, PROJECTS_KEY, next)
    restoring = false
  }

  function toast(message) {
    let t = document.querySelector('.vfs5-toast')
    if (!t) { t = document.createElement('div'); t.className = 'vfs5-toast'; document.body.appendChild(t) }
    t.textContent = message
    t.classList.add('show')
    clearTimeout(Number(t.dataset.timer || 0))
    t.dataset.timer = String(setTimeout(() => t.classList.remove('show'), 1300))
  }

  async function openDb() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(MEDIA_DB, 5)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }
  async function getFile(key) {
    if (!key) return null
    try {
      const db = await openDb()
      return await new Promise((resolve, reject) => {
        const req = db.transaction(MEDIA_STORE, 'readonly').objectStore(MEDIA_STORE).get(key)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
    } catch { return null }
  }
  async function putFile(key, file) {
    try {
      const db = await openDb()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, 'readwrite')
        tx.objectStore(MEDIA_STORE).put(file, key)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      return true
    } catch { return false }
  }

  async function persistUpload(input) {
    if (!isEditor() || !input.files?.length) return
    await new Promise((resolve) => setTimeout(resolve, 120))
    const id = projectId(); const list = readProjects(); const project = list.find((p) => p.id === id)
    if (!project) return
    let count = 0
    for (const file of [...input.files]) {
      const asset = project.media?.find((m) => m.name === file.name && !m.persistentId) || project.media?.find((m) => m.name === file.name)
      if (!asset) continue
      const key = `${id}:${asset.id}`
      if (await putFile(key, file)) { asset.persistentId = key; count += 1 }
    }
    if (count) writeProjects(list, false)
    if (count) toast(`${count} mídia(s) salva(s) na biblioteca local`)
  }
  function bindUploadPersistence() {
    if (document.documentElement.dataset.vfs5Uploads) return
    document.documentElement.dataset.vfs5Uploads = '1'
    document.addEventListener('change', (event) => {
      const input = event.target
      if (input instanceof HTMLInputElement && input.type === 'file') void persistUpload(input)
    }, true)
  }

  async function restoreMedia() {
    if (!isEditor()) return
    const id = projectId(); const list = readProjects(); const project = list.find((p) => p.id === id)
    if (!project) return
    let changed = false
    for (const asset of project.media || []) {
      if (!asset.persistentId) continue
      const file = await getFile(asset.persistentId)
      if (!(file instanceof Blob)) continue
      if (asset.url?.startsWith('blob:')) { try { URL.revokeObjectURL(asset.url) } catch {} }
      asset.url = URL.createObjectURL(file)
      changed = true
    }
    if (!changed) return
    restoring = true
    nativeSetItem.call(localStorage, PROJECTS_KEY, JSON.stringify(list))
    restoring = false
    applyCurrentMedia(project)
  }

  function selectedAssetName() {
    return document.querySelector('.canvas-toolbar > span')?.textContent?.trim() || ''
  }
  function applyCurrentMedia(project = currentProject()) {
    if (!project) return
    const name = selectedAssetName()
    const asset = project.media?.find((m) => m.name === name) || project.media?.find((m) => m.kind === 'video' || m.kind === 'image')
    if (!asset?.url) return
    const stage = document.querySelector('.video-stage')
    if (!stage) return
    let el = stage.querySelector('video, img')
    if (asset.kind === 'video') {
      if (!(el instanceof HTMLVideoElement)) {
        stage.querySelector('img')?.remove()
        el = document.createElement('video')
        el.playsInline = true
        el.controls = false
        stage.prepend(el)
      }
      if (el.src !== asset.url) { el.src = asset.url; el.load() }
    } else if (asset.kind === 'image') {
      if (!(el instanceof HTMLImageElement)) {
        stage.querySelector('video')?.remove()
        el = document.createElement('img')
        el.alt = asset.name
        stage.prepend(el)
      }
      if (el.src !== asset.url) el.src = asset.url
    }
  }

  function bindMediaSelection() {
    if (document.documentElement.dataset.vfs5Media) return
    document.documentElement.dataset.vfs5Media = '1'
    document.addEventListener('click', (event) => {
      const row = event.target instanceof Element ? event.target.closest('.media-row') : null
      if (!row || !isEditor()) return
      setTimeout(() => applyCurrentMedia(), 20)
    }, true)
  }

  function ensurePreviewViewport() {
    const area = document.querySelector('.preview-area')
    const stage = document.querySelector('.video-stage')
    if (!area || !stage) return
    if (!stage.parentElement?.classList.contains('vfs5-preview-viewport')) {
      const viewport = document.createElement('div')
      viewport.className = 'vfs5-preview-viewport'
      area.insertBefore(viewport, stage)
      viewport.appendChild(stage)
    }
    const viewport = stage.parentElement
    viewport.className = 'vfs5-preview-viewport'
    let controls = area.querySelector('.vfs5-zoom-controls')
    if (!controls) {
      controls = document.createElement('div')
      controls.className = 'vfs5-zoom-controls'
      controls.innerHTML = '<button type="button" data-zoom="out">−</button><button type="button" data-zoom="fit">Ajustar</button><span>100%</span><button type="button" data-zoom="in">+</button>'
      area.appendChild(controls)
      controls.addEventListener('click', (e) => {
        const button = e.target instanceof Element ? e.target.closest('button') : null
        if (!button) return
        let zoom = Number(viewState().zoom || 1)
        if (button.dataset.zoom === 'out') zoom = Math.max(.5, Number((zoom - .1).toFixed(2)))
        if (button.dataset.zoom === 'in') zoom = Math.min(3, Number((zoom + .1).toFixed(2)))
        if (button.dataset.zoom === 'fit') zoom = 1
        saveView({ zoom })
        applyZoom()
      })
    }
    applyZoom()
  }
  function applyZoom() {
    const stage = document.querySelector('.video-stage'); const viewport = document.querySelector('.vfs5-preview-viewport'); if (!stage || !viewport) return
    const zoom = Number(viewState().zoom || 1)
    stage.style.transform = `scale(${zoom})`
    stage.style.transformOrigin = 'center center'
    const label = document.querySelector('.vfs5-zoom-controls span'); if (label) label.textContent = `${Math.round(zoom * 100)}%`
  }

  function textId(el, index) {
    const p = currentProject(); if (!p) return null
    const raw = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE)?.textContent?.trim() || ''
    return el.dataset.vfs5TextId || p.texts?.find(t => t.text === raw)?.id || p.texts?.[index]?.id || null
  }
  function patchText(id, patch) {
    if (!id) return
    const list = readProjects(); const p = list.find(x => x.id === projectId()); const t = p?.texts?.find(x => x.id === id); if (!t) return
    Object.assign(t, patch); writeProjects(list, true)
  }
  function prepareTexts() {
    document.querySelectorAll('.overlay-text').forEach((el, index) => {
      if (!el.dataset.vfs5TextId) el.dataset.vfs5TextId = textId(el, index) || ''
      if (!el.querySelector('.vfs5-resize')) { const h = document.createElement('span'); h.className = 'vfs5-resize'; h.setAttribute('aria-hidden', 'true'); el.appendChild(h) }
    })
  }
  function bindText() {
    if (!isEditor() || document.documentElement.dataset.vfs5Text) return
    document.documentElement.dataset.vfs5Text = '1'
    document.addEventListener('pointerdown', (e) => {
      const target = e.target; const el = target instanceof Element ? target.closest('.overlay-text') : null; const stage = el?.closest('.video-stage'); if (!el || !stage) return
      prepareTexts()
      const rect = stage.getBoundingClientRect(); const style = getComputedStyle(el); const resize = target instanceof Element && target.classList.contains('vfs5-resize')
      textDrag = { el, id: el.dataset.vfs5TextId, rect, resize, sx: e.clientX, sy: e.clientY, x: parseFloat(style.left) || 50, y: parseFloat(style.top) || 50, size: parseFloat(style.fontSize) || 24, moved: false }
      el.classList.add('selected')
      e.preventDefault(); e.stopImmediatePropagation()
    }, true)
    document.addEventListener('pointermove', (e) => {
      const d = textDrag; if (!d) return
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true
      if (!d.resize) {
        d.lastX = Math.max(3, Math.min(97, d.x + dx / Math.max(1, d.rect.width) * 100))
        d.lastY = Math.max(3, Math.min(97, d.y + dy / Math.max(1, d.rect.height) * 100))
        d.el.style.left = `${d.lastX}%`; d.el.style.top = `${d.lastY}%`
      } else {
        d.lastSize = Math.max(10, Math.min(180, d.size + (dx + dy) / 2)); d.el.style.fontSize = `${d.lastSize}px`
      }
      e.preventDefault(); e.stopImmediatePropagation()
    }, true)
    const end = () => {
      const d = textDrag; if (!d) return
      if (d.moved && d.id) {
        if (!d.resize) patchText(d.id, { x: Number((d.lastX ?? d.x).toFixed(2)), y: Number((d.lastY ?? d.y).toFixed(2)) })
        else patchText(d.id, { fontSize: Math.round(Math.max(14, Math.min(120, (d.lastSize ?? d.size) * 2))) })
      }
      textDrag = null
    }
    document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true)
  }

  function bindHistory() {
    if (!isEditor()) return
    const buttons = [...document.querySelectorAll('.editor-top-actions > .icon-btn')]
    if (buttons.length < 2) return
    const [undo, redo] = buttons
    if (!undo.dataset.vfs5History) {
      undo.dataset.vfs5History = '1'; undo.title = 'Desfazer'
      undo.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); const h = historyState(); const s = h.undo.pop(); if (!s) return toast('Nada para desfazer'); const c = localStorage.getItem(PROJECTS_KEY); if (c) h.redo.push(c); saveHistory(h); restoring = true; nativeSetItem.call(localStorage, PROJECTS_KEY, s); restoring = false; toast('Desfeito'); setTimeout(() => location.reload(), 60) }, true)
    }
    if (!redo.dataset.vfs5History) {
      redo.dataset.vfs5History = '1'; redo.title = 'Refazer'
      redo.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); const h = historyState(); const s = h.redo.pop(); if (!s) return toast('Nada para refazer'); const c = localStorage.getItem(PROJECTS_KEY); if (c) h.undo.push(c); saveHistory(h); restoring = true; nativeSetItem.call(localStorage, PROJECTS_KEY, s); restoring = false; toast('Refeito'); setTimeout(() => location.reload(), 60) }, true)
    }
  }

  async function saveAudio(row, asset) {
    const file = await getFile(asset.persistentId)
    let blob = file instanceof Blob ? file : null
    if (!blob && asset.url) { try { blob = await (await fetch(asset.url)).blob() } catch {} }
    if (!blob) throw new Error('Áudio não encontrado. Envie-o novamente.')
    if (window.showSaveFilePicker) {
      const ext = asset.name.includes('.') ? asset.name.split('.').pop().toLowerCase() : 'mp3'
      const handle = await window.showSaveFilePicker({ suggestedName: asset.name || 'audio.mp3', types: [{ description: 'Áudio', accept: { [blob.type || 'audio/mpeg']: [`.${ext}`] } }] })
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close()
    } else {
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = asset.name || 'audio.mp3'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200)
    }
  }
  function bindAudioDownload() {
    if (!isEditor()) return
    document.querySelectorAll('.media-row').forEach(row => {
      if (row.querySelector('.vfs5-audio-download')) return
      const name = row.querySelector('.media-meta strong')?.textContent?.trim() || ''
      const asset = currentProject()?.media?.find(m => m.kind === 'audio' && m.name === name)
      if (!asset) return
      const b = document.createElement('button'); b.type = 'button'; b.className = 'vfs5-audio-download'; b.textContent = 'Baixar'
      b.onclick = async e => { e.preventDefault(); e.stopPropagation(); try { b.disabled = true; b.textContent = 'Salvando…'; await saveAudio(row, asset); toast('Áudio salvo'); } catch (err) { if (err?.name !== 'AbortError') toast(err instanceof Error ? err.message : 'Falha ao salvar áudio') } finally { b.disabled = false; b.textContent = 'Baixar' } }
      row.appendChild(b)
    })
  }

  function laneFor(clip) { return Math.max(0, Math.min(2, Number(clip?.lane ?? 0))) }
  function buildVideoLanes() {
    const scroll = document.querySelector('.timeline-scroll'); if (!scroll || scroll.querySelector('.vfs5-lanes')) return
    const original = [...scroll.querySelectorAll(':scope > .timeline-track')].find(t => t.querySelector('.track-label')?.textContent?.trim() === 'Vídeo')
    const project = currentProject(); if (!original || !project) return
    const clips = (project.clips || []).filter(c => c.track === 'video')
    const dom = [...original.querySelectorAll('.timeline-clip')]
    if (!clips.length || dom.length !== clips.length) return
    const width = original.querySelector('.track-lane')?.style.width || '1200px'
    const wrapper = document.createElement('div'); wrapper.className = 'vfs5-lanes'
    for (let lane = 0; lane < 3; lane++) {
      const track = document.createElement('div'); track.className = 'timeline-track vfs5-track'
      const label = document.createElement('div'); label.className = 'track-label'; label.textContent = `Vídeo ${lane + 1}`
      const laneEl = document.createElement('div'); laneEl.className = 'track-lane vfs5-lane'; laneEl.dataset.lane = String(lane); laneEl.style.width = width
      track.append(label, laneEl); wrapper.appendChild(track)
    }
    original.replaceWith(wrapper)
    dom.forEach((el, i) => { const c = clips[i]; if (!c) return; el.dataset.vfs5ClipId = c.id; el.draggable = true; wrapper.querySelector(`.vfs5-lane[data-lane="${laneFor(c)}"]`)?.appendChild(el) })
    wrapper.addEventListener('dragstart', e => { const el = e.target instanceof Element ? e.target.closest('.timeline-clip') : null; if (el) timelineDrag = { id: el.dataset.vfs5ClipId, el } })
    wrapper.addEventListener('dragover', e => { if (e.target instanceof Element && e.target.closest('.vfs5-lane')) e.preventDefault() })
    wrapper.addEventListener('drop', e => {
      e.preventDefault(); const laneEl = e.target instanceof Element ? e.target.closest('.vfs5-lane') : null; if (!laneEl || !timelineDrag?.id) return
      const list = readProjects(); const p = list.find(x => x.id === projectId()); const c = p?.clips?.find(x => x.id === timelineDrag.id); if (!c) return
      c.lane = Number(laneEl.dataset.lane || 0); c.start = Number(Math.max(0, (e.clientX - laneEl.getBoundingClientRect().left) / 60).toFixed(2)); writeProjects(list, true); timelineDrag = null; toast(`Vídeo ${c.lane + 1}`); setTimeout(() => location.reload(), 60)
    })
  }

  function bindPlayhead() {
    const scroll = document.querySelector('.timeline-scroll'); if (!scroll) return
    let needle = scroll.querySelector('.vfs5-playhead')
    if (!needle) { needle = document.createElement('div'); needle.className = 'vfs5-playhead'; needle.innerHTML = '<span></span>'; scroll.appendChild(needle) }
    const project = currentProject(); if (!project) return
    const duration = Math.max(20, ...(project.clips || []).map(c => c.start + c.duration), 20)
    const px = 60
    const left = 78 + Math.max(0, Math.min(duration, Number(project.playhead || 0))) * px
    needle.style.left = `${left}px`
    needle.style.top = '24px'
    needle.style.height = `${3 * 55 + 1}px`
    const video = document.querySelector('.video-stage video')
    if (video && !video.dataset.vfs5Playhead) {
      video.dataset.vfs5Playhead = '1'
      video.addEventListener('timeupdate', () => {
        moveNeedle(video.currentTime)
      })
      video.addEventListener('loadedmetadata', () => moveNeedle(video.currentTime))
    }
    if (!needle.dataset.vfs5Drag) {
      needle.dataset.vfs5Drag = '1'
      needle.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); timelineDrag = { playhead: true, needle }
        needle.setPointerCapture?.(e.pointerId)
      })
    }
  }
  function moveNeedle(time) {
    const n = document.querySelector('.vfs5-playhead'); if (!n) return
    const duration = Math.max(20, ...(currentProject()?.clips || []).map(c => c.start + c.duration), 20); const clamped = Math.max(0, Math.min(duration, time)); n.style.left = `${78 + clamped * 60}px`
  }
  function bindNeedleMove() {
    if (document.documentElement.dataset.vfs5Needle) return
    document.documentElement.dataset.vfs5Needle = '1'
    document.addEventListener('pointermove', e => {
      if (!timelineDrag?.playhead) return
      const lane = document.querySelector('.vfs5-lane') || document.querySelector('.track-lane'); if (!lane) return
      const time = Math.max(0, (e.clientX - lane.getBoundingClientRect().left) / 60)
      moveNeedle(time)
      const video = document.querySelector('.video-stage video'); if (video) video.currentTime = time
      const p = currentProject(); if (p) { const list = readProjects(); const cp = list.find(x => x.id === projectId()); if (cp) { cp.playhead = time; writeProjects(list, false) } }
    }, true)
    document.addEventListener('pointerup', () => { if (timelineDrag?.playhead) timelineDrag = null }, true)
  }

  function css() {
    if (document.getElementById('vfs5-css')) return
    const s = document.createElement('style'); s.id = 'vfs5-css'
    s.textContent = `
      html,body,#root{height:100%;min-height:0}
      body{margin:0;overflow:hidden}
      .editor-shell{height:100vh!important;min-height:0!important;overflow:hidden!important}
      .editor-body{min-height:0!important;overflow:hidden!important}
      .editor-center{min-height:0!important;overflow:hidden!important}
      .preview-area{position:relative!important;overflow:auto!important;min-height:0!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:24px!important}
      .vfs5-preview-viewport{position:relative;min-width:100%;min-height:100%;display:flex;align-items:center;justify-content:center;overflow:auto}
      .vfs5-preview-viewport>.video-stage{flex:none}
      .video-stage{max-width:none!important;max-height:none!important}
      .vfs5-zoom-controls{position:absolute;right:12px;bottom:10px;z-index:50;display:flex;align-items:center;gap:4px;padding:4px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(10,10,13,.88);backdrop-filter:blur(8px)}
      .vfs5-zoom-controls button{height:26px;min-width:28px;border:1px solid rgba(255,255,255,.08);background:#17171c;color:#ddd;border-radius:6px;font-size:11px;cursor:pointer}.vfs5-zoom-controls button:hover{background:#24242b;color:#fff}.vfs5-zoom-controls span{min-width:42px;text-align:center;color:#999;font-size:9px}
      .overlay-text{touch-action:none!important;user-select:none!important;cursor:grab!important;z-index:20!important}.vfs5-resize{position:absolute;right:-9px;bottom:-9px;width:12px;height:12px;border-radius:3px;background:#8b5cf6;border:2px solid #fff;cursor:nwse-resize;z-index:30}
      .vfs5-audio-download{margin-left:4px;border:1px solid rgba(139,92,246,.3);background:#17131f;color:#ded5ff;border-radius:7px;padding:5px 7px;font-size:9px;cursor:pointer}.vfs5-audio-download:hover{background:#241b31;color:#fff}
      .vfs5-lanes{display:flex;flex-direction:column;min-width:1080px}.vfs5-track{height:55px!important}.vfs5-lane{min-width:1000px!important}
      .vfs5-playhead{position:absolute;width:2px;background:#ff4d6d;z-index:100;pointer-events:auto;cursor:ew-resize;box-shadow:0 0 8px rgba(255,77,109,.65)}.vfs5-playhead span{position:absolute;top:-7px;left:-5px;width:12px;height:12px;border-radius:2px 2px 6px 6px;background:#ff4d6d}.vfs5-playhead span:after{content:'';position:absolute;left:4px;top:3px;width:0;height:0;border-left:2px solid transparent;border-right:2px solid transparent;border-top:4px solid #fff}
      .vfs5-toast{position:fixed;left:50%;bottom:20px;transform:translate(-50%,8px);opacity:0;pointer-events:none;z-index:3000;padding:8px 12px;border:1px solid rgba(139,92,246,.35);border-radius:9px;background:#17131f;color:#eee;font:11px Inter,system-ui,sans-serif;transition:.18s}.vfs5-toast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:800px){.preview-area{padding:12px!important}.vfs5-zoom-controls{right:6px;bottom:6px}}
    `
    document.head.appendChild(s)
  }

  function observe() {
    if (!isEditor()) return
    css(); bindUploadPersistence(); bindMediaSelection(); bindHistory(); bindText(); bindAudioDownload(); ensurePreviewViewport(); prepareTexts(); buildVideoLanes(); bindPlayhead(); bindNeedleMove(); applyCurrentMedia()
  }
  const observer = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(observe) })
  observer.observe(document.body, { childList: true, subtree: true })
  observe()
  setTimeout(() => { void restoreMedia() }, 250)
})();
