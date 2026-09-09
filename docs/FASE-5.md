# Fase 5 — Processamento local com FFmpeg

## Objetivo

Processar a Timeline localmente com FFmpeg.wasm, evitando serviços externos de renderização e mantendo a composição no navegador.

## Implementado

- Motor `@ffmpeg/ffmpeg` integrado ao editor.
- Carregamento sob demanda do core single-thread.
- Renderização de múltiplos clips de vídeo e imagem posicionados na Timeline.
- Preservação de `start` e `duration` dos clips.
- Suporte a lacunas e sobreposição de clips por composição temporal.
- Formatos 16:9, 9:16, 1:1 e 4:5.
- Resoluções 720p, 1080p, 2K e 4K.
- FPS configurável do projeto.
- Filtros do editor aplicados no pipeline FFmpeg.
- Faixas de áudio externas da Timeline com atraso conforme `start`.
- Mixagem das faixas externas com `amix`.
- Textos e legendas convertidos em PNG transparente pelo Canvas e gravados no vídeo final na posição configurada.
- Suporte a textos com múltiplas linhas na exportação.
- Efeitos da Fase 4 traduzidos para filtros FFmpeg.
- Transições básicas da Fase 4 traduzidas para efeitos de entrada dos clips.
- Codificação H.264 + AAC em MP4.
- Barra de progresso durante a renderização.
- Limpeza dos arquivos temporários no sistema virtual do FFmpeg.
- Download automático do MP4 final.

## Correções consolidadas

- A chave de estado do exportador foi alinhada com a versão atual da Fase 4.
- O texto exportado deixou de usar uma imagem do tamanho inteiro do vídeo: cada texto agora é renderizado em uma camada transparente com dimensões próprias, preservando corretamente X, Y e tamanho.
- O exportador valida quando nenhum clip pôde ser renderizado antes de iniciar a codificação.
- O download do MP4 usa um Blob final e libera o objeto URL somente após o início do download.

## Funcionamento

O core do FFmpeg é carregado somente quando a exportação é iniciada. Os arquivos locais são escritos no sistema virtual do FFmpeg e processados via WebAssembly no navegador.

A composição parte de um fundo na resolução do projeto. Cada clip é escalado e recortado para o formato escolhido, recebe o filtro/effect/transition atual e é sobreposto no intervalo correspondente da Timeline. Depois, as camadas de texto são sobrepostas na posição armazenada em cada `TextLayer` e as faixas de áudio externas são atrasadas e mixadas.

## Limitações conhecidas

A Fase 5 está funcional para o escopo definido no cronograma, mas existem refinamentos que podem ser feitos posteriormente:

- Transições ainda são globais/aplicadas como entrada dos clips, e não uma configuração independente entre dois clips.
- O áudio original de cada vídeo ainda não é reconstruído como faixas individuais na mixagem.
- Não existe ainda ponto de entrada/saída independente por clip.
- Volume e fades por clip ainda podem ser incorporados ao modelo da Timeline.
- Presets avançados e estimativa de tamanho do arquivo podem ser adicionados posteriormente.

## Próxima etapa

Com a base de processamento local concluída, o projeto avança para a **Fase 6 — IA opcional**, mantendo o mesmo princípio de funcionamento local e permitindo o uso de uma chave fornecida pelo próprio usuário quando um serviço de IA for necessário.
