(() => {
  const KEY = 'meu-video-studio-ai:projects:v2'
  const DB_NAME = 'meu-video-studio-ai-media'
  const STORE = 'files'
  const VIEW_KEY = 'meu-video-studio-ai:editor-view:v2'
  const PX = 60
  let dbPromise = null
  let raf = 0
  let playing = false
  let selectedId = null
  let objectUrls = new Map()

  const editor = () => location.pathname.startsWith('/editor/')
  const pid = () => location.pathname.match(/\/editor\/([^/]+)/)?.[1] || null
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
  const project = () => read().find(p => p.id === pid()) || null
  const duration = p => Math.max(0.1, ...((p?.clips || []).map(c => Number(c.start || 0) + Number(c.duration || 0))), 0.1)
  const fmt = t => { const s = Math.max(0, Math.floor(Number(t) || 0)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }
  const saveProject = mutate => { const list = read(); const p = list.find(x => x.id === pid()); if (!p) return; mutate(p); localStorage.setItem(KEY, JSON.stringify(list)) }

  async function db() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 10)
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    return dbPromise
  }

  async function getFile(key) {
    if (!key) return null
    try { const d = await db(); return await new Promise((resolve,reject) => { const r=d.transaction(STORE,'readonly').objectStore(STORE).get(key); r.onsuccess=()=>resolve(r.result||null); r.onerror=()=>reject(r.error) }) } catch { return null }
  }

  async function resolveAsset(asset) {
    if (!asset) return null
    const cached = objectUrls.get(asset.id)
    if (cached) return cached
    if (asset.persistentId) {
      const f = await getFile(asset.persistentId)
      if (f instanceof Blob) {
        const u = URL.createObjectURL(f)
        objectUrls.set(asset.id, u)
        return u
      }
    }
    return asset.url || null
  }

  function stage() { return document.querySelector('.video-stage') }

  async function showAsset(asset, time = 0) {
    const s = stage(); if (!s || !asset) return false
    const url = await resolveAsset(asset); if (!url) return false
    let el = s.querySelector('video, img')

    if (asset.kind === 'video') {
      if (!(el instanceof HTMLVideoElement)) {
        s.querySelector('img')?.remove()
        el = document.createElement('video')
        el.playsInline = true
        el.controls = false
        el.preload = 'auto'
        el.setAttribute('aria-label', asset.name)
        s.prepend(el)
      }
      if (el.src !== url) { el.src = url; el.load() }
      const clip = project()?.clips?.find(c => c.assetId === asset.id && c.track === 'video' && time >= Number(c.start || 0) && time < Number(c.start || 0) + Number(c.duration || 0))
      const local = Math.max(0, time - Number(clip?.start || 0))
      if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
        try { el.currentTime = Math.min(local, Math.max(0, el.duration - 0.01)) } catch {}
      }
    } else if (asset.kind === 'image') {
      if (!(el instanceof HTMLImageElement)) {
        s.querySelector('video')?.remove()
        el = document.createElement('img')
        el.alt = asset.name
        el.draggable = false
        s.prepend(el)
      }
      if (el.src !== url) el.src = url
    }

    s.querySelector('.preview-empty')?.remove()
    s.dataset.activeAssetId = asset.id
    s.dataset.activeAssetKind = asset.kind
    return true
  }

  function clipAt(p, t) {
    const cs = (p?.clips || [])
      .filter(c => c.track === 'video')
      .sort((a,b) => Number(a.start || 0) - Number(b.start || 0) || Number(b.lane || 0) - Number(a.lane || 0))
    return cs.find(c => t >= Number(c.start || 0) && t < Number(c.start || 0) + Number(c.duration || 0)) || null
  }

  async function sync(t, persist = true) {
    const p = project(); if (!p) return
    const next = Math.max(0, Math.min(duration(p), Number(t) || 0))
    if (persist) saveProject(x => x.playhead = next)
    drawNeedle(next)
    drawReadout(next, p)

    const c = clipAt(p, next)
    if (!c) {
      const v = document.querySelector('.video-stage video')
      if (v instanceof HTMLVideoElement) v.pause()
      return
    }

    const a = p.media?.find(m => m.id === c.assetId)
    if (!a) return
    selectedId = a.id
    await showAsset(a, next)

    const v = document.querySelector('.video-stage video')
    if (a.kind === 'video' && v instanceof HTMLVideoElement && playing) {
      try { await v.play() } catch {}
    } else if (a.kind === 'image' && v instanceof HTMLVideoElement) {
      v.pause()
    }
  }

  function needle() {
    const sc = document.querySelector('.timeline-scroll'); if (!sc) return null
    let n = sc.querySelector('.vfs-v2-needle')
    if (!n) {
      n = document.createElement('div')
      n.className = 'vfs-v2-needle'
      n.innerHTML = '<b></b><span></span>'
      sc.appendChild(n)
    }
    return n
  }

  function drawNeedle(t) {
    const n = needle(); if (!n) return
    const sc = document.querySelector('.timeline-scroll')
    n.style.left = `${78 + t * PX}px`
    n.style.top = '24px'
    n.style.height = `${Math.max(165, sc?.scrollHeight ? sc.scrollHeight - 24 : 165)}px`
    const s = n.querySelector('span'); if (s) s.textContent = fmt(t)
  }

  function drawReadout(t,p) {
    document.querySelectorAll('.playback-bar').forEach(bar => {
      const spans = bar.querySelectorAll('span')
      if (spans[0]) spans[0].textContent = fmt(t)
      if (spans[spans.length-1]) spans[spans.length-1].textContent = fmt(duration(p))
    })
    const z = document.querySelector('.vfs-v2-status'); if (z) z.textContent = `${fmt(t)} / ${fmt(duration(p))}`
  }

  function setByPointer(clientX) {
    const sc = document.querySelector('.timeline-scroll'); if (!sc) return
    const left = sc.getBoundingClientRect().left - sc.scrollLeft + 78
    const t = Math.max(0, (clientX - left) / PX)
    void sync(t, true)
  }

  function bindTimeline() {
    const sc = document.querySelector('.timeline-scroll')
    if (!sc || sc.dataset.vfsV2Timeline) return
    sc.dataset.vfsV2Timeline = '1'

    const seek = e => {
      const target = e.target
      if (target instanceof Element && target.closest('.timeline-clip,button')) return
      if (target instanceof Element && target.closest('.time-ruler,.track-lane,.vfs-v2-needle')) {
        e.preventDefault()
        try { sc.setPointerCapture?.(e.pointerId) } catch {}
        setByPointer(e.clientX)
      }
    }

    sc.addEventListener('pointerdown', seek, true)
    sc.addEventListener('pointermove', e => {
      if (sc.hasPointerCapture?.(e.pointerId)) setByPointer(e.clientX)
    }, true)
    sc.addEventListener('pointerup', e => {
      try { sc.releasePointerCapture?.(e.pointerId) } catch {}
    }, true)
  }

  function bindPlay() {
    const b = document.querySelector('.play-circle'); if (!b || b.dataset.vfsV2Play) return
    b.dataset.vfsV2Play = '1'
    b.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); void toggle() }, true)
  }

  async function toggle() {
    const p = project(); if (!p) return

    if (playing) {
      playing = false
      cancelAnimationFrame(raf)
      const v = document.querySelector('.video-stage video')
      if (v instanceof HTMLVideoElement) v.pause()
      return
    }

    let t = Number(p.playhead || 0)
    let total = duration(p)
    if (t >= total - 0.001) {
      t = 0
      saveProject(x => x.playhead = 0)
    }

    playing = true
    await sync(t, true)
    total = duration(project())
    const start = performance.now() - t * 1000

    const loop = async now => {
      if (!playing) return
      const cp = project()
      if (!cp) { playing = false; return }
      total = duration(cp)
      t = Math.max(0, (now - start) / 1000)

      if (t >= total) {
        playing = false
        cancelAnimationFrame(raf)
        saveProject(x => x.playhead = 0)
        await sync(0, false)
        drawNeedle(0)
        drawReadout(0, cp)
        const v = document.querySelector('.video-stage video')
        if (v instanceof HTMLVideoElement) {
          v.pause()
          try { v.currentTime = 0 } catch {}
        }
        return
      }

      await sync(t, true)
      if (playing) raf = requestAnimationFrame(loop)
    }

    const v = document.querySelector('.video-stage video')
    if (v instanceof HTMLVideoElement) { try { await v.play() } catch {} }
    raf = requestAnimationFrame(loop)
  }

  function bindRange() {
    document.querySelectorAll('.playback-bar input[type="range"]').forEach(r => {
      if (r.dataset.vfsV2Range) return
      r.dataset.vfsV2Range = '1'
      r.addEventListener('input', e => { e.stopImmediatePropagation(); void sync(Number(r.value), true) }, true)
    })
  }

  function bindMedia() {
    if (document.body.dataset.vfsV2Media) return
    document.body.dataset.vfsV2Media = '1'
    document.addEventListener('click', e => {
      const row = e.target instanceof Element ? e.target.closest('.media-row') : null
      if (!row) return
      const name = row.querySelector('.media-meta strong')?.textContent?.trim() || ''
      const p = project(); const a = p?.media?.find(m => m.name === name)
      if (a) { selectedId = a.id; void showAsset(a, Number(p?.playhead || 0)) }
    }, true)

    document.addEventListener('dblclick', e => {
      const row = e.target instanceof Element ? e.target.closest('.media-row') : null
      if (!row) return
      const name = row.querySelector('.media-meta strong')?.textContent?.trim() || ''
      addMediaByName(name)
    }, true)
  }

  function addMediaByName(name) {
    const list = read(); const p = list.find(x => x.id === pid()); if (!p) return
    const a = p.media?.find(m => m.name === name)
    if (!a || a.kind === 'audio') return
    const end = Math.max(0, ...p.clips.filter(c => c.track === 'video').map(c => Number(c.start || 0) + Number(c.duration || 0)))
    const clipDuration = Math.max(0.5, Number(a.duration) || 5)
    p.clips.push({ id: crypto.randomUUID(), assetId: a.id, start: end, duration: clipDuration, track: 'video' })
    p.playhead = end
    localStorage.setItem(KEY, JSON.stringify(list))
    void sync(end, false)
    toast('Mídia adicionada à Timeline')
  }

  function addLibraryButtons() {
    document.querySelectorAll('.media-row').forEach(row => {
      if (row.querySelector('.vfs-v2-add')) return
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'vfs-v2-add'
      b.textContent = 'Adicionar'
      b.title = 'Adicionar à Timeline'
      b.onclick = e => {
        e.preventDefault(); e.stopPropagation()
        const n = row.querySelector('.media-meta strong')?.textContent?.trim() || ''
        addMediaByName(n)
      }
      row.appendChild(b)
    })
  }

  async function restoreAll() {
    const p = project(); if (!p) return
    for (const a of p.media || []) { if (a.persistentId) await resolveAsset(a) }
    const t = Number(p.playhead || 0)
    const c = clipAt(p, t)
    const a = c ? p.media?.find(m => m.id === c.assetId) : p.media?.find(m => m.id === selectedId) || p.media?.find(m => m.kind === 'video' || m.kind === 'image')
    if (a) await showAsset(a, t)
  }

  function zoomPan() {
    const area = document.querySelector('.preview-area')
    const vp = document.querySelector('.vfs5-preview-viewport')
    const s = stage(); if (!area || !s || !vp) return
    let controls = area.querySelector('.vfs-v2-zoom')
    if (!controls) {
      controls = document.createElement('div')
      controls.className = 'vfs-v2-zoom'
      controls.innerHTML = '<button data-z="-">−</button><span>100%</span><button data-z="fit">Ajustar</button><button data-z="+">+</button>'
      area.appendChild(controls)
      controls.onclick = e => {
        const b = e.target instanceof Element ? e.target.closest('button') : null; if (!b) return
        let z = Number(localStorage.getItem(VIEW_KEY) || 1)
        if (b.dataset.z === '-') z = Math.max(.5, z-.1)
        if (b.dataset.z === '+') z = Math.min(3, z+.1)
        if (b.dataset.z === 'fit') z = 1
        localStorage.setItem(VIEW_KEY, String(z))
        s.style.transform = `scale(${z})`
        const span = controls.querySelector('span'); if (span) span.textContent = `${Math.round(z*100)}%`
      }
    }
    const z = Number(localStorage.getItem(VIEW_KEY) || 1)
    s.style.transform = `scale(${z})`
    const span = controls.querySelector('span'); if (span) span.textContent = `${Math.round(z*100)}%`
  }

  function toast(message) {
    let t = document.querySelector('.vfs5-toast')
    if (!t) { t = document.createElement('div'); t.className = 'vfs5-toast'; document.body.appendChild(t) }
    t.textContent = message
    t.classList.add('show')
    clearTimeout(Number(t.dataset.timer || 0))
    t.dataset.timer = String(setTimeout(() => t.classList.remove('show'), 1300))
  }

  function css() {
    if (document.getElementById('vfs-v2-css')) return
    const s = document.createElement('style')
    s.id = 'vfs-v2-css'
    s.textContent = `
      html,body,#root{height:100%;margin:0}
      .timeline-scroll{position:relative!important;overflow:auto!important}
      .vfs-v2-needle{position:absolute!important;z-index:1000!important;width:2px!important;background:#ff3b67!important;top:24px!important;pointer-events:none!important;box-shadow:0 0 9px rgba(255,59,103,.75)}
      .vfs-v2-needle b{position:absolute;left:-6px;top:-8px;width:14px;height:14px;background:#ff3b67;clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)}
      .vfs-v2-needle span{position:absolute;top:-28px;left:2px;transform:translateX(-50%);font:8px Inter,system-ui,sans-serif;color:#fff;background:#ff3b67;padding:3px 5px;border-radius:4px;white-space:nowrap}
      .preview-area{overflow:auto!important;position:relative!important}
      .vfs5-preview-viewport{overflow:auto!important;max-width:100%!important;max-height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:35px!important}
      .vfs5-preview-viewport .video-stage{flex:none!important}
      .video-stage video,.video-stage img{display:block;max-width:100%;max-height:100%;object-fit:contain}
      .vfs-v2-zoom{position:absolute;right:12px;bottom:12px;z-index:60;display:flex;gap:4px;align-items:center;padding:4px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(10,10,13,.9)}
      .vfs-v2-zoom button{height:27px;min-width:30px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:#17171c;color:#ddd;cursor:pointer;font-size:10px}
      .vfs-v2-zoom span{min-width:42px;text-align:center;font-size:9px;color:#999}
      .vfs-v2-add{margin-left:4px;border:1px solid rgba(139,92,246,.3);background:#17131f;color:#ded5ff;border-radius:7px;padding:5px 6px;font-size:8px;cursor:pointer}
      .vfs-v2-add:hover{background:#241b31;color:#fff}
      .vfs-v2-status{font-size:8px;color:#777;position:absolute;left:50%;transform:translateX(-50%);top:8px}
    `
    document.head.appendChild(s)
  }

  async function observe() {
    if (!editor()) return
    css(); bindPlay(); bindRange(); bindMedia(); bindTimeline(); addLibraryButtons(); zoomPan()
    const p = project()
    if (p) {
      const t = Math.max(0, Math.min(duration(p), Number(p.playhead || 0)))
      drawNeedle(t)
      drawReadout(t, p)
      await restoreAll()
    }
  }

  const mo = new MutationObserver(() => {
    clearTimeout(window.__vfsV2Timer)
    window.__vfsV2Timer = setTimeout(() => void observe(), 80)
  })
  mo.observe(document.body, { childList:true, subtree:true })
  void observe()
})()
