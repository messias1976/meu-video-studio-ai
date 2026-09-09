# Meu Video Studio AI

Editor de vídeo pessoal, local e gratuito para criação de conteúdo.

## Objetivo

O projeto reúne em um único aplicativo ferramentas para criar e organizar projetos, importar vídeos, imagens e áudios, editar e pré-visualizar mídia, trabalhar com timeline, adicionar textos e legendas manuais, aplicar filtros, organizar clips por faixa, exportar uma composição local no navegador e usar IA de forma opcional.

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

Projetos e preferências são armazenados localmente no navegador nesta versão. Arquivos importados usam URLs temporárias do navegador durante a sessão.

A IA é opcional. A chave fornecida pelo usuário é armazenada no armazenamento local do navegador para facilitar o uso pessoal. Não há sistema de contas, cobrança, assinaturas ou painel administrativo.

## Roadmap do projeto

1. Fundação e projetos locais.
2. Editor, mídia, preview e timeline.
3. Ferramentas de corte, divisão, texto e velocidade.
4. Áudio, filtros, efeitos, transições e legendas.
5. FFmpeg.wasm e exportação mais completa.
6. IA opcional para roteiro, ideias, legendas e narração.
