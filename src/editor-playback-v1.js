(() => {
  const PROJECTS_KEY = 'meu-video-studio-ai:projects:v2'
  const MEDIA_DB = 'meu-video-studio-ai-media'
  const MEDIA_STORE = 'files'
  const PX_PER_SECOND = 60
  const VIEW_KEY = 'meu-video-studio-ai:editor-view:v1'
  let dbPromise = null
  let playing = false
  let raf = 0
  let lastTs = 0
  let currentUrl = null
  let currentAssetId = null

  const isEditor = () => location.pathname.startsWith('/editor/')
  const projectId = () => location.pathname.match(/\/editor\/([^/]+)/)?.[1] || null
  const readProjects = () => { try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') } catch { return [] } }
  const getProject = () => readProjects().find((p) => p.id === projectId()) || null
  const view = () => { try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') } catch { return {} } }
  const saveView = (patch) => localStorage.setItem(VIEW_KEY, JSON.stringify({ ...view(), ...patch }))
  const clampTime = (value, project = getProject()) => {
    if (!project) return 0
    const duration = Math.max(0.1, ...((project.clips || []).map((c) => (c.start || 0) + (c.duration || 0))), 0.1)
    return Math.max(0, Math.min(duration, Number(value) || 0))
  }
  const selectedName = () => document.querySelector('.canvas-toolbar > span')?.textContent?.trim() || ''

  function writePlayhead(time) {
    const p = getProject()
    if (!p) return
    const next = clampTime(time, p)
    const list = readProjects()
    const project = list.find((x) => x.id === projectId())
    if (!project) return
    project.playhead = next
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)) } catch {}
    moveNeedle(next)
    syncVideo(next, project)
    updateControls(next, project)
  }

  function updateControls(time, project) {
    const inputs = [...document.querySelectorAll('.playback-bar input[type="range"]')]
    const duration = Math.max(0.1, ...((project?.clips || []).map((c) => (c.start || 0) + (c.duration || 0))), 0.1)
    for (const input of inputs) {
      input.min = '0'; input.max = String(duration); input.step = '0.01'; input.value = String(time)
    }
    const timeEls = [...document.querySelectorAll('.playback-bar')].flatMap((bar) => [...bar.querySelectorAll('span')])
    if (timeEls.length >= 2) {
      timeEls[0].textContent = formatTime(time)
      timeEls[timeEls.length - 1].textContent = formatTime(duration)
    }
    const play = document.querySelector('.play-circle')
    if (play) play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir')
  }

  function formatTime(value) {
    const s = Math.max(0, Math.floor(Number(value) || 0))
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  async function openDb() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(MEDIA_DB, 6)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }

  async function getStoredFile(key) {
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

  async function resolveAsset(asset) {
    if (!asset) return null
    if (asset.url && !asset.url.startsWith('blob:')) return asset.url
    if (asset.url && asset.url.startsWith('blob:')) return asset.url
    if (asset.persistentId) {
      const file = await getStoredFile(asset.persistentId)
      if (file instanceof Blob) {
        if (currentUrl) URL.revokeObjectURL(currentUrl)
        currentUrl = URL.createObjectURL(file)
        return currentUrl
      }
    }
    return asset.url || null
  }

  function ensureStageMedia(kind) {
    const stage = document.querySelector('.video-stage')
    if (!stage) return null
    let element = stage.querySelector('video, img')
    if (kind === 'video') {
      if (!(element instanceof HTMLVideoElement)) {
        stage.querySelector('img')?.remove()
        element = document.createElement('video')
        element.playsInline = true
        element.muted = false
        element.controls = false
        element.preload = 'metadata'
        element.style.position = 'relative'
        element.style.zIndex = '1'
        stage.prepend(element)
      }
    } else {
      if (!(element instanceof HTMLImageElement)) {
        stage.querySelector('video')?.remove()
        element = document.createElement('img')
        element.alt = 'Mídia do projeto'
        element.style.position = 'relative'
        element.style.zIndex = '1'
        stage.prepend(element)
      }
    }
    return element
  }

  async function showAsset(asset, project) {
    if (!asset) return
    const url = await resolveAsset(asset)
    if (!url) return
    const element = ensureStageMedia(asset.kind)
    if (!element) return
    currentAssetId = asset.id
    if (element.src !== url) {
      element.src = url
      if (element instanceof HTMLVideoElement) element.load()
    }
    if (asset.kind === 'video' && element instanceof HTMLVideoElement) {
      const clip = (project.clips || []).find((c) => c.assetId === asset.id && c.track === 'video')
      const start = clip?.start || 0
      const local = Math.max(0, (project.playhead || 0) - start)
      if (Number.isFinite(element.duration) && element.duration > 0) element.currentTime = Math.min(local, Math.max(0, element.duration - 0.01))
    }
  }

  function assetForPlayhead(project, time) {
    const clips = (project.clips || []).filter((c) => c.track === 'video').sort((a, b) => (a.lane || 0) - (b.lane || 0) || a.start - b.start)
    const hit = clips.find((clip) => time >= (clip.start || 0) && time < (clip.start || 0) + (clip.duration || 0))
    if (hit) return project.media?.find((m) => m.id === hit.assetId) || null
    return project.media?.find((m) => m.kind === 'video' || m.kind === 'image') || null
  }

  async function syncVideo(time, project = getProject()) {
    if (!project) return
    const asset = assetForPlayhead(project, time) || project.media?.find((m) => m.id === currentAssetId)
    if (!asset) return
    await showAsset(asset, project)
    const element = document.querySelector('.video-stage video')
    const clip = (project.clips || []).find((c) => c.assetId === asset.id && c.track === 'video' && time >= c.start && time <= c.start + c.duration)
    if (element instanceof HTMLVideoElement && clip) {
      const local = Math.max(0, time - clip.start)
      if (Number.isFinite(element.duration) && element.duration > 0 && Math.abs(element.currentTime - local) > 0.08) {
        try { element.currentTime = Math.min(local, Math.max(0, element.duration - 0.01)) } catch {}
      }
    }
  }

  function makeNeedle() {
    const scroll = document.querySelector('.timeline-scroll')
    if (!scroll) return null
    let needle = scroll.querySelector('.vfs6-playhead')
    if (!needle) {
      needle = document.createElement('div')
      needle.className = 'vfs6-playhead'
      needle.innerHTML = '<i></i>'
      scroll.appendChild(needle)
    }
    return needle
  }

  function moveNeedle(time) {
    const needle = makeNeedle()
    if (!needle) return
    needle.style.left = `${78 + clampTime(time) * PX_PER_SECOND}px`
    needle.style.top = '0px'
    const tracks = document.querySelectorAll('.timeline-scroll .timeline-track')
    const h = Math.max(105, tracks.length * 55 + 24)
    needle.style.height = `${h}px`
  }

  function seekFromClientX(clientX) {
    const scroll = document.querySelector('.timeline-scroll')
    const lane = scroll?.querySelector('.track-lane') || scroll?.querySelector('.vfs5-lane') || scroll?.querySelector('.vfs5-lanes')
    if (!scroll) return
    const rect = (lane || scroll).getBoundingClientRect()
    const localX = clientX - rect.left
    const time = Math.max(0, localX / PX_PER_SECOND)
    writePlayhead(time)
  }

  function bindNeedleAndRuler() {
    const scroll = document.querySelector('.timeline-scroll')
    if (!scroll || scroll.dataset.vfs6SeekBound) return
    scroll.dataset.vfs6SeekBound = '1'
    scroll.addEventListener('pointerdown', (e) => {
      const target = e.target
      if (target instanceof Element && target.closest('.timeline-clip,button')) return
      if (target instanceof Element && (target.closest('.time-ruler') || target.closest('.track-lane') || target.closest('.vfs6-playhead'))) {
        e.preventDefault()
        seekFromClientX(e.clientX)
      }
    })
    let scrub = false
    scroll.addEventListener('pointermove', (e) => { if (scrub) { e.preventDefault(); seekFromClientX(e.clientX) } })
    scroll.addEventListener('pointerdown', (e) => { if (e.target instanceof Element && e.target.closest('.vfs6-playhead')) scrub = true }, true)
    document.addEventListener('pointerup', () => { scrub = false }, true)
  }

  function stopVideo() {
    const video = document.querySelector('.video-stage video')
    if (video instanceof HTMLVideoElement) video.pause()
  }

  async function togglePlay() {
    const project = getProject()
    if (!project) return
    playing = !playing
    if (!playing) {
      stopVideo()
      cancelAnimationFrame(raf)
      updateControls(project.playhead || 0, project)
      return
    }
    let time = Number(project.playhead || 0)
    const duration = Math.max(0.1, ...((project.clips || []).map((c) => (c.start || 0) + (c.duration || 0))), 0.1)
    if (time >= duration - 0.01) time = 0
    lastTs = performance.now()
    const frame = async (ts) => {
      if (!playing) return
      const delta = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000))
      lastTs = ts
      time += delta
      if (time >= duration) { time = duration; playing = false }
      const list = readProjects()
      const p = list.find((x) => x.id === projectId())
      if (p) { p.playhead = time; try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)) } catch {} }
      await syncVideo(time, p || project)
      moveNeedle(time)
      updateControls(time, p || project)
      if (playing) raf = requestAnimationFrame(frame)
      else stopVideo()
    }
    raf = requestAnimationFrame(frame)
  }

  function bindPlayButton() {
    const button = document.querySelector('.play-circle')
    if (!button || button.dataset.vfs6Play) return
    button.dataset.vfs6Play = '1'
    button.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); void togglePlay() }, true)
  }

  function bindPlaybackRange() {
    document.querySelectorAll('.playback-bar input[type="range"]').forEach((input) => {
      if (input.dataset.vfs6Range) return
      input.dataset.vfs6Range = '1'
      input.addEventListener('input', (e) => {
        e.stopImmediatePropagation()
        writePlayhead(Number(input.value))
      }, true)
    })
  }

  function bindMediaRows() {
    if (document.body.dataset.vfs6MediaBound) return
    document.body.dataset.vfs6MediaBound = '1'
    document.addEventListener('click', (e) => {
      const row = e.target instanceof Element ? e.target.closest('.media-row') : null
      if (!row) return
      const name = row.querySelector('.media-meta strong')?.textContent?.trim() || ''
      const p = getProject()
      if (!p) return
      const asset = p.media?.find((m) => m.name === name)
      if (asset) { const list = readProjects(); const cp = list.find((x) => x.id === p.id); if (cp) cp.playhead = 0; try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)) } catch {}; void showAsset(asset, p) }
    }, true)
  }

  function bindTimelineClipClicks() {
    if (document.body.dataset.vfs6ClipBound) return
    document.body.dataset.vfs6ClipBound = '1'
    document.addEventListener('click', (e) => {
      const clipEl = e.target instanceof Element ? e.target.closest('.timeline-clip') : null
      if (!clipEl) return
      const name = clipEl.querySelector('span')?.textContent?.trim() || ''
      const p = getProject(); if (!p) return
      const asset = p.media?.find((m) => m.name === name)
      const clip = p.clips?.find((c) => c.assetId === asset?.id && c.track === 'video')
      if (clip) { writePlayhead(clip.start || 0); void showAsset(asset, p) }
    }, true)
  }

  function css() {
    if (document.getElementById('vfs6-css')) return
    const s = document.createElement('style')
    s.id = 'vfs6-css'
    s.textContent = `
      html,body,#root{height:100%;margin:0}
      .timeline-scroll{position:relative!important;overflow:auto!important}
      .vfs6-playhead{position:absolute!important;z-index:999!important;top:0!important;width:2px!important;background:#ff3b61!important;pointer-events:auto!important;box-shadow:0 0 8px rgba(255,59,97,.7)!important}
      .vfs6-playhead i{position:absolute;top:0;left:-6px;width:14px;height:14px;background:#ff3b61;clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)}
      .video-stage video,.video-stage img{position:relative;z-index:1}
      .preview-area{overflow:auto!important;position:relative!important}
      .vfs5-preview-viewport{overflow:auto!important;max-width:100%!important;max-height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:30px;box-sizing:border-box}
      .vfs5-preview-viewport .video-stage{flex:none!important}
    `
    document.head.appendChild(s)
  }

  async function observe() {
    if (!isEditor()) return
    css()
    bindPlayButton()
    bindPlaybackRange()
    bindMediaRows()
    bindTimelineClipClicks()
    bindNeedleAndRuler()
    const p = getProject()
    if (p) {
      const time = clampTime(p.playhead || 0, p)
      updateControls(time, p)
      moveNeedle(time)
      await syncVideo(time, p)
    }
  }

  const mo = new MutationObserver(() => { clearTimeout(window.__vfs6Timer); window.__vfs6Timer = setTimeout(() => void observe(), 60) })
  mo.observe(document.body, { childList: true, subtree: true })
  void observe()
})()
