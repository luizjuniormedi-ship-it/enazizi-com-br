# 🔍 ENAZIZI — Auditoria Completa da Jornada do Estudante

**Data:** 2026-04-27
**Escopo:** Jornada do estudante de ponta a ponta (Login → Avaliação)
**Modo:** Diagnóstico apenas. **Nenhuma mudança aplicada.**

---

## 📊 Snapshot do estado real (dados do banco)

### Volume real (todo o histórico)
| Tabela | Linhas | Diagnóstico |
|---|---:|---|
| `questions_bank` | 15.147 | ✅ Conteúdo abundante |
| `assistant_decisions` | 1.606 | ✅ Engine ativo |
| `fsrs_cards` | 429 | ✅ FSRS funcional |
| `tutor_messages` | 378 | ✅ Tutor usado |
| `error_bank` | 352 | ✅ Banco de erros vivo |
| `telemetry_events` | 318 | 🟡 Pouco volume ainda |
| `real_exam_questions` | 275 | ✅ Pool de prova real |
| `profiles` | 174 | 🟡 Mas só 2 ativos |
| `tutor_sessions` | 65 | ✅ |
| `daily_plan_tasks` | 60 | 🟡 Volume baixo |
| `mnemonic_requests` | 71 | ✅ |
| `mnemonic_results` | 50 | ✅ |
| `simulation_sessions` | 42 | 🟡 Pouco uso |
| `practice_attempts` | 114 | ✅ |
| `fsrs_review_log` | 25 | 🔴 **Muito poucas revisões reais** |
| `daily_plans` | 22 | 🔴 |
| `tutor_knowledge_memory` | 4 | 🔴 **Memória pedagógica vazia** |
| `orchestrator_outcomes` | 1 | 🔴 **Orquestrador praticamente sem uso** |
| `teacher_simulados` | 0 | ⚪ Vazio |

### Tabelas referenciadas mas **INEXISTENTES** 🚨
| Tabela esperada | Status | Quem tenta usar |
|---|---|---|
| `mind_maps` | ❌ NÃO EXISTE | `MindMaps.tsx`, `MindMapFullscreen.tsx` |
| `enaflix_progress` | ❌ NÃO EXISTE | módulos ENAFLIX |
| `enaflix_views` | ❌ NÃO EXISTE | módulos ENAFLIX |
| `study_sessions` | ❌ NÃO EXISTE | (existe `simulation_sessions` em vez disso) |
| `simulation_answers` | ❌ NÃO EXISTE | esperado pelo prompt do usuário |

### Atividade real últimos 7 dias
| Métrica | Valor | Status baseline |
|---|---:|---|
| Usuários distintos com eventos | **2** | 🔴 < 10 |
| Sessões de estudo iniciadas | **1** | 🔴 < 100 |
| `first_question_loaded` | **1** | 🔴 < 30 |
| Janela de coleta | ~2 dias | 🔴 < 7 dias |

➡️ **Baseline atual: 🔴 INSUFICIENTE.**
A maior parte dos eventos (`study_session_started`, `tutor_message_sent`, etc.) tem n=1 e vem do mesmo usuário admin. **Não há dados para decisões orientadas a comportamento ainda.**

---

## A) 🗺️ Mapa da jornada do estudante (estado atual)

```
┌─────────┐     ┌──────────┐     ┌───────┐     ┌─────────────┐
│  Login  │ ──▶ │Onboarding│ ──▶ │ Hoje  │ ──▶ │  Continuar  │
└─────────┘     │(perfil + │     │(Dash) │     │ (sessão de  │
                │  banca + │     └───┬───┘     │   estudo)   │
                │  prova)  │         │         └──────┬──────┘
                └──────────┘         │                │
                                     ▼                ▼
                              ┌──────────────┐  ┌──────────────┐
                              │  Cards Hoje  │  │ Carrega Q    │
                              │  (CTAs)      │  │ (bank/real)  │
                              └──┬───┬───┬───┘  └──────┬───────┘
                                 │   │   │             │
                  Revisões ◀─────┘   │   └─▶ Simulados │
                  (FSRS)             │                 ▼
                     │               ▼          ┌─────────────┐
                     ▼          Banco de Erros  │  Resposta   │
              ┌──────────┐                      │  + Telemetria│
              │ Tutor IA │ ◀────────────────────┤  + FSRS      │
              │ (drawer) │                      │  + Erro→banco│
              └──────────┘                      └─────────────┘
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │ Plano dia   │
                                                │ recalculado │
                                                │ (engine v3) │
                                                └─────────────┘
```

