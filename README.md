# Meu Video Studio AI

Editor de vídeo pessoal, local e gratuito para criação de conteúdo.

## Status atual

**Fase 4 — Recursos avançados: em implementação na `main`.**

A aplicação já possui a fundação do editor, gerenciamento de projetos, importação de vídeo/imagem/áudio, preview, timeline visual, textos, legendas manuais, filtros e biblioteca de efeitos/transições.

## Objetivo

O projeto reúne em um único aplicativo ferramentas para criar e organizar projetos, importar vídeos, imagens e áudios, editar e pré-visualizar mídia, trabalhar com timeline, adicionar textos e legendas, aplicar filtros, organizar clips por faixa e evoluir para processamento local completo com FFmpeg.

## Tecnologias

- React + TypeScript
- Vite
- React Router
- lucide-react
- Web APIs de mídia
- Local Storage
- FFmpeg.wasm preparado para evolução do processamento

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

## Dados e privacidade

Projetos e preferências são armazenados localmente no navegador. Arquivos importados usam URLs temporárias durante a sessão atual.

A IA é opcional. Não há sistema de contas, cobrança, assinaturas ou painel administrativo.

## Roadmap do projeto

1. ✅ Fundação e projetos locais.
2. ✅ Editor, mídia, preview e timeline.
3. ✅ Ferramentas de corte, divisão, texto e velocidade — base funcional.
4. 🔄 Áudio, filtros, efeitos, transições e legendas.
5. ⏳ FFmpeg.wasm e exportação mais completa.
6. ⏳ IA opcional para roteiro, ideias, legendas e narração.

Consulte `docs/FASE-4.md` para os detalhes da etapa atual.