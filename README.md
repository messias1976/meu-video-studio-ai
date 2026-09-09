# Meu Video Studio AI

Editor de vídeo pessoal, local e gratuito para criação de conteúdo.

## Status atual

**Fase 6 — IA opcional: concluída.**

A aplicação possui a fundação do editor, gerenciamento de projetos, importação de vídeo/imagem/áudio, preview, timeline visual, corte/divisão, textos, legendas, filtros, efeitos, transições, processamento local com FFmpeg.wasm e ferramentas opcionais de IA.

## Objetivo

O projeto reúne em um único aplicativo ferramentas para criar e organizar projetos, importar vídeos, imagens e áudios, editar e pré-visualizar mídia, trabalhar com timeline, adicionar textos e legendas, aplicar filtros, efeitos e transições, processar vídeos localmente e utilizar IA somente quando desejado.

## Tecnologias

- React + TypeScript
- Vite
- React Router
- lucide-react
- Web APIs de mídia
- Local Storage
- FFmpeg.wasm
- SpeechRecognition/SpeechSynthesis quando disponíveis no navegador
- Gemini API opcional

## Rodar localmente

```bash
pnpm install
pnpm dev
```

Depois abra o endereço indicado pelo Vite, normalmente `http://localhost:5173`.

Para validar o build:

```bash
pnpm build
```

## Exportação local

A ação **Exportar** utiliza FFmpeg.wasm dentro do navegador. O renderizador monta múltiplos clips de vídeo e imagem posicionados na Timeline, preserva `start` e `duration`, respeita formato/resolução/FPS, aplica filtros e efeitos suportados, incorpora textos/legendas e mistura áudio externo.

O resultado é baixado como MP4 H.264/AAC sem servidor próprio de renderização.

## IA opcional — Fase 6

A fase concluída adiciona:

- roteiro de vídeo;
- ideias de conteúdo;
- títulos;
- geração de texto para legendas;
- uso do resultado da IA como legenda dentro do editor;
- transcrição de fala pelo microfone quando o navegador oferece SpeechRecognition;
- inserção da transcrição em campos de texto para edição;
- narração com SpeechSynthesis;
- controle de velocidade e parada da narração;
- histórico local dos resultados de IA.

A chave Gemini é armazenada localmente. O editor continua funcionando sem IA, contas, cobrança ou assinatura.

## Dados e privacidade

Projetos e preferências são armazenados localmente no navegador. Quando o Gemini é usado, o prompt é enviado diretamente à API configurada pelo usuário.

## Roadmap do projeto

1. ✅ Fundação e projetos locais.
2. ✅ Editor, mídia, preview e timeline.
3. ✅ Ferramentas de corte, divisão, texto e velocidade — base funcional.
4. ✅ Áudio, filtros, efeitos, transições e legendas — base funcional.
5. ✅ FFmpeg.wasm, processamento local e renderização da Timeline.
6. ✅ IA opcional para roteiro, ideias, legendas, transcrição por voz e narração local.

## Limitações deliberadas

A transcrição automática depende do suporte do navegador e do microfone. Ela não transcreve diretamente MP3/MP4 sem uma engine de reconhecimento de fala adicional.

A narração usa SpeechSynthesis. A API padrão do navegador não oferece uma saída universal de WAV/MP3 para transformar a voz do sistema em arquivo da Timeline.

Como refinamentos de edição avançada, permanecem transições independentes entre pares de clips, ponto de entrada/saída por clip, mixagem detalhada do áudio original, volume/fades por clip e presets avançados de exportação.

Consulte `docs/FASE-5.md` e `docs/FASE-6.md` para a documentação técnica.
