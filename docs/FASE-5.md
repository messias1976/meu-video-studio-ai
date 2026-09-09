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
- Textos e legendas convertidos em PNG transparente pelo navegador e sobrepostos no render final.
- Efeitos básicos da Fase 4 traduzidos para filtros FFmpeg quando selecionados.
- Transições básicas traduzidas para filtros FFmpeg na entrada dos clips, conforme a seleção da Fase 4.
- Codificação H.264 + AAC em MP4.
- Barra de progresso da renderização.
- Limpeza dos arquivos temporários usados pelo FFmpeg.
- Download automático do MP4 final.

## Funcionamento

O projeto usa o core single-thread do FFmpeg carregado sob demanda. Os arquivos locais são escritos no sistema virtual de arquivos do FFmpeg e processados no navegador via WebAssembly.

A renderização cria uma composição de fundo, posiciona cada clip conforme o tempo da Timeline, aplica o filtro do projeto e os efeitos/transições selecionados, sobrepõe textos/legendas transparentes e mistura as faixas de áudio com os atrasos correspondentes.

Para textos, o navegador gera imagens PNG transparentes com Canvas. Isso evita depender de fontes ou de um servidor externo para desenhar o conteúdo no vídeo final.

## Limitações atuais

- A seleção de efeitos e transições da Fase 4 é atualmente tratada como configuração de composição e não como configuração independente armazenada por clip.
- As transições disponíveis no render atual usam aproximações compatíveis com o pipeline, enquanto transições avançadas entre dois clips serão refinadas depois.
- A faixa de áudio interna de cada vídeo não é reconstruída como mixagem individual; o foco atual é a faixa de áudio adicionada separadamente na Timeline.
- Imagens e vídeos usam o início de cada arquivo como fonte do clip; um ponto de entrada separado por clip será adicionado depois.
- Volume e fades por faixa ainda precisam ser ligados ao modelo de dados da Timeline.

## Próxima evolução da Fase 5

1. Ponto de entrada e saída independente por clip.
2. Preservar e mixar o áudio original dos vídeos.
3. Volume, fade-in e fade-out por faixa/clip.
4. Transições independentes entre pares de clips.
5. Presets de exportação e informações de tamanho estimado.
