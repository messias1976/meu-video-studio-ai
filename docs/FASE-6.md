# Fase 6 — IA opcional

## Objetivo

Adicionar recursos de inteligência artificial sem transformar o projeto em SaaS, mantendo a IA opcional, os dados locais e a integração externa limitada à chave fornecida pelo próprio usuário.

## Implementado

- Assistente de criação com Gemini.
- Geração de roteiros.
- Geração de ideias para vídeos.
- Geração de títulos.
- Geração de textos para legendas.
- Ações rápidas de IA dentro do editor.
- Conversão do resultado da IA em legenda manual do editor.
- Transcrição de fala para texto usando `SpeechRecognition`/`webkitSpeechRecognition` quando o navegador oferece essa API.
- Inserção da transcrição no campo de legenda/prompt para edição posterior.
- Narração local usando `SpeechSynthesis`, com voz em português quando disponível.
- Controle de velocidade da narração.
- Parada imediata da narração.
- Histórico local dos últimos resultados de IA.
- Chave Gemini armazenada localmente no navegador.
- Nenhuma conta, cobrança, assinatura ou servidor intermediário.

## Como funciona

### IA de texto

O usuário informa sua própria chave Gemini em **Configurações** ou no painel de IA. Os recursos de roteiro, ideias, títulos e legendas enviam o prompt diretamente para a API Gemini usando essa chave.

### Transcrição

O editor pode iniciar o reconhecimento pelo microfone. A fala reconhecida é acumulada no campo de texto e, ao finalizar, fica disponível para edição e transformação em legenda. O recurso depende do suporte do navegador e de permissão de microfone.

### Narração

A narração é realizada pela voz disponível no sistema através de `SpeechSynthesis`. O texto pode ser ouvido, interrompido e ter sua velocidade ajustada, sem necessidade de serviço de TTS no projeto.

## Privacidade e custos

O editor continua funcionando sem IA. Os dados de projeto permanecem no `localStorage` do navegador. Quando o usuário aciona o Gemini, o texto do pedido é enviado à API usando a chave configurada por ele.

A transcrição e a narração por APIs nativas do navegador não exigem uma conta do Meu Video Studio.

## Limitações conhecidas

- A transcrição automática depende do suporte do navegador ao `SpeechRecognition` e usa o microfone; ela não decodifica diretamente um arquivo MP3/MP4 sem uma engine de ASR adicional.
- A narração usa `SpeechSynthesis` e é reproduzida pelo navegador. A API padrão não fornece uma saída de áudio portátil para transformar a fala do sistema em arquivo WAV/MP3 de forma universal.
- As transições da Fase 5 seguem as limitações descritas em `docs/FASE-5.md`.

## Resultado da Fase 6

A fase está concluída dentro da proposta de manter o aplicativo pessoal, gratuito e local, com IA opcional. As integrações que exigiriam serviços adicionais permanecem deliberadamente fora do núcleo do projeto.
