# Meu Video Studio AI

Editor de vídeo desktop local para Windows, com React + TypeScript + Tauri 2.

## Estado atual

Base do editor funcional: preview, importação de vídeo/imagem/áudio, timeline multipista, camadas, transformação, seleção, duplicação, exclusão, undo/redo e reprodução.

## Próximas etapas

- Projeto salvo em pasta local/SQLite
- FFmpeg nativo e exportação MP4
- trim/split real
- waveform e mixer
- texto e legendas
- transições e efeitos
- keyframes
- proxies para 4K
- IA opcional/local

## Desenvolvimento

```powershell
pnpm install
pnpm tauri:dev
```

## Build Windows

```powershell
pnpm tauri:build
```
