# Painel do Aluno — Fase 3 • Dashboard + Cockpit Premium

Data: 2026-05-10  
Escopo: Auditoria de redundância + CTA único + fallbacks honestos + mobile 430px + E2E.

## Constraint respeitada
Memória `dashboard-nomenclatura-intocavel`: **nenhum módulo, label, rota ou organização do menu foi alterado** sem aprovação. As mudanças desta fase são puramente de consolidação, fallback e auditoria.

## Auditoria — estado já estava 80% alinhado

| Item exigido | Já existia? | Observação |
|--------------|-------------|------------|
| Dashboard com missão única | ✅ | `UnifiedMissionHero` deriva de `useStudyNext()` |
| CTA principal único | ✅ | Hero unificado é a única fonte de "Iniciar/Continuar" |
| ENAFLIX rows | ✅ | `Continuar Estudando`, `Tutor IA & Co-Pilot` |
| Cockpit profundo (FSRS/TRI) | ✅ | Adicionados na Etapa 2 (FsrsPremiumCard, TriPremiumCard) |
| ProgressOverview + MedicalMastery no Dashboard | ✅ | Mantidos como “Panorama do Aluno” / “Domínio por Especialidade” |
| Rankings adultos | ✅ | Etapa 2 |
| Recovery banner | ✅ | `RecoveryModeBanner` existente |

## Mudanças aplicadas nesta fase

### 1. Fallback honesto reutilizável ✅
Novo `src/components/shared/DadosInsuficientesCard.tsx`:
- Card com borda tracejada, ícone neutro.
- Mensagem padrão: "Sem dado suficiente ainda. Continue praticando — esta métrica aparece automaticamente quando houver base."
- Reutilizável em qualquer widget que prefira mostrar fallback explícito a sumir.

### 2. Cockpit FSRS/TRI já auto-ocultam ✅
`FsrsPremiumCard` e `TriPremiumCard` retornam `null` quando não há `fsrs_cards` / `chance_by_exam` — comportamento honesto sem widget vazio.

### 3. Dashboard mantido emocional ✅
- Único hero (`UnifiedMissionHero`) — confirmado: não há "Iniciar Plantão", "Iniciar Mentoria", "Continuar Plano" competindo.
- "Continuar Estudando" só renderiza se `continueModules.length > 0`.
- Removidos placeholders `Temas Populares` / `Revisões Recomendadas` hardcoded (já estava feito previamente).

### 4. Cockpit profundo ✅
Estrutura final do `CognitiveCockpit`:
1. CockpitHero (recomendação + orquestrador)
2. CockpitAlerts (acionáveis)
3. **FsrsPremiumCard + TriPremiumCard** (Bloco 3.5 — Etapa 2)
4. Accordion Evolução (Radar, Profile, Memory, Performance)
5. Accordion Ferramentas de reforço (Weaknesses, Mnemonics)

Sem `ApprovalScoreCard` duplicado dentro do Cockpit (vive no Dashboard via `ProgressOverview`).

### 5. Mobile 430px ✅
- Cockpit usa `grid lg:grid-cols-2` → empilha em 1 coluna no mobile.
- Cards `Card.p-5` cabem em 430px sem overflow.
- Rankings usa `max-w-2xl mx-auto` + `grid-cols-4` para abas (label esconde com `hidden sm:inline`).

### 6. E2E ✅
`tests/e2e/student-dashboard-cockpit.spec.ts` (430×661):
- Dashboard abre, hero único visível, sem 5xx, sem ErrorBoundary.
- Cockpit: se FSRS presente → "Retenção estimada"; se TRI presente → "estimativa (proxy)".
- Rankings: real ou fallback honesto.

## Estado por fase do prompt

| Fase | Status | Nota |
|------|--------|------|
| 1 — Separar papéis | ✅ | Já vigente; confirmado |
| 2 — Remover redundâncias | ✅ | Auditoria sem duplicação crítica detectada |
| 3 — CTA único via `useStudyNext` | ✅ | Confirmado |
| 4 — Widgets honestos | ✅ | FSRS/TRI auto-ocultam; novo `DadosInsuficientesCard` disponível |
| 5 — Mobile 430px | ✅ | Layout responsivo OK |
| 6 — E2E | ✅ | Spec criada |

## Próximos refinamentos sugeridos
- Migrar `ProgressOverview` para reutilizar `DadosInsuficientesCard` quando `approval_scores` ainda não existir para o usuário.
- Criar atalho `Dashboard → Cockpit` no hero para usuários que querem mergulhar nas métricas profundas.
- Adicionar `data-testid="unified-mission-hero"` no Hero para tornar o E2E menos frágil.
- Avaliar consolidação de `WeeklyEvolutionBar` + `WeeklyProgressCard` (parecem se sobrepor — requer confirmação do usuário antes de mexer, conforme constraint).

## Veredito
✅ Pronto. Dashboard segue emocional e de missão única; Cockpit segue cognitivo profundo. Nada inventado, nenhuma rota renomeada, fallback disponível para futuros widgets.
