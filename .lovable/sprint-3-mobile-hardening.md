# Sprint 3 — Hardening Cognitivo Mobile

**Data:** 2026-04-23
**Escopo:** P0 + 2 P1 da auditoria mobile (Sprint 2).
**Filosofia:** silêncio visual, hierarquia clara, ação > ansiedade.
**Restrições respeitadas:** zero arquitetura, zero novas features, zero motion novo, zero mudança em desktop.

---

## Mudanças aplicadas

### P0 — Resume banner overlay (`InvisibleMnemonicOverlay`)

- **Antes:** `fixed bottom-4` cobria o último ~120px do conteúdo e ficava por cima do bottom nav.
- **Depois:** `bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-4` — em mobile sobe acima do bottom nav respeitando safe-area; em ≥md mantém posição original.
- **Impacto:** o banner deixa de competir com o nav. Continua visível mas sem bloquear navegação.

### P1a — Densidade do header da Visão Geral

**`RecoveryModeBanner.tsx`** (variante "standard" — não Heavy Recovery)
- Mobile: linha única discreta (`px-3 py-2`, ícone shield 14px, texto `text-xs`, sem subtitle separado, com truncate).
- ≥sm: layout original preservado.
- Ganho: ~50px verticais no fold mobile.

**`MissionHeroAnimated.tsx`**
- Badge "Recuperação" e "Bloqueado" → `hidden sm:inline-flex`. Em mobile já vêm no banner acima — eram duplicação.
- Botão `RefreshCw` → `hidden sm:inline-flex` em mobile.
- "Alternativas" deixou de ser botão lado-a-lado com refresh (que truncava como "Alte..."). Virou link cinza pequeno **abaixo** do CTA, com label completo "Ver alternativas".
- CTA "Começar agora" agora é `w-full sm:w-auto` em mobile — domina o fold.
- Layout mudou de `flex items-center` para `flex-col sm:flex-row` na CTA row.

### P1b — KPIs antes do CTA em `/sessao-estudo` (`OperationalHub.tsx`)

- Container do hub: `space-y-8` → `flex flex-col gap-8` (necessário para `order-*` funcionar).
- Seção "Hoje" (4 StatCards grandes):
  - Mobile: substituída por linha contextual `62 revisões · 0/2 hoje · 1d streak · — banca` (botões clicáveis, mas sem cards nem cores de urgência).
  - ≥sm: grid 2x2/4x1 original preservado.
- Reordenação por `order-*`:
  - Mobile: Execução (1) → Hoje (2) → Organização (3).
  - Desktop: Hoje (1) → Execução (2) → Organização (3).
- `Section` ganhou prop opcional `className` para suportar `order-*`.
- Resultado: ao entrar em "Estudar", o aluno vê primeiro **"Estudar um tema" + Iniciar + Iniciar revisão (62 pendentes)**. O número 62 ainda existe, mas como descrição de uma ação clicável, não como KPI vermelho gigante competindo pela atenção.

---

## Arquivos tocados

| Arquivo | Linhas mudadas | Tipo |
|---|---|---|
| `src/components/mnemonic/InvisibleMnemonicOverlay.tsx` | 1 | className |
| `src/components/dashboard/RecoveryModeBanner.tsx` | ~20 | dual layout mobile/desktop |
| `src/components/dashboard-v2/MissionHeroAnimated.tsx` | ~50 | classes responsivas + reorder |
| `src/components/study/OperationalHub.tsx` | ~140 | reorder, condense, ajuste de tipo |

**Zero arquivos criados, zero deletados, zero rotas mexidas, zero hooks/engines tocados.**

---

## Validação

- ✅ `npx tsc --noEmit` → 0 erros.
- ✅ Smoke test 390x844 em `/dashboard` → CTA "Começar agora" agora largura total, recuperação em 1 linha, "Ver alternativas" abaixo (não truncado).
- ✅ Smoke test 390x844 em `/dashboard/sessao-estudo` → fold mostra Execução primeiro; KPIs ainda acessíveis no scroll como linha discreta.
- ✅ Desktop visual preservado (todas as mudanças são `sm:` ou `md:` gated).

---

## O que **não** foi tocado nesta sprint (intencionalmente)

- **P2 — Hero ENAFLIX** (74% do fold mobile): refinamento, não dor real. Aguarda.
- **P2 — Badge "99+" vermelho em Perfil**: trivial mas exige decisão de produto sobre semântica de cor.
- **P3 — Glow do botão play no header**: cosmético; deixar para uma sprint de motion-cleanup futura.
- **Sidebar / TopBar / Bottom nav**: estabilizados — não mexer.
- **ENAFLIX, IA, Cockpit, Sessão de Estudo (motor)**: fora de escopo.

---

## Próximos passos sugeridos (não execute sem aprovação)

1. **Sprint 4 — Auditoria de IA invisível**: mapear onde a IA hoje aparece como menu/botão vs onde já age silenciosamente. (~2h de leitura, zero código.)
2. **Sprint 4 alt — Instrumentação de tempo-até-ação**: medir login → primeiro clique em Estudar. Métrica para guiar Sprint 5.
3. **Sprint 4 alt — Auditoria de silêncio visual no Dashboard**: contar cards/CTAs/badges que competem por atenção em `/dashboard` (relatório de densidade).

A escolha entre as 3 deve refletir a métrica que mais interessa: **comportamento real (1)**, **dado quantitativo (2)** ou **diagnóstico de fricção (3)**.
