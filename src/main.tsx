import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { devLog } from "./lib/devLog";
import {
  APP_RELEASE,
  LOGIN_REFRESH_QUERY_KEY,
  LOGIN_REFRESH_SIGNATURE_KEY,
  RELEASE_KEY,
  buildAppRefreshUrl,
  removeAppRefreshQueryParams,
} from "./lib/app-release";
import { performHardAppReset, unregisterServiceWorkers } from "./lib/app-hard-reset";
import "./index.css";
import "./styles/enaflix-tokens.css";

/* ENAZIZI v2.3 */
console.log("🚀 [System] Bootstrap sequence starting...", {
  ts: Date.now(),
  host: window.location.hostname
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

const canonical = "enazizi.com";

const shouldRedirectToCanonical =
  window.location.hostname !== canonical &&
  window.location.hostname !== `www.${canonical}` &&
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("id-preview--") &&
  !window.location.hostname.includes("lovableproject.com") &&
  !window.location.hostname.includes("lovable.app") &&
  !window.location.hostname.includes("lovable.dev") &&
  !window.location.hostname.includes("gptengineer.app") &&
  !window.location.hostname.includes("ngrok");

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean(standaloneNavigator.standalone);

const forceReloadWithRelease = () => {
  const reloadUrl = buildAppRefreshUrl(window.location.href);
  window.location.replace(reloadUrl.toString());
};

const removeReleaseQueryParam = () => {
  const currentUrl = new URL(window.location.href);
  const cleanedUrl = removeAppRefreshQueryParams(currentUrl);
  if (cleanedUrl.toString() === currentUrl.toString()) return;

  window.history.replaceState({}, "", cleanedUrl.toString());
};

const mountApp = () => {
  console.log("📦 [System] Mounting application...");
  createRoot(document.getElementById("root")!).render(<App />);
};

const registerProductionServiceWorker = () => {
  // CRITICAL iOS FIX: when the new SW takes control (clientsClaim), force a
  // full page reload so the standalone PWA picks up the fresh bundle without
  // requiring the user to kill the app from the multitask switcher.
  let reloadingForNewSW = false;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForNewSW) return;
      reloadingForNewSW = true;
      console.log("[PWA] Novo Service Worker assumiu controle. Recarregando…");
      window.location.reload();
    });
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      devLog("[PWA] Nova versão disponível, atualizando agora...");
      // Triggers SKIP_WAITING → controllerchange → reload above.
      updateSW(true);
    },
    onOfflineReady() {
      devLog("[PWA] App pronto para uso offline.");
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // CRITICAL iOS FIX: Safari aggressively caches sw.js (default
      // updateViaCache is "imports", which still allows HTTP cache for the
      // top-level script). Re-register with "none" so registration.update()
      // always hits the network and the new SW is detected immediately.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register(swUrl, { scope: "/", updateViaCache: "none" })
          .catch(() => {});
      }

      const checkForUpdates = () => {
        registration.update().catch(() => {});

        if (registration.waiting) {
          updateSW(true);
        }
      };

      checkForUpdates();

      const intervalMs = isStandalone ? 60_000 : 5 * 60 * 1000;
      window.setInterval(checkForUpdates, intervalMs);
      window.addEventListener("focus", checkForUpdates);
      window.addEventListener("pageshow", checkForUpdates);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkForUpdates();
        }
      });
    },
  });
};

const boot = async () => {
  console.log("⚙️ [System] Booting...", { shouldRedirect: shouldRedirectToCanonical });
  
  if (shouldRedirectToCanonical) {
    console.warn("🔀 [System] Redirecting to canonical domain...");
    window.location.replace(`https://${canonical}${window.location.pathname}${window.location.search}`);
    return;
  }

  const currentUrl = new URL(window.location.href);
  const isLoginRefresh = currentUrl.searchParams.get(LOGIN_REFRESH_QUERY_KEY) === "1";
  const loginRefreshSignature = sessionStorage.getItem(LOGIN_REFRESH_SIGNATURE_KEY);

  if (isLoginRefresh) {
    await performHardAppReset({
      preserveSessionEntries: loginRefreshSignature
        ? [[LOGIN_REFRESH_SIGNATURE_KEY, loginRefreshSignature]]
        : [],
    });
  }

  const storedRelease = localStorage.getItem(RELEASE_KEY);

  if (storedRelease && storedRelease !== APP_RELEASE) {
    devLog(`[ENAZIZI] Release changed ${storedRelease} → ${APP_RELEASE}. Clearing caches…`);
    await performHardAppReset({
      preserveSessionEntries: loginRefreshSignature
        ? [[LOGIN_REFRESH_SIGNATURE_KEY, loginRefreshSignature]]
        : [],
    });
    localStorage.setItem(RELEASE_KEY, APP_RELEASE);
    forceReloadWithRelease();
    return;
  }

  localStorage.setItem(RELEASE_KEY, APP_RELEASE);
  removeReleaseQueryParam();
  devLog(`[ENAZIZI] Release: ${APP_RELEASE}`);

  if (isPreviewHost || isInIframe) {
    await unregisterServiceWorkers();
    mountApp();
    return;
  }

  registerProductionServiceWorker();
  mountApp();
};

void boot();