### ✅ O que **realmente** funciona ponta-a-ponta
1. Login + perfil + escolha de banca/data ✅
2. Dashboard carrega dados reais (`error_bank`, `desempenho_questoes`, `assistant_decisions`) ✅
3. Sessão de estudo: questão real → resposta → erro vai pra `error_bank` → FSRS é alimentado ✅
4. Tutor abre, manda mensagem, salva em `tutor_messages` ✅
5. Engine V3 roda em todo dashboard load (1.606 decisions registradas) ✅
6. Telemetria crítica funciona (12/14 eventos confirmados) ✅

### 🟡 O que funciona **parcialmente**
- **Mnemônicos**: 4 rotas distintas, todas funcionais, mas **sem oficial definida**
- **Planner**: 2-3 motores rodando em paralelo (DailyPlan, SmartPlanner, engine V3 no dashboard)
- **Gamification**: tabelas populadas (`user_gamification` 174, `user_achievements` 85) mas o XP raramente aparece no fluxo

### 🔴 O que está **quebrado / órfão**
- **Mapas mentais** — UI existe, mas tabela `mind_maps` **NÃO EXISTE** no banco
- **ENAFLIX** — 100% estático, sem `enaflix_progress` no banco, sem integração com estudo
- **Tutor knowledge memory** — apenas 4 entries (deveria ter centenas)
- **`tutor-memory-search` / `tutor-memory-embedder`** — edge functions existem mas **front nunca chama**
- **Trajectory engine** (5 edge functions) — **nenhuma é chamada pelo front**
- **WhatsApp** (4 edge functions) — órfãs

---

## B) 📋 Tabela por módulo

