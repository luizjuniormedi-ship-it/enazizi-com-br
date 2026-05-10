# Mobile Hardening v2 — Scaffolding (NÃO ATIVO)

> ⚠️ **STATUS: PREPARADO, NÃO IMPORTADO**
> Esta pasta contém a infraestrutura da Fase 2 Mobile Hardening.
> **Nada aqui é importado por telas produtivas durante o freeze (até ~24/05/2026).**
> Ativação pós-freeze, gradual, atrás da feature flag `mobile_hardening_v2`.

## Estrutura

```
src/mobile-hardening/
├── hooks/
│   ├── useSafeAreaInsets.ts      # Lê env(safe-area-inset-*) reativo
│   └── useKeyboardSafe.ts        # visualViewport API (iOS keyboard)
├── components/
│   ├── HeaderSafe.tsx            # Wrapper com padding-top safe-area
│   ├── FooterSafe.tsx            # Wrapper com padding-bottom safe-area
│   ├── KeyboardSafeContainer.tsx # Compensa teclado virtual iOS
│   └── SafeToastViewport.tsx     # Toaster compacto, mobile-aware
├── utils/
│   ├── overlayDetector.ts        # Runtime check de overlays bloqueantes
│   ├── routeAssertions.ts        # Garante que href existe no router
│   ├── clickableAssertions.ts    # Detecta botões mortos
│   └── featureFlag.ts            # isMobileHardeningV2Enabled()
└── tests/
    ├── mobile-safe-area.spec.ts  # Playwright: safe-area
    └── overlay-regression.spec.ts # Playwright: regressão de overlays
```

## Feature flag

```ts
import { isMobileHardeningV2Enabled } from "@/mobile-hardening/utils/featureFlag";

if (isMobileHardeningV2Enabled()) { /* novo path */ } else { /* legado */ }
```

Modos suportados:
- `off` (default em produção durante freeze)
- `dev` (sempre on em DEV)
- `admin` (apenas perfis admin)
- `shadow` (renderiza mas não substitui — coleta telemetria)
- `on` (rollout total)

Controlado via `localStorage.MOBILE_HARDENING_V2` ou env `VITE_MOBILE_HARDENING_V2`.

## Plano de ativação pós-freeze (25/05+)

1. Tutor IA: substituir header/footer ad-hoc por `<HeaderSafe>`/`<FooterSafe>` + `<KeyboardSafeContainer>` no input de chat.
2. Missão de Estudo: idem.
3. Toasts: trocar `top-0` legado por `<SafeToastViewport>`.
4. Ativar `overlayDetector` em DEV via `useEffect` no `App.tsx`.
5. Replicar para Simulados, Planner, Predictor, Banco de Erros.
6. Rodar `tests/` no CI.
