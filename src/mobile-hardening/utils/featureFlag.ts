/**
 * Feature flag: mobile_hardening_v2
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Modos:
 *   off     — sempre desligado (default em produção durante freeze)
 *   dev     — só em DEV (import.meta.env.DEV)
 *   admin   — apenas usuários flagged como admin (passar isAdmin)
 *   shadow  — renderiza paralelo ao legado mas NÃO substitui (coleta telemetria)
 *   on      — rollout total
 *
 * Resolução, em ordem:
 *   1. localStorage.MOBILE_HARDENING_V2  (dev override)
 *   2. import.meta.env.VITE_MOBILE_HARDENING_V2
 *   3. default = "off"
 */
export type MobileHardeningMode = "off" | "dev" | "admin" | "shadow" | "on";

const VALID: MobileHardeningMode[] = ["off", "dev", "admin", "shadow", "on"];

function readMode(): MobileHardeningMode {
  if (typeof window !== "undefined") {
    try {
      const ls = window.localStorage.getItem("MOBILE_HARDENING_V2");
      if (ls && VALID.includes(ls as MobileHardeningMode)) {
        return ls as MobileHardeningMode;
      }
    } catch {
      /* localStorage indisponível */
    }
  }
  const env = (import.meta as any).env?.VITE_MOBILE_HARDENING_V2;
  if (env && VALID.includes(env as MobileHardeningMode)) {
    return env as MobileHardeningMode;
  }
  return "off";
}

export function getMobileHardeningMode(): MobileHardeningMode {
  return readMode();
}

export function isMobileHardeningV2Enabled(opts?: { isAdmin?: boolean }): boolean {
  const mode = readMode();
  switch (mode) {
    case "off":
      return false;
    case "dev":
      return Boolean((import.meta as any).env?.DEV);
    case "admin":
      return Boolean(opts?.isAdmin);
    case "shadow":
      return false; // shadow renderiza paralelo, não substitui
    case "on":
      return true;
    default:
      return false;
  }
}

export function isMobileHardeningShadow(): boolean {
  return readMode() === "shadow";
}
