
# Execução sequencial — 1 passo por vez

Princípio: cada passo só começa depois que o anterior estiver validado em produção. Sem atalho, sem "agradar".

---

## Ordem responsável (por dependência técnica, não por estética)

```text
PASSO 1  →  Diagnóstico dos pipelines mortos
PASSO 2  →  Reativar approval_scores  (desbloqueia 30% dos KPIs)
PASSO 3  →  Reativar ranking_snapshots
PASSO 4  →  Backfill user_topic_profiles (hoje 4/184 usuários)
PASSO 5  →  Remover mocks do Dashboard.tsx (Math.random + cards hardcoded)
PASSO 6  →  Aplicar <MetricCard> no Dashboard do aluno
PASSO 7  →  RPC get_student_bi_summary (1 chamada vs 6-8 hoje)
PASSO 8  →  BI Professor: status segmentado + tooltips
PASSO 9  →  Heatmap curricular da turma
PASSO 10 →  Bloco de impacto de intervenções (antes/depois)
PASSO 11 →  Consolidar 5 sistemas de alerta em 1 feed
PASSO 12 →  Mobile pass (hero 500→180px, grids 2-col)
```

Justificativa da ordem: aplicar `MetricCard` antes de reativar os pipelines só mostraria "Sem dados ainda" em 30% dos cards. Isso seria cosmético, não responsável.

---

## PASSO 1 agora — Diagnóstico (somente leitura)

Antes de qualquer mudança, preciso provar **por que** `approval_scores` parou em abril e `ranking_snapshots` está vazio. Sem isso, "reativar" vira chute.

Vou executar (read-only, sem migração):

1. Consultar `approval_scores`:
   - última data de cálculo
   - distribuição por usuário (quantos têm registro)
   - identificar a edge function / cron responsável
2. Consultar `ranking_snapshots`:
   - última snapshot
   - schedule do cron (se existir em `pg_cron`)
3. Inspecionar `supabase/functions/` por nomes relacionados (approval-score-*, ranking-*, snapshot-*)
4. Ler logs recentes da edge function suspeita para identificar o erro que matou o pipeline

Saída do Passo 1 (entregue como relatório no chat, conforme sua preferência):

```text
- Tabela approval_scores: última atualização YYYY-MM-DD, N usuários cobertos
- Cron responsável: <nome>, schedule '<cron>', status: ativo/pausado/inexistente
- Causa raiz provável: <erro do log / função ausente / cron desabilitado>
- Plano corretivo mínimo para o Passo 2 (1 migração específica, sem refactor)
```

Só depois desse diagnóstico no chat eu peço aprovação para executar o Passo 2 (reativação propriamente dita).

---

## Regras de execução que vou seguir

```text
1. Um passo por mensagem. Nada de batch grande.
2. Cada passo termina com:
   • o que mudou
   • como validar (query SQL ou rota)
   • próximo passo proposto, aguardando seu "ok"
3. Migrações sempre mínimas, sem refactor oportunista.
4. Respeitar Go-Live Freeze: zero mudança em FSRS, Tutor, Planner core.
5. Respeitar Sprint 2.3: nenhum recálculo psicométrico abaixo dos thresholds.
6. Respeitar constraint de nomenclatura: não renomear módulos/sidebar.
7. Se um passo revelar problema maior, paro e reporto — não invento solução.
```

---

## Pergunta para destravar

Posso executar o **Passo 1 (diagnóstico read-only)** agora? Ele não altera nada — só consulta tabelas e logs e devolve o relatório no chat para você decidir se autoriza o Passo 2.
