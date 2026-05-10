# Auditoria BI — Aluno
Gerado: 2026-05-10 · viewport ref: 430×661 (mobile-first)

## 1. Hierarquia visual e narrativa
**Problema**: existem hoje **DUAS narrativas concorrentes** para o aluno:
- `Dashboard.tsx` — cinemático ENAFLIX, hero gigante 500px+ com poster Unsplash, linguagem de "missão crítica"
- `CognitiveCockpit` — denso, baseado em dados (Hero, Alerts, Evolução, Reforço)

Não há regra clara de qual prevalece. O Dashboard padrão (`/dashboard`) renderiza a versão cinemática e **não usa o Cockpit**. Isso significa que o aluno nunca vê o painel mais rico em dados a menos que entre via outra rota.

**Risco**: o usuário entra na home, vê texto inspirador + cards inventados ("Pediatria: Crescimento — Risco de esquecimento alto detectado pela IA") sem nenhum desses dados existir no banco. Quebra de confiança imediata.

## 2. Mocks/placeholders ainda em produção

| Arquivo | Linha | Conteúdo | Severidade |
|---|---|---|---|
| `src/pages/Dashboard.tsx` | 289 | `progress={Math.floor(Math.random()*90)+10} // Mock progress` | **CRÍTICO** |
| `src/pages/Dashboard.tsx` | 297-303 | 5 EnaflixThemeCard hardcoded (Cardio/Pedi/Cirurgia/Gineco/Preventiva) | **ALTO** |
| `src/pages/Dashboard.tsx` | 306-355 | 3 cards "Revisões Recomendadas" com texto fixo | **ALTO** |
| `src/components/dashboard/MotivationalGreeting.tsx` | 116 | random pick de saudação (aceitável) | BAIXO |

## 3. KPIs reais vs vazios

| KPI | Tabela | População real | Veredito |
|---|---|---|---|
| Questões respondidas | practice_attempts (58) + exam_sessions (100) + teacher_simulado_results | grande maioria tem dado | ✅ |
| Taxa de acerto | mesmo | ✅ | ✅ |
| Streak | user_gamification (184) | ✅ todos | ✅ |
| Revisões pendentes | revisoes (380) | ✅ | ✅ |
| Approval Score | approval_scores (**9 rows totais**, paradas em abril) | **~95% dos usuários veem null/0** | ❌ |
| Top Weaknesses / TopicEvolution | user_topic_profiles (**4 users de 184**) | quase ninguém tem | ❌ |
| Domínio por especialidade | medical_domain_map (163) | razoável | ⚠️ |
| FSRS metrics | fsrs_cards (429) | ✅ | ✅ |
| Engagement/Fatigue/Retention scores | hardcoded `0` no fallback (linha 170-171) | ⚠️ não-calculados em runtime | ⚠️ |

## 4. Mobile (viewport real do usuário 430×661)
- Hero do Dashboard: `min-h-[500px]` + tipografia `text-7xl`. Em 430px o título "Sua missão de hoje, Luiz" ocupa toda a tela visível antes do scroll. **Aluno precisa scrollar para ver qualquer KPI.**
- Cards horizontais (`EnaflixRow`) viram scroll-X — funciona, mas oculta CTAs.
- DashboardMetricsGrid usa `grid-cols-2 lg:grid-cols-4` — OK no mobile.
- PreparationDial 168×168px no Hero v2 — bom no mobile.

## 5. Conexão com FSRS / TRI / Approval
- **FSRS**: bem integrado — useFsrs, FsrsReviewCard, PlannerFSRSSection, Cockpit memory.
- **TRI**: presente apenas em simulados de prova real, **não exposto no dashboard**. Aluno não vê seu nível theta.
- **Approval Score**: integrado nos componentes mas **a tabela está morta** (sem novos cálculos desde abril). Resultado: cards mostram zero ou "—".
- **Approval gates em conquistas** (50/70/90) **inalcançáveis para 95% dos usuários** porque approval_scores não é alimentado.

## 6. Widgets sem ação prática
- `MotivationalGreeting` — saudação random, sem CTA
- `WeeklySummaryCard` — texto, sem link para ação
- `EvolutionBadge` — visual sem ação
- `SystemGuidePopup`, `WhatsNewPopup`, `FeedbackSurveyPopup`, `OnboardingTour` — múltiplos popups, possível fadiga
- `SmartNotifications` + `NotificationBell` + `BehavioralAlerts` + `SmartAlertCard` + `SmartAlerts` (dashboard-v2) — **5 sistemas de alerta paralelos** sem hierarquia clara

## 7. Componentes provavelmente mortos / dupes
- `dashboard-v2/*` (10 componentes) coexistindo com `dashboard/*` equivalentes — não há rota que use o v2 isoladamente; provavelmente experimento abandonado
- `CinematicMissionHero` (v2) vs `MissionHeroAnimated` vs Hero hardcoded em Dashboard.tsx — três heróis de missão
- `ApprovalScoreCard` em ambos `dashboard/` e `dashboard-v2/`
- `MiniLeaderboard` em dashboard mas Rankings + Achievements já cobrem ranking → tripla redundância

## 8. Achados — prioridades

### CRÍTICO
1. **Remover `Math.random()` mock do Dashboard linha 289** — substituir por progresso real do módulo (último acesso, % completion).
2. **Substituir cards hardcoded** ("Pediatria: Crescimento" etc) por `useStudyNext().alternativeActions` ou `cockpit.nextSteps`.
3. **Reativar pipeline `approval_scores`** — sem isso 30%+ dos KPIs e gamificação ficam mortos.
4. **Reativar pipeline `ranking_snapshots`** — toda a página `/dashboard/rankings` está vazia.

### ALTO
5. Decidir narrativa: Dashboard cinemático **OU** Cockpit denso. Hoje há sobreposição confusa.
6. Reduzir 5 sistemas de alerta para 1 unificado (`AlertOrchestrator` já existe — usar).
7. `dashboard-v2/*` — confirmar se é dead code; remover se sim.
8. Backfill `user_topic_profiles` para usuários com practice_attempts ≥ 5 (hoje só 4 de 184).

### MÉDIO
9. Mobile: reduzir altura do hero (500→340px) para liberar viewport.
10. Adicionar TRI/theta visível ao aluno em pelo menos 1 painel.
11. Consolidar popups de onboarding em um fluxo único.

### BAIXO
12. EvolutionBadge / WeeklySummaryCard precisam de CTAs.
13. Fatigue/Engagement scores hardcoded em 0 — calcular ou ocultar.
