# Fase 5 — Processamento local com FFmpeg

## Objetivo

Processar a Timeline localmente com FFmpeg.wasm, evitando serviços externos e mantendo a edição no navegador.

## Implementado

- Motor `@ffmpeg/ffmpeg` integrado ao editor.
- Carregamento sob demanda do core FFmpeg.
- Renderização dos clips de vídeo e imagem posicionados na Timeline.
- Preservação das posições `start` e `duration` dos clips.
- Suporte a lacunas e sobreposição de clips através de composição por tempo.
- Enquadramento conforme 16:9, 9:16, 1:1 e 4:5.
- Resolução 720p, 1080p, 2K e 4K.
- FPS configurável do projeto.
- Aplicação do filtro escolhido durante o processamento.
- Leitura das faixas de áudio da Timeline.
- Atraso de cada áudio conforme sua posição `start`.
- Mixagem das faixas de áudio externas com `amix`.
- Codificação H.264 + AAC em MP4.
- Barra de progresso da renderização.
- Limpeza dos arquivos temporários usados pelo FFmpeg.
- Download automático do MP4 final.

## Funcionamento

O projeto usa o core single-thread do FFmpeg carregado sob demanda. Os arquivos locais são escritos no sistema virtual de arquivos do FFmpeg e processados no navegador via WebAssembly.

A renderização cria uma composição de fundo, posiciona cada clip conforme o tempo da Timeline e mistura as faixas de áudio com os atrasos correspondentes. Isso permite exportar uma Timeline com vários clips mesmo quando existem espaços entre eles.

## Limitações atuais

- Textos e legendas ainda são exibidos no preview e não são queimados no MP4 final.
- Efeitos e transições interativos da Fase 4 ainda não são convertidos integralmente para filtros FFmpeg.
- A faixa de áudio interna de cada vídeo não é reconstruída como mixagem individual; o foco atual é a faixa de áudio adicionada separadamente na Timeline.
- Imagens e vídeos usam o início de cada arquivo como fonte do clip; um ponto de entrada separado por clip será adicionado depois.

## Próxima evolução da Fase 5

1. Queimar textos e legendas no render final.
2. Mapear efeitos e transições da Fase 4 para filtros FFmpeg.
3. Suportar ponto de entrada e saída por clip.
4. Melhorar a preservação do áudio original dos vídeos.
5. Adicionar presets de exportação e informações de tamanho estimado.
