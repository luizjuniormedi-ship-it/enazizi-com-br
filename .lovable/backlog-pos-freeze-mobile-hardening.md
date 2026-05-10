# Backlog Pós-Freeze — Fase 2 Mobile Hardening

**Liberar a partir de:** 2026-05-24 (fim do GO-LIVE FREEZE)
**Status atual:** GO-LIVE mobile liberado · Freeze preservado · Sem bugs críticos pendentes

## Ordem de execução recomendada

1. **`useSafeAreaInsets()`** — base para todo o resto
   - Hook que retorna `{ top, right, bottom, left }` de `env(safe-area-inset-*)`.
   - Substitui ad-hoc `paddingTop: "calc(env(...) + 12px)"` espalhado.

2. **`<HeaderSafe>` / `<FooterSafe>`** — elimina duplicação de safe-area
   - Wrappers que aplicam o hook acima de forma declarativa.

3. **Toasts mobile padronizados** — remove `top-0` legado
   - Compactos, safe-area aware, auto-dismiss, sem bloquear UI.
   - Consolidar `sonner` × `@/components/ui/toaster` (hoje coexistem).

4. **Detector automático de bloqueios** — evita regressão silenciosa
   - CI lint + runtime check para:
     - Overlays `absolute inset-0` sem `pointer-events-none`
     - `pointer-events-none` em containers clicáveis
     - `<Button>` sem `onClick`/`asChild`/`type="submit"`
     - Rotas referenciadas mas não declaradas no router

5. **Suite Playwright mobile** (iPhone 13 / 390×844) — estabilidade contínua
   - Tutor IA · Missão de Estudo · Simulados · Planner · Predictor · Banco de Erros.
   - Reusar padrão de `tests/e2e/mission-mobile-buttons.spec.ts`.

6. **`<KeyboardSafeContainer>`** — bug clássico pós-safe-area
   - Usa `visualViewport` API.
   - Evita input escondido pelo teclado iOS.
   - Corrige resize/jump em Safari mobile.
   - **Crítico para Tutor IA** (input fixo + chat scroll).
   - Sintomas conhecidos: teclado cobrindo input, viewport "pulando", submit invisível.

## Antecedentes (referências)

- `.lovable/audit-cross-screen-dead-buttons.md` — auditoria 10 telas, 0 bugs críticos.
- `tests/e2e/mission-mobile-buttons.spec.ts` — template do detector.
- M2 aplicado: `NewProfessorSimuladoPage` footer com `pb-[calc(1rem+env(safe-area-inset-bottom))]`.
- M1 adiado: toast container `top-0` sem safe-area (entra no item #1).
