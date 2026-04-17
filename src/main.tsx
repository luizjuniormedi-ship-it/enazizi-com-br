/* ENAZIZI v2.2 */
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const APP_RELEASE = "2026-04-17-v14";
const RELEASE_KEY = "enazizi_release";
const RELEASE_QUERY_KEY = "__app_release";
const canonical = "enazizi.com";

const shouldRedirectToCanonical =
  window.location.hostname !== canonical &&
  window.location.hostname !== `www.${canonical}` &&
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("id-preview--") &&
  !window.location.hostname.includes("lovableproject.com");

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

const unregisterServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));
};

const clearCacheStorage = async () => {
  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();
  await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
};

const forceReloadWithRelease = () => {
  const reloadUrl = new URL(window.location.href);
  reloadUrl.searchParams.set(RELEASE_QUERY_KEY, APP_RELEASE);
  window.location.replace(reloadUrl.toString());
};

const removeReleaseQueryParam = () => {
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(RELEASE_QUERY_KEY)) return;

  currentUrl.searchParams.delete(RELEASE_QUERY_KEY);
  window.history.replaceState({}, "", currentUrl.toString());
};

const mountApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

const registerProductionServiceWorker = () => {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log("[PWA] Nova versão disponível, atualizando agora...");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("[PWA] App pronto para uso offline.");
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

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
  if (shouldRedirectToCanonical) {
    window.location.replace(`https://${canonical}${window.location.pathname}${window.location.search}`);
    return;
  }

  const storedRelease = localStorage.getItem(RELEASE_KEY);

  if (storedRelease && storedRelease !== APP_RELEASE) {
    console.log(`[ENAZIZI] Release changed ${storedRelease} → ${APP_RELEASE}. Clearing caches…`);
    await unregisterServiceWorkers();
    await clearCacheStorage();
    localStorage.setItem(RELEASE_KEY, APP_RELEASE);
    forceReloadWithRelease();
    return;
  }

  localStorage.setItem(RELEASE_KEY, APP_RELEASE);
  removeReleaseQueryParam();
  console.log(`[ENAZIZI] Release: ${APP_RELEASE}`);

  if (isPreviewHost || isInIframe) {
    await unregisterServiceWorkers();
    mountApp();
    return;
  }

  registerProductionServiceWorker();
  mountApp();
};

void boot();
