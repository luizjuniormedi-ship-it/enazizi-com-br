/**
 * Forced app update utility — destrava clientes presos em bundle/cache antigo.
 *
 * Compatível com:
 *  - Safari iOS (PWA standalone e navegador)
 *  - Chrome Android / Desktop
 *  - Edge / Firefox
 *
 * Cada etapa é envolta em try/catch para que a falha de uma não bloqueie as
 * próximas — o reload final sempre executa.
 */

import { APP_RELEASE, RELEASE_KEY } from "./app-release";
import {
  clearAllCacheStorage,
  clearStaleLocalStorage,
  unregisterServiceWorkers,
} from "./app-hard-reset";

export type ForceUpdateStage =
  | "starting"
  | "diagnostics"
  | "clearing-caches"
  | "updating-sw"
  | "skip-waiting"
  | "clearing-storage"
  | "reloading";

export interface ForceUpdateOptions {
  /** Callback chamado a cada etapa, útil para feedback de UI. */
  onStage?: (stage: ForceUpdateStage, label: string) => void;
  /** Pular o reload final (útil para testes). */
  skipReload?: boolean;
}

const LOG_PREFIX = "[force-update]";

const STAGE_LABELS: Record<ForceUpdateStage, string> = {
  starting: "Iniciando atualização…",
  diagnostics: "Coletando diagnóstico…",
  "clearing-caches": "Limpando cache…",
  "updating-sw": "Atualizando service worker…",
  "skip-waiting": "Ativando nova versão…",
  "clearing-storage": "Limpando storage local…",
  reloading: "Recarregando aplicativo…",
};

const detectBrowser = () => {
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return "chrome-ios";
  if (/FxiOS/.test(ua)) return "firefox-ios";
  if (/EdgA?/.test(ua)) return "edge";
  if (/Chrome\//.test(ua) && /Android/.test(ua)) return "chrome-android";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua) && /Mobile/.test(ua)) return "safari-ios";
  if (/Safari\//.test(ua)) return "safari";
  if (/Firefox\//.test(ua)) return "firefox";
  return "unknown";
};

const isStandaloneDisplay = () => {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean(standaloneNavigator.standalone)
  );
};

const announce = (
  options: ForceUpdateOptions | undefined,
  stage: ForceUpdateStage,
) => {
  const label = STAGE_LABELS[stage];
  console.log(`${LOG_PREFIX} ${stage}`);
  options?.onStage?.(stage, label);
};

/** Conta quantos caches existem (apenas log/diagnóstico). */
const getCacheCount = async (): Promise<number> => {
  try {
    if (!("caches" in window)) return 0;
    const names = await caches.keys();
    return names.length;
  } catch {
    return 0;
  }
};

/** Coleta diagnóstico atual (versão, SW, controller, caches). */
const collectDiagnostics = async () => {
  const browser = detectBrowser();
  const standalone = isStandaloneDisplay();
  const hasSW = "serviceWorker" in navigator;
  let registrationsCount = 0;
  let waitingCount = 0;
  let hasController = false;
  let cacheCount = 0;

  if (hasSW) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      registrationsCount = registrations.length;
      waitingCount = registrations.filter((r) => Boolean(r.waiting)).length;
      hasController = Boolean(navigator.serviceWorker.controller);
    } catch {
      // ignore
    }
  }

  cacheCount = await getCacheCount();

  const diagnostics = {
    appRelease: APP_RELEASE,
    storedRelease: localStorage.getItem(RELEASE_KEY),
    browser,
    standalone,
    hasServiceWorkerSupport: hasSW,
    registrationsCount,
    waitingCount,
    hasController,
    cacheCount,
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  console.log(`${LOG_PREFIX} browser=${browser} standalone=${standalone}`);
  console.log(
    `${LOG_PREFIX} release=${APP_RELEASE} stored=${diagnostics.storedRelease ?? "none"} ` +
      `swRegs=${registrationsCount} waiting=${waitingCount} controller=${hasController} caches=${cacheCount}`,
  );
  console.log(`${LOG_PREFIX} diagnostics`, diagnostics);
  return diagnostics;
};

/** Pede update + skipWaiting em todos os SWs registrados. */
const updateServiceWorkers = async (
  options?: ForceUpdateOptions,
): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    console.log(`${LOG_PREFIX} service worker not supported, skipping`);
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length === 0) {
      console.log(`${LOG_PREFIX} no service worker registrations found`);
      return;
    }

    announce(options, "updating-sw");
    await Promise.allSettled(
      registrations.map((registration) => registration.update()),
    );

    announce(options, "skip-waiting");
    for (const registration of registrations) {
      try {
        if (registration.waiting) {
          console.log(`${LOG_PREFIX} posting SKIP_WAITING to waiting SW`);
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        if (registration.installing) {
          console.log(`${LOG_PREFIX} posting SKIP_WAITING to installing SW`);
          registration.installing.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} skip waiting failed`, error);
      }
    }

    // Como fallback de blindagem (Safari iOS frequentemente ignora skipWaiting
    // em standalone), também desregistramos todos os SWs. O próximo boot
    // registra a versão nova limpa.
    await unregisterServiceWorkers();
  } catch (error) {
    console.warn(`${LOG_PREFIX} updateServiceWorkers failed`, error);
  }
};

/**
 * Executa o fluxo completo de atualização forçada.
 * Sempre termina em reload (a menos que skipReload=true).
 */
export const forceAppUpdate = async (
  options?: ForceUpdateOptions,
): Promise<void> => {
  announce(options, "starting");

  announce(options, "diagnostics");
  await collectDiagnostics().catch(() => undefined);

  announce(options, "clearing-caches");
  let cachesRemoved = 0;
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      const results = await Promise.allSettled(
        names.map((name) => caches.delete(name)),
      );
      cachesRemoved = results.filter(
        (r) => r.status === "fulfilled" && r.value === true,
      ).length;
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} clearAllCacheStorage failed`, error);
    await clearAllCacheStorage().catch(() => undefined);
  }
  console.log(`${LOG_PREFIX} caches removed=${cachesRemoved}`);

  // log "waiting worker found" se aplicável
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.some((r) => r.waiting)) {
        console.log(`${LOG_PREFIX} waiting worker found`);
      }
    } catch {
      // ignore
    }
  }

  await updateServiceWorkers(options);

  announce(options, "clearing-storage");
  try {
    // Limpa apenas os marcadores de release/cache efêmero — preserva sessão.
    localStorage.removeItem(RELEASE_KEY);
    clearStaleLocalStorage();
  } catch (error) {
    console.warn(`${LOG_PREFIX} clearing release markers failed`, error);
  }

  announce(options, "reloading");

  if (options?.skipReload) return;

  // Pequeno atraso para o feedback de UI ser visível.
  setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      window.location.replace(window.location.href);
    }
  }, 350);
};
