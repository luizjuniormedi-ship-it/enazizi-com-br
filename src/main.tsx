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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

const canonical = "enazizi.com";

const isLocalHost = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1");
const isPreviewHost = 
  window.location.hostname.includes("id-preview--") || 
  window.location.hostname.includes("lovable") || 
  window.location.hostname.includes("gptengineer") ||
  window.location.hostname.includes("lovableproject.com");

const shouldRedirectToCanonical =
  !isLocalHost &&
  !isPreviewHost &&
  window.location.hostname !== canonical &&
  window.location.hostname !== `www.${canonical}`;

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

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
  devLog("[App] Montando aplicação...");
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    devLog("[App] Erro: Elemento root não encontrado!");
    return;
  }
  createRoot(rootElement).render(<App />);
  devLog("[App] Aplicação montada com sucesso.");
};

const registerProductionServiceWorker = () => {
  let reloadingForNewSW = false;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForNewSW) return;
      reloadingForNewSW = true;
      window.location.reload();
    });
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {
      devLog("[PWA] App pronto para uso offline.");
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

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
    },
  });
};

const boot = async () => {
  if (shouldRedirectToCanonical) {
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

  // Skip release checks and hard resets in preview environments to prevent reload loops
  if (!isPreviewHost && !isInIframe && storedRelease && storedRelease !== APP_RELEASE) {
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

  if (isPreviewHost || isInIframe) {
    devLog("[Boot] Ambiente de preview/iframe detectado, montando app sem PWA.");
    mountApp();
    unregisterServiceWorkers().catch(() => {});
    return;
  }

  registerProductionServiceWorker();
  mountApp();
};

void boot();