| # | Módulo | Status | Arquivos principais | Tabelas | Edge fns | Problema | Solução proposta | Prioridade |
|---|---|---|---|---|---|---|---|---|
| 1 | **Auth + Onboarding** | ✅ funcional | `Login.tsx`, `Register.tsx`, `Profile.tsx` | `profiles` (174) | `auth-email-hook` (órfã) | Não recalcula plano ao mudar perfil de forma consistente | Confirmar que `recalcStudyPlanAfterProfileChange.ts` é chamado em TODA alteração relevante | Média |
| 2 | **Dashboard / Hoje** | ✅ funcional | `Dashboard.tsx`, `HeroStudyCard.tsx`, `PendingReviewsCard.tsx` | `error_bank`, `desempenho_questoes`, `assistant_decisions` | `cockpit-data` | Rotas `quiz`, `revisoes`, `revisao`, `tutor`, `cronograma`, `plano-dia`, `missao` → **todas redirecionam** (4 redirects para `/sessao-estudo`) | Manter, é o hub correto | Baixa |
| 3 | **Sessão de Estudo** | ✅ funcional | `StudySession.tsx`, `useStudyLoop.ts` | `practice_attempts` (114), `error_bank` (352), `fsrs_cards` (429) | `study-next`, `study-complete`, `study-session` (órfã) | `study-session` edge fn existe mas não é chamada — `study-next` é o motor real | Deletar `study-session` (órfã) | Alta |
| 4 | **Revisões / FSRS** | 🟡 parcial | `Flashcards.tsx`, `useFsrs.ts`, `useFsrsDueCount.ts` | `fsrs_cards` (429), `fsrs_review_log` (25 só!) | `schedule-review` (órfã!) | **`schedule-review` nunca é chamada pelo front** — revisões são alimentadas só por respostas manuais. Apenas 25 reviews em 30d é muito baixo | Conectar `schedule-review` a um cron OU integrar ao loop de estudo | **Crítica** |
| 5 | **Banco de Erros** | ✅ funcional | `ErrorBank.tsx`, `useStudyLoop.ts` | `error_bank` (352) | `reinforce-error` (órfã) | Erros entram, mas `reinforce-error` (que deveria reforçar tema dominado) não é chamada | Conectar fluxo de "dominado" a `reinforce-error` OU deletar a edge fn | Média |
| 6 | **Simulados** | 🟡 duplicado | `Simulados.tsx`, `StudentSimulados.tsx`, `ExamSimulator.tsx`, `PracticalExam.tsx` | `simulation_sessions` (42), `simulation_history` (61) | `generate-adaptive-simulado`, `simulado-assistant` (órfã) | **4 páginas distintas de simulado** + `ExamSimulator` no router mas sem rota; `banco-questoes` e `questoes` redirecionam | Consolidar em 1 (`Simulados.tsx`); remover `ExamSimulator`, `QuestionsBank` (já redirecionam) | Alta |
| 7 | **Tutor IA** | ✅ funcional | `TutorDrawer.tsx`, `useChatMessages.ts` | `tutor_sessions` (65), `tutor_messages` (378), `tutor_knowledge_memory` (4) | `tutor-memory-search`, `tutor-memory-embedder` (órfãs) | Memória pedagógica **subutilizada** (4 entries). Sistema RAG nunca é chamado pelo front | Ativar `tutor-memory-search` no `useChatMessages` ou aceitar que a memória é só pós-uso | Alta |
| 8 | **Planejamento** | 🔴 **3 motores concorrentes** | `DailyPlan.tsx`, `SmartPlanner.tsx`, `Dashboard.tsx` (engine V3 inline), `CronogramaInteligente.tsx` | `daily_plans` (22), `daily_plan_tasks` (60), `study_plans`, `plans`, `professor_plans` | `generate-daily-plan`, `plan-next-batch`, `replan-overdue-tasks` (órfã), `study-orchestrator`, `planner-orchestrator-v1` (órfã) | **Engine V3** roda no Dashboard a cada load (946 decisions/7d). **`SmartPlanner` e `DailyPlan` rodam em paralelo** sem coordenação. **`/cronograma` redireciona pra `/planner`** mas `CronogramaInteligente` ainda existe | **Definir Engine V3 (no Dashboard) como motor oficial.** Congelar `SmartPlanner` e `DailyPlan` como visualizações. Deletar `CronogramaInteligente.tsx` | **Crítica** |
| 9 | **Mnemônicos** | 🔴 **4 versões** | `MnemonicGenerator.tsx`, `MnemonicStudio.tsx`, `MnemonicStudioPage.tsx`, `MnemonicHistoryPage.tsx` | `mnemonic_requests` (71), `mnemonic_results` (50) | `generate-mnemonic`, `mnemonic-studio`, `generate-medical-mnemonic` (órfã) | 4 rotas: `/mnemonico`, `/mnemonic-studio`, `/mnemonic-studio-v2`, `/mnemonic-history`. `MnemonicStudioPage` é a v2 (oficial). Geradores antigos competem | Manter `/mnemonic-studio-v2` como oficial. Redirecionar `/mnemonico` e `/mnemonic-studio` para v2. Deletar `generate-medical-mnemonic` órfã | Alta |
| 10 | **ENAFLIX** | 🔴 **100% estático** | `EnaflixPage.tsx`, `EnaflixCatalogPage.tsx`, `data/enaflix/*.ts` | **Nenhuma** | **Nenhuma** | Catálogo lindo mas sem `enaflix_progress`, sem rastreio. Linkado da sidebar como hub | Decidir: (a) congelar e remover do menu OU (b) implementar `enaflix_progress` antes de promover | Alta |
| 11 | **Mapas Mentais** | 🔴 **Backend inexistente** | `MindMaps.tsx`, `MindMapFullscreen.tsx`, `MapSuggestions.tsx` | **`mind_maps` NÃO EXISTE** | `generate-mind-map`, `generate-map-flashcards`, `generate-map-questions` (todas órfãs) | UI existe, rotas existem, edge functions existem, **mas tabela não foi criada**. Qualquer click vai falhar silenciosamente | **Remover do menu/rotas** OU criar tabela e conectar | **Crítica** |
| 12 | **Gamification** | 🟡 invisível | `XpWidget.tsx`, `XpPopup.tsx`, `Achievements.tsx`, `Rankings.tsx` | `user_gamification` (174), `user_achievements` (85) | `calculate-rankings` (órfã) | Tabelas populadas, mas XP/badges raramente aparecem no fluxo principal. Rankings calcula em órfão | Manter como é (passivo). Deletar `calculate-rankings` se não usada via cron | Baixa |
| 13 | **Telemetria** | ✅ funcional | `useTelemetry.ts`, `pedagogicalTelemetry.ts`, `TelemetryHealthCheck.tsx` | `telemetry_events` (318) | — | Funcional mas **volume insuficiente** para baseline | Aguardar coleta — ✅ já coberto pelo Freeze | Crítica (de tempo) |
| 14 | **Admin** | 🟡 inflado | 17+ páginas em `/pages/admin/` | várias | várias | Painéis: Monitoring, CEO, Metrics, Validation, Coverage, ClassificationBackfill, ClassificationRunner, ClassificationHealth, CurriculumCoverage, GranularGenerator, GeneratorTelemetry, BancaReadiness, SimuladoSelection, TutorMemory, Telemetry, OrchestratorInsights, ContentCoverageAudit, CoveragePriorityBoost | Manter: **Telemetry, TutorMemory, Monitoring, ContentCoverage**. Congelar resto | Média |

