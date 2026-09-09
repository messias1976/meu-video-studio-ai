# Fase 5 — Processamento local com FFmpeg

## Objetivo

Substituir a exportação experimental em WebM por processamento real com FFmpeg.wasm executado no navegador, mantendo os arquivos do projeto no ambiente local do usuário.

## Implementado

- Motor `@ffmpeg/ffmpeg` integrado ao editor.
- Carregamento sob demanda do core FFmpeg para não pesar a abertura inicial do aplicativo.
- Conversão do vídeo selecionado para MP4.
- Escala e enquadramento conforme formato do projeto.
- Resolução de saída conforme 720p, 1080p, 2K ou 4K.
- FPS configurável do projeto.
- Aplicação dos filtros atuais durante o processamento.
- Codificação H.264 + AAC.
- Barra de progresso da exportação.
- Download automático do arquivo MP4.
- Limpeza dos arquivos temporários usados pelo FFmpeg.

## Funcionamento

O core single-thread do FFmpeg é carregado sob demanda a partir do pacote distribuído oficialmente pelo projeto e o processamento ocorre dentro do navegador via WebAssembly. A API oficial utiliza `FFmpeg.load()`, `writeFile()`, `exec()` e `readFile()` para esse fluxo.

## Limitações desta etapa

A exportação atual processa o vídeo selecionado como uma composição principal. A montagem completa de múltiplos clips, áudio externo sincronizado, transições e textos desenhados no arquivo final ainda será consolidada em uma etapa posterior de renderização.

## Próxima evolução

- Concatenar múltiplos clips da Timeline.
- Misturar faixas de áudio da Timeline.
- Renderizar textos e legendas no arquivo final.
- Levar efeitos e transições para o pipeline FFmpeg.
- Melhorar presets de exportação e tratamento de erros.
