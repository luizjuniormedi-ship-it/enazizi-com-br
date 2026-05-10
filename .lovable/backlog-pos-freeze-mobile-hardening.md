# Backlog Pós-Freeze — Fase 2 Mobile Hardening

**Liberar a partir de:** 2026-05-24 (fim do GO-LIVE FREEZE)
**Status atual:** GO-LIVE mobile liberado · Freeze preservado · Sem bugs críticos pendentes

## Itens

1. **Padronizar toasts mobile**
   - Compactos, safe-area aware (top + bottom), auto-dismiss, sem bloquear UI.
   - Consolidar uso entre `sonner` e `@/components/ui/toaster` (atualmente coexistem).

2. **Suite Playwright mobile** (iPhone 13 / 390×844)
   - Tutor IA · Missão de Estudo · Simulados · Planner · Predictor · Banco de Erros.
   - Reusar padrão de `tests/e2e/mission-mobile-buttons.spec.ts`.

3. **Detector automático de bloqueios** (CI lint + runtime)
   - Overlays `absolute inset-0` sem `pointer-events-none`.
   - `pointer-events-none` em containers clicáveis.
   - `<Button>` sem `onClick`/`asChild`/`type="submit"`.
   - Rotas referenciadas mas não declaradas no router.

4. **Hook global `useSafeAreaInsets()`**
   - Retorna `{ top, right, bottom, left }` lidos de `env(safe-area-inset-*)`.
   - Substitui usos atuais ad-hoc de `paddingTop: "calc(env(...) + 12px)"`.

5. **Layout mobile resiliente**
   - `<HeaderSafe>` · `<FooterSafe>` · `<KeyboardSafe>` (visualViewport API) · `<ToastSafe>`.
   - Aplicar progressivamente sem refactor big-bang.

## Antecedentes (referências)

- `.lovable/audit-cross-screen-dead-buttons.md` — auditoria 10 telas, 0 bugs críticos.
- `tests/e2e/mission-mobile-buttons.spec.ts` — template do detector.
- M2 aplicado: `NewProfessorSimuladoPage` footer com `pb-[calc(1rem+env(safe-area-inset-bottom))]`.
- M1 adiado: toast container `top-0` sem safe-area (entra no item #1).
