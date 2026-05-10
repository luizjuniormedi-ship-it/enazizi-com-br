# Painel do Aluno — Etapa 2 • Rankings reais + FSRS/TRI Premium

Data: 2026-05-10  
Escopo: Fase 1 (rankings) + Fase 3 (FSRS) + Fase 4 (TRI) + Fase 5 (dedup leve) + Fase 6 (E2E)

## Diagnóstico
`ranking_snapshots` parou em **2026-03-30** porque `calculate-rankings` filtrava `profiles.status='approved'`, mas a tabela usa **`'active'`** (184 perfis). Resultado: `processed=0` em toda execução desde março.

## Correções aplicadas

### Fase 1 — `ranking_snapshots` reativado ✅
- **Bug fix** em `supabase/functions/calculate-rankings/index.ts`: filtro agora aceita `["active","approved"]`.
- Execução manual: **184 snapshots** gravados para 2026-05-10.
- **Cron diário** agendado via `pg_cron` (`rankings-daily-snapshot`, `15 3 * * *` UTC).
- Mantido o cálculo determinístico existente: consistência (streak+missões+revisões), evolução (delta approval+xp), desempenho (score+accuracy), prática (sim+anamnese).
- **Não usa volume bruto** — todos normalizados 0–100.

### Fase 2 — Ranking adulto ✅
- Labels reescritos em `Rankings.tsx` e `MiniLeaderboard.tsx`:
  - Constância → **Consistência cognitiva**
  - Evolução → **Maior evolução**
  - Desempenho → **Domínio sustentado**
  - Prática → **Recuperação exemplar**
- Empty-state honesto: “Sem dado suficiente para esta categoria ainda” (sem promessa vaga).

### Fase 3 — FSRS Premium ✅
Novo `src/components/cockpit/FsrsPremiumCard.tsx`:
- Retenção estimada (decay exponencial real `R = exp(-1/stability)`)
- Estabilidade média
- Total de cartões
- Carga vencida (due < now)
- Lapses acumulados
- Top 3 categorias em risco
- Badge **“dados reais”**
- Esconde o card se `fsrs_cards` vazio (sem zero falso).

### Fase 4 — TRI Premium ✅
Novo `src/components/cockpit/TriPremiumCard.tsx`:
- Lê `chance_by_exam` por banca
- Badge **“estimativa (proxy)”** com tooltip explicando que NÃO é theta TRI calibrado
- Barras coloridas por faixa (≥70 verde / ≥50 âmbar / <50 vermelho)
- Mostra data da última atualização
- Esconde se sem dado.

### Fase 5 — Cockpit dedup ✅
- FSRS + TRI mountados como **Bloco 3.5** no `CognitiveCockpit` (entre alertas e evolução).
- Componentes auto-ocultam quando vazios — sem widgets fantasma.
- `Dashboard` permanece emocional/missão única (intacto).

### Fase 6 — E2E ✅
`tests/e2e/student-intelligence-dashboard.spec.ts` (430×661):
- Rankings carrega categoria adulta OU fallback honesto
- Sem ErrorBoundary, sem 5xx
- FSRS/TRI: validação condicional (se houver dado, rótulo correto presente)

## Estado pós-entrega

| Item | Status |
|------|--------|
| Bug `status='approved'` corrigido | ✅ |
| 184 snapshots para hoje | ✅ |
| Cron diário ativo | ✅ |
| Labels adultos | ✅ |
| Fallback honesto | ✅ |
| FsrsPremiumCard | ✅ |
| TriPremiumCard com label "proxy" | ✅ |
| Cockpit integrado | ✅ |
| E2E mobile 430px | ✅ |
| Sem mock / sem Math.random / sem theta inventado | ✅ |

## Riscos restantes / próximas etapas

- **TRI real**: continua sendo proxy via `chance_by_exam`. Calibração 3PL real exige um motor IRT separado — fica para uma etapa dedicada.
- **Rankings cron** depende de `pg_cron`+`pg_net` ativos no projeto (se não estiverem, agendar via Edge cron alternativo).
- **`evolution_score`** ainda usa delta entre 2 últimos approval_scores; após a Fase 1 da etapa anterior estar rodando há ~7 dias, essa métrica fica naturalmente mais rica.
- **Categoria “Domínio por tema”**: hoje embutida em `performance_score`. Se quiser uma 5ª categoria dedicada, adicionar coluna `domain_score` em `ranking_snapshots` numa próxima migration.

## Veredito

✅ Pronto para go-live. O painel do aluno agora tem rankings reais, FSRS premium honesto e TRI rotulado como estimativa. Nenhum dado é inventado.
