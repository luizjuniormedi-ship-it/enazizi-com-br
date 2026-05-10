# Auditoria Gamificação + Painéis Diários
Gerado: 2026-05-10

## 1. Inventário gamificação

| Mecânica | Onde | Tabela | Real? |
|---|---|---|---|
| XP + nível | `useGamification` | `user_gamification` (184) | ✅ |
| Streak diário | mesmo | mesmo | ✅ |
| Streak semanal (weekly_xp) | Achievements page | mesmo | ✅ |
| Achievements (37 conquistas) | `ACHIEVEMENTS` array | `user_achievements` (85) | ⚠️ |
| Rankings (4 categorias) | Rankings page | `ranking_snapshots` (**1 row**) | ❌ |
| Ranking semanal (XP) | Achievements page | `user_gamification.weekly_xp` | ✅ |
| MiniLeaderboard widget | dashboard | mesmo | ✅ 🔁 |
| AchievementToast / XpPopup / XpWidget | global | local state | ✅ |
| Smart XP multiplier (error correction, repetition) | `getSmartXpMultiplier` | runtime | ✅ |

## 2. Análise pedagógica
**Pergunta-chave**: a gamificação reforça aprendizado real ou só volume?

### Achievements ─ análise por tipo
- **Volume bruto** (questions/simulados/flashcards/plantão/anamnese/reviews counts): **24 das 37** conquistas. Premia repetir, não dominar.
- **Streak**: 4 conquistas (3/7/14/30 dias). OK — disciplina.
- **Nível/XP**: 6 conquistas. Derivadas — sem novo significado.
- **Evolução** (errors_corrected, topics_improved, specialties_mastered): apenas **9 conquistas** — exatamente as que importam pedagogicamente.
- **Approval Score** (50/70/90): **3 conquistas inalcançáveis** porque `approval_scores` está morto.

**Veredito**: ~65% das conquistas premiam atividade, não aprendizado. Mistura de emojis 🎯📝📚💯🏅🎖️⚡🃏🏥🩺 e copys casuais ("Mestre das Questões", "Memória de Elefante") dá tom **estudantil-infantil**, contrastando com a posição premium do app.

### XP rewards (por ação)
- `question_answered: 5`, `question_correct: 10` — premia tentar **e** acertar (bom).
- `question_correct < error_corrected (20)` — bom: errar+corrigir vale mais que acertar.
- `topic_improved: 30` — alto, mas depende de `user_topic_profiles` (4 users só).
- `daily_login: 10` — premia presença, sem ato cognitivo.

### Risco de compulsão / fadiga
- Streak penaliza falha (zera). Em alunos com prova distante, isso gera ansiedade.
- Múltiplos popups (`AchievementToast`, `XpPopup`, `WhatsNewPopup`, `FeedbackSurveyPopup`, `SmartPopup`, `WelcomeBackScreen`) podem se acumular.
- Sem "modo silencioso" de gamificação para usuário avançado.

### Competitividade
- Ranking de **anônimos** ("Anônimo" / display_name truncado) — não-tóxico ✅.
- Mas **toda a página `/dashboard/rankings` está VAZIA** (só 1 ranking_snapshot existe). Aluno entra, vê "rankings em breve" — frustração.

## 3. Integração com FSRS/TRI
- XP por `review_on_time: 15` — bom gancho para FSRS.
- Achievement `first_review` / `50_reviews` — só conta volume, não retenção.
- **Falta**: achievement por "stability média > X dias", "0 lapses em 7 dias", "FSRS load reduzido em 20%".
- TRI: **zero integração**. Não há XP nem badge por theta crescente.

## 4. Painéis diários — auditoria

### Missão diária (`/mission`)
- Idle screen → Active task list. Bem feito.
- `useMissionMode` integrado a engine adaptativo.
- ⚠️ Coexiste com Hero do Dashboard que **também** chama "missão de hoje" — duplica linguagem.

### Daily Plan (`DailyPlanWidget`, `DailyPlanProgress`, `NextTaskBanner`)
- Real, derivado de `daily_plans` + `daily_plan_tasks`.
- ✅ Sem timezone bug observado (compara com `toISOString().split('T')[0]`).
- ⚠️ `EndOfDaySummary` existe mas trigger automático não está claro.

### Recovery Mode
- Banner exibe quando `adaptiveState.recoveryActive`. Bom.
- Em `Dashboard.tsx` aparece como Badge no Hero v2, em outro lugar como banner separado — duplicação leve.

### Pomodoro Timer
- Local-only — perde estado ao trocar de página. Não persiste em `localStorage` nem DB.

### Tarefas duplicadas / fantasmas
- Não detectadas em runtime, mas o conjunto `study_plans` + `daily_plans` + `daily_plan_tasks` + `revisoes` + `error_bank` cria **5 fontes** de "o que fazer agora". `useStudyNext` consolida — bom — mas em UI cada surface ainda lista coisas separadas.

## 5. Achados — prioridades

### CRÍTICO
1. **Reativar `ranking_snapshots` cron**. Sem isso `/dashboard/rankings` é uma página morta.
2. **Reativar `approval_scores`** (também impacta 3 achievements + ApprovalScoreCard).

### ALTO
3. Reduzir achievements de volume (24) → mover ênfase para evolução. Sugerir 12 novas baseadas em FSRS/TRI/retenção.
4. Tom: substituir emojis por iconografia consistente (lucide). "Mestre das Questões" → "Reviewer Avançado".
5. Modo silencioso de gamificação no `/dashboard/perfil`.
6. Consolidar 5+ popups em uma fila com prioridade (já existe `SmartPopup`).

### MÉDIO
7. Persistir Pomodoro Timer em `localStorage`.
8. Achievement por TRI: "θ +0.5 em uma especialidade".
9. Streak inteligente: não zerar se aluno avisou ausência (já existe memória "Retenção Inteligente" — verificar se está aplicada).

### BAIXO
10. Unificar terminologia: "Missão" no Dashboard hero vs "Missão" em `/mission` — usar uma só.
