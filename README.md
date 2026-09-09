# Meu Video Studio AI

Editor de vídeo pessoal, local e gratuito para criação de conteúdo.

## Status atual

**Fase 5 — Processamento local com FFmpeg.wasm: em implementação na `main`.**

A aplicação possui a fundação do editor, gerenciamento de projetos, importação de vídeo/imagem/áudio, preview, timeline visual, ferramentas de corte/divisão, textos, legendas manuais, filtros, efeitos, transições e exportação local em MP4 com FFmpeg.wasm.

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

Na Fase 5, a ação **Exportar** utiliza FFmpeg.wasm para converter o vídeo selecionado para MP4 dentro do navegador. O processamento inclui enquadramento, resolução, FPS e os filtros configurados no projeto.

O core FFmpeg é carregado sob demanda. O modelo atual usa o core single-thread oficial, compatível com Vite e com a API `FFmpeg.load()`, `writeFile()`, `exec()` e `readFile()`. citeturn913912search0turn913912search1

## Dados e privacidade

Projetos e preferências são armazenados localmente no navegador. Arquivos importados usam URLs temporárias durante a sessão atual.

A IA é opcional. Não há sistema de contas, cobrança, assinaturas ou painel administrativo.

## Roadmap do projeto

1. ✅ Fundação e projetos locais.
2. ✅ Editor, mídia, preview e timeline.
3. ✅ Ferramentas de corte, divisão, texto e velocidade — base funcional.
4. ✅ Áudio, filtros, efeitos, transições e legendas — base interativa.
5. 🔄 FFmpeg.wasm, processamento local e exportação MP4.
6. ⏳ IA opcional para roteiro, ideias, legendas e narração.

## Limites atuais da Fase 5

A exportação FFmpeg atual processa o vídeo selecionado como composição principal. A renderização completa de múltiplos clips da Timeline, áudio externo sincronizado, textos/legendas como elementos queimados no arquivo final e a aplicação final de todas as transições/efeitos serão consolidadas nas próximas melhorias do pipeline.

Consulte `docs/FASE-5.md` para os detalhes da etapa atual.
