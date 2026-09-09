(() => {
  const SETTINGS_KEY = 'meu-video-studio-ai:settings:v1'
  const PHASE6_KEY = 'meu-video-studio-ai:phase6:v2'
  const MODEL = 'gemini-2.0-flash'

  const readSettings = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} } }
  const readState = () => { try { return JSON.parse(localStorage.getItem(PHASE6_KEY) || '{}') } catch { return {} } }
  const writeState = (patch) => { try { localStorage.setItem(PHASE6_KEY, JSON.stringify({ ...readState(), ...patch })) } catch {} }
  const getKey = () => readSettings().apiKey || ''
  const getApiUrl = () => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(getKey())}`

  async function askAI(instruction) {
    const apiKey = getKey()
    if (!apiKey) throw new Error('Configure sua chave Gemini em Configurações ou no painel de IA.')
    const response = await fetch(getApiUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2200 } }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || 'A API Gemini recusou a solicitação.')
    return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || 'A IA não retornou texto.'
  }

  function setReactValue(input, value) {
    if (!input) return
    const proto = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
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
      .vfs-ai-title{display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:12px;font-weight:700}.vfs-ai-subtitle{font-size:10px;line-height:1.5;color:#8f9099}
      .vfs-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.vfs-ai-action,.vfs-ai-stop,.vfs-ai-narrate,.vfs-ai-recognize{border:1px solid rgba(255,255,255,.08);background:#15151b;color:#ddd;border-radius:8px;padding:8px 9px;font-size:10px;cursor:pointer;text-align:left}.vfs-ai-action:hover,.vfs-ai-stop:hover,.vfs-ai-narrate:hover,.vfs-ai-recognize:hover{background:#202027;color:#fff;border-color:rgba(139,92,246,.45)}.vfs-ai-action:disabled,.vfs-ai-recognize:disabled{opacity:.55;cursor:wait}
      .vfs-ai-output{padding:10px;border-radius:8px;background:#0d0d11;border:1px solid rgba(255,255,255,.07);color:#d7d7de;font-size:10px;line-height:1.55;white-space:pre-wrap;max-height:260px;overflow:auto}.vfs-ai-row{display:flex;gap:7px;flex-wrap:wrap}.vfs-ai-narrate{background:#26164a;color:#fff;border-color:rgba(139,92,246,.35)}
      .vfs-caption-status{font-size:9px;color:#a9aab3;line-height:1.45}.vfs-ai-history{display:grid;gap:5px}.vfs-ai-history button{border:0;background:#111116;color:#aaa;border-radius:7px;padding:7px 8px;text-align:left;font-size:9px;cursor:pointer}.vfs-ai-history button:hover{background:#1b1b21;color:#fff}
    `
    document.head.appendChild(style)
  }

  function makeContainer(title, subtitle) { const box = document.createElement('div'); box.className = 'vfs-ai-tools'; box.innerHTML = `<div class="vfs-ai-title"><span>${title}</span><span>IA opcional</span></div><div class="vfs-ai-subtitle">${subtitle}</div>`; return box }
  function addOutput(box) { let output = box.querySelector('.vfs-ai-output'); if (!output) { output = document.createElement('div'); output.className = 'vfs-ai-output'; box.appendChild(output) } return output }
  function rememberResult(result, action) { const history = Array.isArray(readState().history) ? readState().history : []; history.unshift({ action, result, at: new Date().toISOString() }); writeState({ history: history.slice(0, 10), lastResult: result, lastAction: action }) }
  function addAction(box, label, task) { const button = document.createElement('button'); button.type = 'button'; button.className = 'vfs-ai-action'; button.textContent = label; button.addEventListener('click', async () => { const output = addOutput(box); const original = button.textContent; button.disabled = true; button.textContent = 'Gerando...'; output.textContent = ''; try { const result = await task(); output.textContent = result; rememberResult(result, label) } catch (error) { output.textContent = error instanceof Error ? error.message : 'Não foi possível usar a IA.' } finally { button.disabled = false; button.textContent = original } }); return button }

  function buildPrompts(context) {
    return {
      script: `Crie um roteiro de vídeo ${context} com começo forte, desenvolvimento objetivo e encerramento com CTA. Entregue em blocos curtos, com indicação aproximada de tempo e fala pronta para narração.`,
      ideas: `Crie 8 ideias de vídeos ${context}. Para cada uma, informe título curto, gancho inicial e CTA. Seja prático e evite ideias genéricas.`,
      titles: `Crie 12 títulos fortes para um vídeo ${context}, voltados para cliques e retenção, sem clickbait enganoso.`,
      captions: `Transforme o texto abaixo em legendas curtas para vídeo vertical. Quebre em frases naturais de 2 a 8 palavras por linha e mantenha a ordem do conteúdo. Retorne somente as linhas das legendas.\n\n${context}`,
    }
  }

  function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null
  }

  function addAutoCaptionTools(box, targetTextarea) {
    const Recognition = getSpeechRecognition()
    const row = document.createElement('div'); row.className = 'vfs-ai-row'
    const recognize = document.createElement('button'); recognize.type = 'button'; recognize.className = 'vfs-ai-recognize'; recognize.textContent = Recognition ? '🎙 Transcrever pelo microfone' : '🎙 Reconhecimento indisponível'
    const status = document.createElement('div'); status.className = 'vfs-caption-status'; status.textContent = Recognition ? 'Fale ou reproduza o áudio próximo ao microfone. O navegador transforma a fala em texto.' : 'Seu navegador não oferece SpeechRecognition.'
    if (!Recognition) recognize.disabled = true
    recognize.onclick = () => {
      if (recognize.dataset.running === '1') return
      const recognition = new Recognition()
      recognition.lang = 'pt-BR'; recognition.continuous = true; recognition.interimResults = true
      recognize.dataset.running = '1'; recognize.textContent = '⏹ Parar transcrição'; status.textContent = 'Escutando...'
      let finalText = targetTextarea?.value?.trim() || ''
      recognition.onresult = (event) => { let interim = ''; for (let i = event.resultIndex; i < event.results.length; i++) { const text = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += `${finalText ? ' ' : ''}${text.trim()}`; else interim += text } if (targetTextarea) setReactValue(targetTextarea, `${finalText}${interim ? `${finalText ? ' ' : ''}[${interim.trim()}]` : ''}`); status.textContent = `Transcrição: ${finalText || interim}` }
      recognition.onerror = (event) => { status.textContent = `Reconhecimento: ${event.error || 'erro'}` }
      recognition.onend = () => { recognize.dataset.running = '0'; recognize.textContent = '🎙 Transcrever pelo microfone'; if (finalText && targetTextarea) setReactValue(targetTextarea, finalText); status.textContent = finalText ? 'Transcrição concluída e inserida no campo.' : 'Nenhuma fala reconhecida.'; writeState({ transcript: finalText }) }
      try { recognition.start() } catch { recognition.onend?.() }
    }
    row.appendChild(recognize); box.appendChild(row); box.appendChild(status)
  }

  function addNarration(box, getText) {
    const row = document.createElement('div'); row.className = 'vfs-ai-row'
    const narrate = document.createElement('button'); narrate.type = 'button'; narrate.className = 'vfs-ai-narrate'; narrate.textContent = '▶ Ouvir narração'
    const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'vfs-ai-stop'; stop.textContent = '■ Parar'
    const rate = document.createElement('input'); rate.type = 'range'; rate.min = '0.6'; rate.max = '1.4'; rate.step = '0.05'; rate.value = String(readState().speechRate || 0.95); rate.title = 'Velocidade da narração'; rate.style.width = '110px'
    narrate.onclick = () => { const text = getText(); if (!text) return; speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'pt-BR'; utterance.rate = Number(rate.value); const voices = speechSynthesis.getVoices().filter((voice) => /^pt-BR/i.test(voice.lang)); if (voices[0]) utterance.voice = voices[0]; speechSynthesis.speak(utterance); writeState({ speechRate: Number(rate.value) }) }
    stop.onclick = () => speechSynthesis.cancel(); rate.addEventListener('input', () => writeState({ speechRate: Number(rate.value) }))
    row.append(narrate, stop, rate); box.appendChild(row)
  }

  function setupMainIA() {
    if (!window.location.pathname.startsWith('/ia')) return
    const form = document.querySelector('.form-card'); if (!form || form.querySelector('.vfs-phase6-main')) return
    const box = makeContainer('Assistente de criação', 'Roteiro, ideias, títulos, legendas, transcrição por voz e narração local.'); box.classList.add('vfs-phase6-main')
    const textarea = form.querySelector('textarea'); const context = () => textarea?.value?.trim() || 'para redes sociais, com foco em conteúdo curto e envolvente'
    const grid = document.createElement('div'); grid.className = 'vfs-ai-grid'
    grid.append(addAction(box, 'Roteiro', () => askAI(buildPrompts(context()).script)), addAction(box, '8 ideias', () => askAI(buildPrompts(context()).ideas)), addAction(box, 'Títulos', () => askAI(buildPrompts(context()).titles)), addAction(box, 'Legenda', () => askAI(buildPrompts(context()).captions)))
    box.insertBefore(grid, box.querySelector('.vfs-ai-output'))
    addAutoCaptionTools(box, textarea)
    addNarration(box, () => box.querySelector('.vfs-ai-output')?.textContent?.trim() || textarea?.value?.trim() || '')
    const historyBox = document.createElement('div'); historyBox.className = 'vfs-ai-history'; const history = readState().history || []; if (history.length) { const title = document.createElement('div'); title.className = 'vfs-caption-status'; title.textContent = 'Histórico local'; historyBox.appendChild(title); history.slice(0, 5).forEach((item) => { const b = document.createElement('button'); b.textContent = `${item.action} · ${new Date(item.at).toLocaleString('pt-BR')}`; b.onclick = () => { addOutput(box).textContent = item.result }; historyBox.appendChild(b) }) }
    box.appendChild(historyBox); form.appendChild(box)
  }

  function setupEditorAI() {
    if (!window.location.pathname.startsWith('/editor/')) return
    const panel = [...document.querySelectorAll('.editor-panel')].find((element) => element.textContent?.includes('Assistente IA')); if (!panel || panel.querySelector('.vfs-phase6-editor')) return
    const box = makeContainer('IA para o editor', 'Gere conteúdo, transforme texto em legenda e faça transcrição por voz.'); box.classList.add('vfs-phase6-editor')
    const promptInput = panel.querySelector('textarea'); const grid = document.createElement('div'); grid.className = 'vfs-ai-grid'; const context = () => promptInput?.value?.trim() || 'um vídeo curto para redes sociais'
    grid.append(addAction(box, 'Roteiro 30s', () => askAI(buildPrompts(`${context()}, com cerca de 30 segundos`).script)), addAction(box, '5 ideias', () => askAI(`Crie 5 ideias de vídeos ${context()}, para Reels/Shorts, com título, gancho e CTA.`)), addAction(box, 'Títulos', () => askAI(buildPrompts(context()).titles)), addAction(box, 'Legendas', () => askAI(buildPrompts(context()).captions)))
    box.insertBefore(grid, box.querySelector('.vfs-ai-output'))
    addAutoCaptionTools(box, promptInput)
    addNarration(box, () => box.querySelector('.vfs-ai-output')?.textContent?.trim() || promptInput?.value?.trim() || '')
    const row = document.createElement('div'); row.className = 'vfs-ai-row'
    const useCaption = document.createElement('button'); useCaption.type = 'button'; useCaption.className = 'vfs-ai-stop'; useCaption.textContent = 'Usar resultado como legenda'
    useCaption.onclick = () => { const text = box.querySelector('.vfs-ai-output')?.textContent?.trim(); if (!text) return; const captionTool = [...document.querySelectorAll('.tool-rail-btn')].find((button) => button.textContent?.includes('Legendas')); captionTool?.click(); window.setTimeout(() => { const textarea = [...document.querySelectorAll('textarea')].find((item) => item.placeholder?.includes('legenda')); if (!textarea) return; setReactValue(textarea, text); const add = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Adicionar'); add?.click() }, 120) }
    row.appendChild(useCaption); box.appendChild(row); panel.querySelector('.panel-content')?.appendChild(box)
  }

  function observe() { injectStyles(); setupMainIA(); setupEditorAI() }
  new MutationObserver(observe).observe(document.body, { childList: true, subtree: true }); observe()
})()