---

## C) 🔘 Tabela de botões e rotas (jornada do estudante)

| Botão / Link | Tela origem | Arquivo | Rota destino | Existe? | Status | Ação |
|---|---|---|---|---|---|---|
| Logo "ENAZIZI" | Sidebar | `DashboardSidebar.tsx` | `/` | ✅ | OK | Manter |
| **Continuar** (CTA principal) | Sidebar | `DashboardSidebar.tsx` | `/dashboard/sessao-estudo?source=sidebar_continue` | ✅ | OK | Manter |
| Hoje | Sidebar | `DashboardSidebar.tsx` | `/dashboard` | ✅ | OK | Manter |
| Revisões | Sidebar | `DashboardSidebar.tsx` | `/dashboard/flashcards` | ✅ | 🟡 OK mas FSRS subalimentado | Manter; corrigir alimentação |
| Simulados | Sidebar | `DashboardSidebar.tsx` | `/dashboard/simulados` | ✅ | 🟡 4 páginas duplicadas | Consolidar |
| Banco de Erros | Sidebar | `DashboardSidebar.tsx` | `/dashboard/banco-erros` | ✅ | OK | Manter |
| ENAFLIX | Sidebar | `DashboardSidebar.tsx` | `/enaflix` | ✅ | 🔴 Estático | Decidir |
| Perfil | Sidebar | `DashboardSidebar.tsx` | `/dashboard/perfil` | ✅ | OK | Manter |
| `/dashboard/cronograma` | (legado) | App.tsx | redireciona `/dashboard/planner` | ✅ | OK | Manter redirect |
| `/dashboard/quiz` | (legado) | App.tsx | redireciona `/sessao-estudo` | ✅ | OK | Manter redirect |
| `/dashboard/revisoes` | (legado) | App.tsx | redireciona `/sessao-estudo?focus=reviews` | ✅ | OK | Manter |
| `/dashboard/tutor` | (legado) | App.tsx | redireciona `/sessao-estudo` | ✅ | OK | Manter |
| `/dashboard/plano-dia` | (legado) | App.tsx | redireciona `/dashboard` | ✅ | OK | Manter |
| `/dashboard/questoes` | (legado) | App.tsx | redireciona `/simulados` | ✅ | OK | Manter |
| `/dashboard/banco-questoes` | (legado) | App.tsx | redireciona `/simulados` | ✅ | OK | Manter |
| `/dashboard/feynman` | (legado) | App.tsx | redireciona `/chatgpt` | ✅ | 🟡 ChatGPT não está no menu | Manter ou remover |
| `/dashboard/missao` | (legado) | App.tsx | redireciona `/mission` | ✅ | OK | Manter |
| `/dashboard/mapas-mentais` | App.tsx | `MindMaps.tsx` | `/dashboard/mapas-mentais` | ✅ rota / ❌ **dados** | 🔴 Quebrado em runtime | **Remover ou implementar** |
| `/dashboard/mnemonico` | App.tsx | `MnemonicGenerator.tsx` | `/dashboard/mnemonico` | ✅ | 🔴 v1 antigo | **Redirecionar para v2** |
| `/dashboard/mnemonic-studio` | App.tsx | `MnemonicStudio.tsx` | `/dashboard/mnemonic-studio` | ✅ | 🔴 Duplicado | **Redirecionar para v2** |
| `/dashboard/mnemonic-studio-v2` | App.tsx | `MnemonicStudioPage.tsx` | `/dashboard/mnemonic-studio-v2` | ✅ | ✅ Oficial | Manter |
| Botões em `Dashboard.tsx` (CTAs Hoje) | Dashboard | `Dashboard.tsx` | múltiplas | ✅ | OK | Manter |
| Tutor (drawer flutuante) | Toda página | `TutorDrawer.tsx` | (drawer, não rota) | ✅ | OK | Manter |

---

## D) ✅ Lista do que **deve sobreviver no MVP do estudante**

