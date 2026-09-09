# Meu Video Studio AI

Editor de vídeo pessoal, local e gratuito para criação de conteúdo.

## Status atual

**Fase 5 — Processamento local com FFmpeg.wasm: em implementação na `main`.**

A aplicação possui a fundação do editor, gerenciamento de projetos, importação de vídeo/imagem/áudio, preview, timeline visual, ferramentas de corte/divisão, textos, legendas manuais, filtros, efeitos, transições e renderização da Timeline com FFmpeg.wasm.

## Objetivo

O projeto reúne em um único aplicativo ferramentas para criar e organizar projetos, importar vídeos, imagens e áudios, editar e pré-visualizar mídia, trabalhar com timeline, adicionar textos e legendas, aplicar filtros, efeitos e transições e processar vídeos localmente no navegador.

## Tecnologias

- React + TypeScript
- Vite
- React Router
- lucide-react
- Web APIs de mídia
- Local Storage
- FFmpeg.wasm

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

A ação **Exportar** utiliza FFmpeg.wasm dentro do navegador. O renderizador atual monta os clips de vídeo e imagem posicionados na Timeline, preserva `start` e `duration`, respeita o formato/resolução/FPS do projeto, aplica o filtro selecionado e mistura as faixas de áudio externas posicionadas na Timeline.

O core FFmpeg é carregado sob demanda e os arquivos são processados no sistema virtual do FFmpeg, sem servidor próprio de renderização.

## Dados e privacidade

Projetos e preferências são armazenados localmente no navegador. Arquivos importados usam URLs temporárias durante a sessão atual.

A IA é opcional. Não há sistema de contas, cobrança, assinaturas ou painel administrativo.

## Roadmap do projeto

1. ✅ Fundação e projetos locais.
2. ✅ Editor, mídia, preview e timeline.
3. ✅ Ferramentas de corte, divisão, texto e velocidade — base funcional.
4. ✅ Áudio, filtros, efeitos, transições e legendas — base interativa.
5. 🔄 FFmpeg.wasm, processamento local e renderização da Timeline.
6. ⏳ IA opcional para roteiro, ideias, legendas e narração.

## Limites atuais da Fase 5

A renderização da Timeline já suporta múltiplos clips e faixas de áudio externas, mas textos/legendas ainda não são queimados no MP4 final. Efeitos e transições da Fase 4 também ainda precisam ser traduzidos para filtros FFmpeg, e o ponto de entrada/saída independente de cada clip será refinado em uma próxima etapa.

Consulte `docs/FASE-5.md` para os detalhes da etapa atual.
