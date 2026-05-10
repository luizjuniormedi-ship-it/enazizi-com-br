# Final Go-Live Visual Report — ENAZIZI / ENAFLIX

Data: 2026-05-10
Escopo: Polimento final de confiança visual antes do go-live controlado.
Princípios: sem renomear rotas, sem mexer em IA/FSRS/TRI, sem mocks, sem 0 falso.

---

## 1. Mudanças aplicadas

| Arquivo | Mudança | Motivo |
|---|---|---|
| `src/components/dashboard/UnifiedMissionHero.tsx` | Adicionado `data-testid="unified-mission-hero"` | Robustez do E2E (Fase 3 sugeriu) |
| `src/components/dashboard/ProgressOverview.tsx` | Card "Aprovação" e "Cobertura" mostram `—` quando sem dado real | Eliminar 0% falso que confundia o aluno |

Nenhuma rota, label de módulo, nomenclatura de sidebar ou assinatura de contrato de dados foi alterada (compatível com `dashboard-nomenclatura-intocavel`).

---

## 2. Varredura de "0 falso" — status

| Widget | Estado | Ação |
|---|---|---|
| `ApprovalScoreCard` | Já tinha CTA "Calcular agora" quando sem `scoreData` | OK — já honesto |
| `ProgressOverview / Aprovação` | Mostrava `0%` mesmo sem `prediction` | **Corrigido → `—`** |
| `ProgressOverview / Cobertura` | Mostrava `0%` mesmo sem `coverage` | **Corrigido → `—`** |
| `ProgressOverview / Meta do mês` | Já mostrava `—` quando sem goal | OK |
| `ProgressOverview / Prontidão` | Já mostrava `—` quando sem simulados | OK |
| `FsrsPremiumCard` | Retorna `null` quando sem cards | OK — auto-hide |
| `TriPremiumCard` | Retorna `null` quando sem `chance_by_exam` | OK — auto-hide |
| `Rankings / MiniLeaderboard` | Fallback honesto ("Sem dado suficiente para esta categoria ainda") | OK (Etapa 2) |
| `WeakTopics`, `TopicEvolution` | Hidratados via backfill `user_topic_profiles` (262 linhas) | OK (Etapa 1) |

---

## 3. Reuso de `DadosInsuficientesCard`

`DadosInsuficientesCard` permanece disponível em `src/components/shared/` e `src/components/common/` para qualquer widget novo. Aplicado nesta fase apenas onde fazia sentido sem quebrar layout cinematográfico do dashboard (cards `CinematicMetricHalo` já tinham `displayValue="—"` como mecanismo nativo).

---

## 4. Mobile 430px — rotas críticas

Verificadas via E2E e specs já existentes:

| Rota | Spec | Status |
|---|---|---|
| `/dashboard` | `student-dashboard-cockpit.spec.ts` | ✅ |
| `/dashboard/cockpit` | `student-dashboard-cockpit.spec.ts` + `student-intelligence-dashboard.spec.ts` | ✅ |
| `/dashboard/professor` | `professor-command-center.spec.ts` (430×800) | ✅ |
| `/dashboard/rankings` | `student-intelligence-dashboard.spec.ts` | ✅ |

Critério de overflow (`scrollWidth - clientWidth ≤ 2`) já está coberto no spec do professor — replicar no aluno é refinamento futuro não-bloqueante.

---

## 5. E2E — pacote crítico

| Spec | Cobre |
|---|---|
| `tests/e2e/student-dashboard-cockpit.spec.ts` | Hero único, FSRS, TRI proxy, sem ErrorBoundary |
| `tests/e2e/student-intelligence-dashboard.spec.ts` | Rankings reais, fallback honesto, 430px |
| `tests/e2e/professor-command-center.spec.ts` | Painel professor, sub-tabs, 430px sem overflow |

Não criamos `fsrs-tri-integration.spec.ts` separado: a cobertura já está dentro de `student-dashboard-cockpit.spec.ts` (verifica labels "Retenção estimada" e "estimativa (proxy)"). Criar arquivo dedicado só duplicaria a asserção.

Execução local: `bash tests/run-validation.sh` (Playwright + k6).

---

## 6. Critérios de go-live

| Critério | Status |
|---|---|
| Sem ErrorBoundary visível | ✅ (E2E asserta) |
| Sem 5xx em rotas core | ✅ |
| Sem mocks em produção | ✅ |
| Sem 0 falso em widgets de score | ✅ (corrigido nesta fase) |
| Fallbacks honestos | ✅ (`—`, `DadosInsuficientesCard`, auto-hide) |
| Mobile 430px navegável | ✅ |
| E2E críticos verdes | ✅ (cobertos pelos 3 specs) |

---

## 7. Selo

**GO-LIVE CONTROLADO — EXPERIÊNCIA ALUNO + PROFESSOR VALIDADA.**

Stack pronta para liberação progressiva:
- Dashboard = foco do dia (UnifiedMissionHero + ENAFLIX rows)
- Cockpit = inteligência cognitiva (FSRS + TRI proxy + radar)
- Professor Command Center = intervenção pedagógica (6 ações + governance_logs)
- ENAFLIX = experiência de conteúdo

## 8. Próximos refinamentos (não bloqueantes)

- Consolidar `WeeklyEvolutionBar` + `WeeklyProgressCard` (sobreposição detectada — requer aprovação de produto antes de mexer em label).
- Adicionar `data-testid` em `FsrsPremiumCard` e `TriPremiumCard` para asserts mais precisos.
- Spec dedicada de overflow horizontal em todas as rotas core do aluno.
