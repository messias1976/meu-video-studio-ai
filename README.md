# Meu Video Studio AI

Editor de vídeo pessoal, local e gratuito para criação de conteúdo.

## Status atual

**Fase 6 — IA opcional: em implementação.**

A aplicação possui a fundação do editor, gerenciamento de projetos, importação de vídeo/imagem/áudio, preview, timeline visual, ferramentas de corte/divisão, textos, legendas manuais, filtros, efeitos, transições, renderização local com FFmpeg.wasm e as primeiras ferramentas de IA opcionais.

## Objetivo

O projeto reúne em um único aplicativo ferramentas para criar e organizar projetos, importar vídeos, imagens e áudios, editar e pré-visualizar mídia, trabalhar com timeline, adicionar textos e legendas, aplicar filtros, efeitos e transições, processar vídeos localmente e utilizar IA somente quando o usuário desejar.

## Tecnologias

- React + TypeScript
- Vite
- React Router
- lucide-react
- Web APIs de mídia
- Local Storage
- FFmpeg.wasm
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

A ação **Exportar** utiliza FFmpeg.wasm dentro do navegador. O renderizador monta múltiplos clips de vídeo e imagem posicionados na Timeline, preserva `start` e `duration`, respeita o formato/resolução/FPS do projeto, aplica filtros e efeitos, sobrepõe textos/legendas e mistura as faixas de áudio externas.

O resultado é baixado como MP4 H.264/AAC sem servidor próprio de renderização.

## IA opcional — Fase 6

A primeira etapa da Fase 6 adiciona ferramentas rápidas para:

- roteiro de vídeo;
- ideias de conteúdo;
- títulos;
- geração de texto para legendas;
- uso do resultado como legenda dentro do editor;
- narração por voz disponível no navegador.

A chave Gemini fica armazenada localmente nas configurações. O editor continua funcionando sem IA, contas ou cobrança.

## Dados e privacidade

Projetos e preferências são armazenados localmente no navegador. A IA é opcional e, quando usada, o texto do pedido é enviado diretamente à API Gemini configurada pelo usuário.

## Roadmap do projeto

1. ✅ Fundação e projetos locais.
2. ✅ Editor, mídia, preview e timeline.
3. ✅ Ferramentas de corte, divisão, texto e velocidade — base funcional.
4. ✅ Áudio, filtros, efeitos, transições e legendas — base funcional.
5. ✅ FFmpeg.wasm, processamento local e renderização da Timeline.
6. 🔄 IA opcional para roteiro, ideias, legendas e narração.

## Limites atuais da Fase 6

A primeira etapa de IA ainda não transcreve automaticamente um arquivo de áudio importado e a narração por voz do navegador ainda não gera um arquivo de áudio exportável para a Timeline.

Consulte `docs/FASE-5.md` e `docs/FASE-6.md` para a documentação técnica das etapas concluídas e em andamento.
