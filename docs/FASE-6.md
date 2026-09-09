# Fase 6 — IA opcional

## Objetivo

Adicionar recursos de inteligência artificial sem transformar o projeto em SaaS, mantendo a IA opcional e dependente de uma chave fornecida pelo próprio usuário.

## Implementado nesta etapa

- Assistente de criação com Gemini.
- Geração rápida de roteiros.
- Geração de ideias para vídeos.
- Geração de títulos.
- Geração de texto para legendas.
- Ações rápidas dentro do editor para roteiro, ideias, títulos e legendas.
- Botão para usar o resultado da IA como legenda no editor.
- Narração por voz do navegador usando `SpeechSynthesis`.
- Interação sem conta, cobrança ou servidor intermediário.
- Chave da IA armazenada localmente nas configurações do navegador.

## Privacidade e custos

O editor continua funcionando sem IA. Quando o usuário usa os recursos Gemini, o texto do pedido é enviado à API configurada pelo próprio usuário usando a chave armazenada localmente.

A narração usa a API de voz disponível no navegador e não exige uma conta separada no projeto.

## Limitações atuais

- A geração de legendas desta primeira etapa trabalha a partir de texto/prompt e não faz transcrição automática de um arquivo de áudio importado.
- A narração desta etapa é reprodução por voz do navegador; ainda não gera um arquivo de áudio exportável para a Timeline.
- A IA usa o modelo Gemini configurado no código atual e a disponibilidade desse modelo pode variar conforme a API/conta utilizada.

## Próxima evolução

1. Transcrição de áudio para texto.
2. Geração de legendas com sincronização temporal.
3. Inserção de narração como mídia de áudio na Timeline.
4. Assistente com contexto do projeto atual.
5. Prompts estruturados para roteiro, Reels, Shorts, YouTube e anúncios.
6. Histórico local de resultados de IA.
