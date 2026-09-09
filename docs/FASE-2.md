# Fase 2 — Editor

## Objetivo

Adicionar ao projeto a base funcional do editor para importar mídia, visualizar o conteúdo e trabalhar com uma timeline.

## Recursos presentes

- Importação de vídeos pelo seletor de arquivos.
- Importação de imagens.
- Importação de arquivos de áudio.
- Preview de vídeo no navegador.
- Controle de reprodução e pausa.
- Leitura de duração do vídeo.
- Clips organizados em faixas de vídeo e áudio.
- Adição de áudio à timeline.
- Playhead e indicação de tempo.
- Timeline visual.
- Organização local do projeto.
- Salvamento local do estado do projeto.

## Observação sobre arquivos

Nesta etapa, os arquivos importados utilizam URLs temporárias criadas pelo navegador. O estado do projeto é salvo localmente, mas os binários dos arquivos ainda não são persistidos permanentemente no armazenamento do projeto.

A persistência robusta de mídia será tratada na evolução do armazenamento local/IndexedDB.

## Próxima etapa

A Fase 3 acrescentará as ferramentas de edição: corte, divisão, movimentação, duplicação, exclusão, texto e velocidade.