**Núcleo (intocável — 4 módulos)**
1. **Hoje** (`/dashboard`) — engine V3 roda aqui, é a entrada cognitiva
2. **Sessão de Estudo** (`/dashboard/sessao-estudo`) — execução
3. **Banco de Erros** (`/dashboard/banco-erros`) — feedback loop
4. **Tutor IA** (drawer global) — apoio orbital

**Auxiliares conectados**
5. Revisões / Flashcards (`/dashboard/flashcards`) — FSRS oficial
6. Simulados (`/dashboard/simulados`) — UM consolidado
7. Perfil (`/dashboard/perfil`) — recalcula plano
8. ENAFLIX — **se** for ativado com backend real (decisão pendente)

**Admin obrigatório**
9. `/admin/telemetry` (Health Check + Funil)
10. `/admin/tutor-memory`
11. `/admin/monitoring`

---

## E) 🗑️ Lista do que **deve ser removido AGORA** (limpeza segura)

**Páginas confirmadamente mortas / redundantes:**
- `src/pages/ExamSimulator.tsx` — não está no router
- `src/pages/QuestionsBank.tsx` — não está no router (rota redireciona)
- `src/pages/MnemonicGenerator.tsx` — v1 obsoleta (substituir por redirect)
- `src/pages/MnemonicStudio.tsx` — pré-v2 (substituir por redirect)
- `src/pages/CronogramaInteligente.tsx` — substituída por `SmartPlanner` e engine V3
- `src/pages/MindMaps.tsx` + `MindMapFullscreen.tsx` — backend inexistente
- `src/_archive/pages/FeynmanTrainer.tsx` — já arquivada

**Edge functions ÓRFÃS confirmadas (77 de 120 — 64%):**

**Categorias inteiras para deletar:**
- WhatsApp (4): `whatsapp-agent`, `whatsapp-auto-send`, `whatsapp-opt-out`, `whatsapp-queue`
- Trajectory (5): `trajectory-apply-v1`, `trajectory-engine-v1`, `trajectory-explain-v1`, `planner-orchestrator-v1`
- Telegram: `telegram-classroom`
- ISIC/X-rays externos: `analyze-isic-images`, `ingest-nih-xrays`
- Daily WhatsApp BI: `daily-bi-whatsapp`

**Geradores duplicados:**
- `generate-medical-mnemonic` (existe `generate-mnemonic` + `mnemonic-studio` ativas)
- `generate-image-questions`, `generate-image-questions-batch` (existe `*-secure` ativa)
- `generate-mind-map`, `generate-map-flashcards`, `generate-map-questions` (módulo morto)
- `generate-study-plan` (substituída por `generate-daily-plan` + engine V3)

**Tutor memory desconectado:**
- `tutor-memory-search`, `tutor-memory-embedder` — front nunca chama

**Páginas admin redundantes:**
- `AdminCEO.tsx`, `AdminOrchestratorInsights.tsx` (duplicam Monitoring)
- `ValidationDashboard.tsx`, `ContentCoverageAudit.tsx`, `CoveragePriorityBoost.tsx`, `ClassificationBackfill.tsx`, `ClassificationRunner.tsx`, `ClassificationHealthDashboard.tsx`, `CurriculumCoverage.tsx`, `GranularGeneratorMonitor.tsx`, `GeneratorTelemetry.tsx`, `BancaReadiness.tsx` — todas operação interna, podem virar **uma única página `/admin/content-ops`**

> ⚠️ **Total potencial de remoção segura: ~80 arquivos / ~40k LOC**

---

## F) ❄️ Lista do que **deve ser CONGELADO para V2** (não tocar agora, mas marcar)

- ENAFLIX (decidir após baseline se vira hub real ou enfeite)
- Mapas Mentais (escopo grande — adiar definitivamente)
- Mentor / Professor flow (`/professor`, `ProficiencyPilotPage`) — não é jornada do estudante
- Institucional (`/institucional`) — B2B, fora do MVP
- Mission Mode (`/mission`, `/mission-control`) — pouco usado
- Cinematic transitions / cognitive UI showcase (`/dev/cognitive`)
- Plantão / OSCE (`ClinicalSimulation`, `PracticalExam`, `AnamnesisTrainer`) — features fora do core
- Discursivas, Entrevista, Crônicas, Coach, Resumos, StudyGuides, Revisor — **agentes** (`/dashboard/agentes` é um hub adequado para isso)

---

## G) 🛠️ Lista do que **precisa ser implementado/corrigido antes de liberar**

