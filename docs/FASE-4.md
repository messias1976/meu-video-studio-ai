# Fase 4 — Recursos avançados

## Objetivo

Adicionar ao editor pessoal recursos de áudio, filtros, efeitos, transições e legendas, mantendo vídeo, imagem e áudio como mídias de primeira classe.

## Implementado nesta etapa

- Importação de vídeo, imagem e áudio.
- Faixas separadas de vídeo e áudio na Timeline.
- Controle de reprodução e volume do player.
- Filtros: Nenhum, Cinemático, Vintage, Quente, Frio, P&B e Vibrante.
- Controle de intensidade do filtro.
- Efeitos com aplicação visual no preview: Glitch, Flash, Partículas, Luz, Retro, Desfoque e Cinema.
- Transições com animação no preview: Fade, Slide, Zoom, Blur, Flash, Rotate e Glitch.
- Controles visuais de áudio por item importado, incluindo volume e waveform demonstrativa.
- Edição rápida de textos/legendas no preview com duplo clique.
- Preservação dos projetos e preferências existentes no armazenamento local.

## Limitações atuais

- Efeitos e transições nesta fase são aplicados visualmente no preview; o processamento definitivo no arquivo exportado será consolidado com FFmpeg na Fase 5.
- A waveform atual é uma representação visual local, não uma análise de amostras do arquivo.
- O controle de volume por clip será incorporado ao pipeline de áudio definitivo na Fase 5.

## Próximas melhorias

1. Integrar efeitos e transições ao pipeline de renderização.
2. Criar Waveform baseada no áudio real.
3. Aplicar volume, fade in e fade out por clip.
4. Melhorar legendas por tempo e sincronização.
5. Preparar todas as operações para exportação com FFmpeg.wasm.

## Regra de desenvolvimento

A fase 4 não deve remover recursos existentes e deve preservar compatibilidade com os projetos salvos localmente.
