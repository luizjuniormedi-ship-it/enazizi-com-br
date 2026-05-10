/**
 * Mobile Hardening v2 — barrel export
 *
 * NÃO IMPORTAR este arquivo em telas produtivas durante o freeze (até ~24/05/2026).
 * Ativação atrás da feature flag `mobile_hardening_v2`.
 */
export { useSafeAreaInsets, safeAreaPadding } from "./hooks/useSafeAreaInsets";
export type { SafeAreaInsets } from "./hooks/useSafeAreaInsets";

export { useKeyboardSafe } from "./hooks/useKeyboardSafe";
export type { KeyboardState } from "./hooks/useKeyboardSafe";

export { HeaderSafe } from "./components/HeaderSafe";
export type { HeaderSafeProps } from "./components/HeaderSafe";

export { FooterSafe } from "./components/FooterSafe";
export type { FooterSafeProps } from "./components/FooterSafe";

export { KeyboardSafeContainer } from "./components/KeyboardSafeContainer";
export type { KeyboardSafeContainerProps } from "./components/KeyboardSafeContainer";

export { SafeToastViewport } from "./components/SafeToastViewport";
export type { SafeToastViewportProps } from "./components/SafeToastViewport";

export {
  isMobileHardeningV2Enabled,
  isMobileHardeningShadow,
  getMobileHardeningMode,
} from "./utils/featureFlag";
export type { MobileHardeningMode } from "./utils/featureFlag";

export { detectOverlayIssues, logOverlayIssues } from "./utils/overlayDetector";
export type { OverlayIssue } from "./utils/overlayDetector";

export { assertRoutes } from "./utils/routeAssertions";
export type { RouteAssertionResult, AssertRoutesOptions } from "./utils/routeAssertions";

export { detectDeadButtons } from "./utils/clickableAssertions";
export type { DeadButtonIssue } from "./utils/clickableAssertions";
