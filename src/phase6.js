(() => {
  const SETTINGS_KEY = 'meu-video-studio-ai:settings:v1'
  const PHASE6_KEY = 'meu-video-studio-ai:phase6:v1'
  const MODEL = 'gemini-2.0-flash'

  const readSettings = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} }
  }

  const writeState = (patch) => {
    try {
      const current = JSON.parse(localStorage.getItem(PHASE6_KEY) || '{}')
      localStorage.setItem(PHASE6_KEY, JSON.stringify({ ...current, ...patch }))
    } catch {}
  }

  const getKey = () => readSettings().apiKey || ''
  const getApiUrl = () => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(getKey())}`

  async function askAI(instruction) {
    const apiKey = getKey()
    if (!apiKey) throw new Error('Configure sua chave Gemini em Configurações ou no painel de IA.')
    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instruction }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1800 },
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || 'A API Gemini recusou a solicitação.')
    return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || 'A IA não retornou texto.'
  }

  function setReactValue(input, value) {
    if (!input) return
    const prototype = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function injectStyles() {
    if (document.getElementById('vfs-phase6-styles')) return
    const style = document.createElement('style')
    style.id = 'vfs-phase6-styles'
    style.textContent = `
      .vfs-ai-tools{margin-top:14px;padding:12px;border:1px solid rgba(139,92,246,.22);border-radius:12px;background:linear-gradient(180deg,rgba(139,92,246,.08),rgba(255,255,255,.02));display:grid;gap:9px}
      .vfs-ai-title{display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:12px;font-weight:700}
      .vfs-ai-subtitle{font-size:10px;line-height:1.5;color:#8f9099}
      .vfs-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .vfs-ai-action{border:1px solid rgba(255,255,255,.08);background:#15151b;color:#ddd;border-radius:8px;padding:8px 9px;font-size:10px;cursor:pointer;text-align:left}
      .vfs-ai-action:hover{background:#202027;color:#fff;border-color:rgba(139,92,246,.45)}
      .vfs-ai-action:disabled{opacity:.55;cursor:wait}
      .vfs-ai-output{margin-top:2px;padding:10px;border-radius:8px;background:#0d0d11;border:1px solid rgba(255,255,255,.07);color:#d7d7de;font-size:10px;line-height:1.55;white-space:pre-wrap;max-height:260px;overflow:auto}
      .vfs-ai-row{display:flex;gap:7px;flex-wrap:wrap}
      .vfs-ai-narrate{border:1px solid rgba(139,92,246,.35);background:#26164a;color:#fff;border-radius:8px;padding:8px 10px;font-size:10px;cursor:pointer}
      .vfs-ai-stop{border:1px solid rgba(255,255,255,.08);background:#15151b;color:#aaa;border-radius:8px;padding:8px 10px;font-size:10px;cursor:pointer}
      .vfs-caption-status{font-size:9px;color:#a9aab3}
    `
    document.head.appendChild(style)
  }

  function makeContainer(title, subtitle) {
    const box = document.createElement('div')
    box.className = 'vfs-ai-tools'
    box.innerHTML = `<div class="vfs-ai-title"><span>${title}</span><span>IA opcional</span></div><div class="vfs-ai-subtitle">${subtitle}</div>`
    return box
  }

  function addOutput(box) {
    let output = box.querySelector('.vfs-ai-output')
    if (!output) { output = document.createElement('div'); output.className = 'vfs-ai-output'; box.appendChild(output) }
    return output
  }

  function addAction(box, label, task) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'vfs-ai-action'
    button.textContent = label
    button.addEventListener('click', async () => {
      const output = addOutput(box)
      const original = button.textContent
      button.disabled = true
      button.textContent = 'Gerando...'
      output.textContent = ''
      try {
        const result = await task()
        output.textContent = result
        writeState({ lastResult: result, lastAction: label })
      } catch (error) {
        output.textContent = error instanceof Error ? error.message : 'Não foi possível usar a IA.'
      } finally {
        button.disabled = false
        button.textContent = original
      }
    })
    return button
  }

  function buildPrompts(context) {
    return {
      script: `Crie um roteiro de vídeo ${context} com começo forte, desenvolvimento objetivo e encerramento com CTA. Entregue em blocos curtos, com indicação aproximada de tempo e fala pronta para narração.`,
      ideas: `Crie 8 ideias de vídeos ${context}. Para cada uma, informe título curto, gancho inicial e CTA. Seja prático e evite ideias genéricas.`,
      titles: `Crie 12 títulos fortes para um vídeo ${context}, voltados para cliques e retenção, sem clickbait enganoso.`,
      captions: `Transforme o texto abaixo em legendas curtas para vídeo vertical. Quebre em frases naturais de 2 a 8 palavras por linha e mantenha a ordem do conteúdo. Retorne somente as linhas das legendas.\n\n${context}`,
    }
  }

  function setupMainIA() {
    if (!window.location.pathname.startsWith('/ia')) return
    const form = document.querySelector('.form-card')
    if (!form || form.querySelector('.vfs-phase6-main')) return
    const box = makeContainer('Assistente de criação', 'Gere roteiro, ideias e títulos usando sua própria chave Gemini.')
    box.classList.add('vfs-phase6-main')
    const textarea = form.querySelector('textarea')
    const context = () => textarea?.value?.trim() || 'para redes sociais, com foco em conteúdo curto e envolvente'
    const grid = document.createElement('div')
    grid.className = 'vfs-ai-grid'
    grid.append(
      addAction(box, 'Roteiro', () => askAI(buildPrompts(context()).script)),
      addAction(box, '8 ideias', () => askAI(buildPrompts(context()).ideas)),
      addAction(box, 'Títulos', () => askAI(buildPrompts(context()).titles)),
      addAction(box, 'Legenda', () => askAI(buildPrompts(context()).captions)),
    )
    box.insertBefore(grid, box.querySelector('.vfs-ai-output'))
    const narrationRow = document.createElement('div')
    narrationRow.className = 'vfs-ai-row'
    const narrate = document.createElement('button')
    narrate.type = 'button'
    narrate.className = 'vfs-ai-narrate'
    narrate.textContent = '▶ Ouvir último resultado'
    narrate.onclick = () => {
      const text = box.querySelector('.vfs-ai-output')?.textContent?.trim()
      if (!text) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = 0.95
      window.speechSynthesis.speak(utterance)
    }
    const stop = document.createElement('button')
    stop.type = 'button'
    stop.className = 'vfs-ai-stop'
    stop.textContent = '■ Parar narração'
    stop.onclick = () => window.speechSynthesis.cancel()
    narrationRow.append(narrate, stop)
    box.appendChild(narrationRow)
    form.appendChild(box)
  }

  function setupEditorAI() {
    if (!window.location.pathname.startsWith('/editor/')) return
    const panel = [...document.querySelectorAll('.editor-panel')].find((element) => element.textContent?.includes('Assistente IA'))
    if (!panel || panel.querySelector('.vfs-phase6-editor')) return
    const box = makeContainer('Ferramentas rápidas de IA', 'Use o contexto do seu prompt atual para criar conteúdo pronto para edição.')
    box.classList.add('vfs-phase6-editor')
    const promptInput = panel.querySelector('textarea')
    const grid = document.createElement('div')
    grid.className = 'vfs-ai-grid'
    const context = () => promptInput?.value?.trim() || 'um vídeo curto para redes sociais'
    grid.append(
      addAction(box, 'Roteiro 30s', () => askAI(buildPrompts(`${context()}, com cerca de 30 segundos`).script)),
      addAction(box, '5 ideias', () => askAI(buildPrompts(`${context()}, para Reels/Shorts`).ideas).then((text) => text.replace(/^8/gm, '5'))),
      addAction(box, 'Títulos', () => askAI(buildPrompts(context()).titles)),
      addAction(box, 'Legendas', () => askAI(buildPrompts(context()).captions)),
    )
    box.insertBefore(grid, box.querySelector('.vfs-ai-output'))
    const row = document.createElement('div')
    row.className = 'vfs-ai-row'
    const narrate = document.createElement('button')
    narrate.type = 'button'
    narrate.className = 'vfs-ai-narrate'
    narrate.textContent = '▶ Narrar resultado'
    narrate.onclick = () => {
      const text = box.querySelector('.vfs-ai-output')?.textContent?.trim()
      if (!text) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = 0.95
      window.speechSynthesis.speak(utterance)
    }
    const captions = document.createElement('button')
    captions.type = 'button'
    captions.className = 'vfs-ai-stop'
    captions.textContent = 'Usar como legenda'
    captions.onclick = () => {
      const text = box.querySelector('.vfs-ai-output')?.textContent?.trim()
      if (!text) return
      const captionTool = [...document.querySelectorAll('.tool-rail-btn')].find((button) => button.textContent?.includes('Legendas'))
      captionTool?.click()
      window.setTimeout(() => {
        const textarea = [...document.querySelectorAll('textarea')].find((item) => item.placeholder?.includes('legenda'))
        if (!textarea) return
        setReactValue(textarea, text)
        const add = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Adicionar')
        add?.click()
      }, 120)
    }
    row.append(narrate, captions)
    box.appendChild(row)
    panel.querySelector('.panel-content')?.appendChild(box)
  }

  function observe() {
    injectStyles()
    setupMainIA()
    setupEditorAI()
  }

  new MutationObserver(observe).observe(document.body, { childList: true, subtree: true })
  observe()
})()
