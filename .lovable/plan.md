# Auditoria Cross-Tela — Padrão de Bug "Botão Morto / Overlay Invisível"

## Contexto

GO-LIVE FREEZE ATIVO. A regra é "apenas micro-ajustes via telemetria". Uma auditoria + correção automática em 10 telas viola o freeze se feita de uma vez (alto risco de regressão silenciosa em FSRS, simulados, planner core).

Proposta: **dividir em 2 fases** — primeiro diagnóstico read-only (não viola freeze), depois correções pontuais aprovadas uma a uma.

## Fase 1 — Diagnóstico read-only (esta execução)

Para cada uma das 10 telas, varrer o código procurando os 10 padrões listados:

| # | Padrão | Como detectar (grep) |
|---|---|---|
| 1 | Botão sem onClick real | `<Button` sem `onClick=` próximo |
| 2 | Card que só registra telemetria | `track*(` sem `navigate(` no mesmo handler |
| 3 | Overlay invisível bloqueando | `absolute inset-0` sem `pointer-events-none` |
| 4 | `pointer-events-none` indevido | `pointer-events-none` em container interativo |
| 5 | `disabled` no container | `disabled` em `<div>`/`<form>` envolvendo ações |
| 6 | `opacity-50` em tela inteira | `opacity-50` em root/wrapper |
| 7 | Recovery loop infinito | `useEffect` com retry sem guard de tentativas |
| 8 | Toast/banner em safe-area | `fixed top-0` sem `env(safe-area-inset-top)` |
| 9 | Bottom nav cobrindo conteúdo | `fixed bottom-0` sem `pb-[calc(...)]` no conteúdo |
| 10 | z-index incorreto mobile | `z-50` em decorativo acima de interativo |

## Telas auditadas (arquivos-alvo)

1. **Tutor IA** — `src/pages/ChatGPT*.tsx`, `src/components/tutor/*`
2. **Missão de Estudo** — `OperationalHub.tsx` (já corrigido — só verificar)
3. **ENAFLIX Hub** — `EnaflixPage.tsx` (já corrigido — só verificar)
4. **Planner / Plano Diário** — `src/components/daily-plan/*`, `src/components/planner/*`
5. **Simulados** — `src/components/simulados/*`, `pages/Simulados*`
6. **Banco de Erros** — busca por `banco-erros`
7. **Revisões FSRS** — busca por `fsrs`/`reviews`
8. **Predictor** — `PerformancePredictor.tsx`
9. **Mnemônicos** — `src/components/mnemonic*/*`, `pages/Mnemonic*`
10. **CME / Vídeo** — `src/pages/admin/cme/*`, busca por `render-job`

## Entregável da Fase 1

Relatório em `.lovable/audit-cross-screen-dead-buttons.md` com:

- Por tela: lista de ocorrências (arquivo:linha + padrão #N + risco alto/médio/baixo)
- Sumário: top 5 bugs reais que justificam correção dentro do freeze
- Triagem: quais entram em "micro-ajuste autorizado" vs quais precisam de override

## Fase 2 — Correções (próxima rodada, sob aprovação)

Apenas após você revisar o relatório:
- Corrigir os bugs marcados como "alto risco" (botão real morto, overlay bloqueando)
- Ignorar "médio/baixo" durante o freeze
- Cada fix em commit isolado e testável

## Por que não corrigir tudo agora

1. **Freeze ativo**: alterações em planner/simulados/FSRS exigem override explícito.
2. **Risco de regressão silenciosa**: muitos `pointer-events-none` e `opacity-50` são intencionais (overlays decorativos, estados de loading legítimos). Corrigir cego cria bugs novos.
3. **Você precisa decidir prioridade**: 10 telas × ~5 ocorrências cada = potencialmente 50+ pontos. Sem triagem, vira refactor.

## Aprovação

Aprove para eu rodar a Fase 1 (só leitura, sem editar código, gera relatório markdown). Depois você decide o que entra na Fase 2.