### Bloqueadores reais (sem isso, bug visível ao usuário)
1. 🔴 **Mapas Mentais — remover do menu OU criar `mind_maps`** (atualmente quebra em runtime)
2. 🔴 **`schedule-review` desconectada** — FSRS só recebe revisões via interação manual; deveria ter cron diário OU ser chamada ao final de cada sessão
3. 🔴 **Mnemônico — `/mnemonico` e `/mnemonic-studio` deveriam redirecionar para v2** (hoje confunde)
4. 🟡 **Recalc de plano após mudança de perfil** — verificar que `recalcStudyPlanAfterProfileChange` é chamada em todos os pontos (data prova, banca, faculdade, período)
5. 🟡 **Tutor memory** — decidir se RAG via `tutor-memory-search` é ativado OU edge functions são deletadas

### Não-bloqueadores (qualidade)
6. Consolidar 4 páginas de simulado em 1
7. Definir oficialmente que **engine V3 no Dashboard é o motor único** — congelar `SmartPlanner`/`DailyPlan` como leituras

---

## H) 📅 Plano de correção em fases

### **Fase 0 — Higiene crítica** (1 sprint, ~2-4h, **compatível com freeze** porque corrige bugs)
**Objetivo:** Eliminar bugs em runtime que aparecem ao estudante.
- Remover/redirecionar `/dashboard/mapas-mentais` (e ocultar do menu se estiver lá)
- Redirecionar `/dashboard/mnemonico` e `/dashboard/mnemonic-studio` → `/mnemonic-studio-v2`
- Conectar `schedule-review` ao final de `study-complete` OU agendar cron
- Verificar `recalcStudyPlanAfterProfileChange` em todos os pontos de salvamento de perfil

> ⚠️ **NÃO mexer em UI/sidebar.** Apenas redirects + fixes silenciosos. Não contamina baseline.

### **Fase 1 — Consolidação da jornada** (após baseline)
- Decidir destino do ENAFLIX (matar OU implementar `enaflix_progress`)
- Consolidar 4 páginas de simulado em 1
- Decidir ativação do RAG no Tutor (`tutor-memory-search`)
- Definir oficialmente Engine V3 como único motor de planejamento

### **Fase 2 — Remoção de duplicidades** (após Fase 1)
- Deletar páginas mortas (`ExamSimulator`, `QuestionsBank`, `MnemonicGenerator`, `MnemonicStudio`, `CronogramaInteligente`)
- Deletar 77 edge functions órfãs em lotes (WhatsApp → Trajectory → geradores duplicados → admin redundantes)
- Consolidar 17 páginas admin em 4 oficiais

### **Fase 3 — Integração ao motor oficial**
- `reinforce-error` integrada ao loop "tema dominado"
- `auto-replenish` / `useAutoReplenish` validados
- Gamification ligada a eventos reais (XP popup ao completar sessão)

### **Fase 4 — Congelar UI e coletar telemetria** (já estamos aqui)
- ✅ Freeze ativo
- Aguardar baseline ≥10 usuários, ≥100 sessões, ≥30 first_question_loaded, ≥7 dias

### **Fase 5 — Decisões com dados reais** (pós-baseline)
- Funil de conversão por entry point
- Rota com maior abandono → revisar
- ENAFLIX/Mapas: confirmar se viram core ou são enterrados

---

## 🎯 Recomendação final

**Risco da auditoria sem baseline:** Você está tomando decisões de remoção/consolidação em cima de **n=2 usuários**. As recomendações acima são **estruturais e seguras** (módulos órfãos sem backend, funções órfãs sem caller, rotas redirecionadas duplicadas) — não dependem de comportamento.

**Mas:** decisões sobre **manter/matar ENAFLIX, Mnemônico, Plantão, OSCE, Mission Mode** dependem de uso real. Essas devem esperar a baseline.

**Sugestão de execução em blocos:**
1. ✅ **Aprovar AGORA:** Fase 0 (correções de bugs em runtime, não mexe em UI)
2. ⏳ **Esperar baseline para:** Fase 1 em diante
3. 🔵 **Decisão sua:** se quer agressivamente deletar as 77 edge functions órfãs já (Fase 2 parcial) — não toca em UI nem dados, mas é trabalho de limpeza puro

---

## Resumo em uma linha

> **Núcleo (Login → Hoje → Estudar → Tutor → Erro → FSRS) está vivo e funcional. Periferia tem ~64% de código órfão e 5 módulos quebrados/duplicados. Limpeza estrutural pode acontecer sem quebrar o freeze — decisões pedagógicas precisam esperar a baseline.**
