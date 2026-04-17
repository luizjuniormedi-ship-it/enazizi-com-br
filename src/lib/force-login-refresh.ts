import type { Session } from "@supabase/supabase-js";
import {
  APP_RELEASE,
  LOGIN_REFRESH_SIGNATURE_KEY,
  RELEASE_KEY,
  buildAppRefreshUrl,
  getLoginRefreshSignature,
} from "./app-release";

const LOCAL_STORAGE_PREFIXES_TO_PURGE = [
  "enazizi_mission_",
  "enazizi_dashboard_snapshot_",
  "enazizi_weekly_snap_",
  "enazizi_daily_plan_cache_",
  "rq-cache-",
];

const clearStaleLocalStorage = () => {
  const keysToPurge = Object.keys(localStorage).filter((key) =>
    LOCAL_STORAGE_PREFIXES_TO_PURGE.some((prefix) => key.startsWith(prefix))
  );

  keysToPurge.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  });
};

const clearAllCacheStorage = async () => {
  if (!("caches" in window)) return;

  try {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
  } catch {
    // ignore cache API errors
  }
};

const updateAllServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) return;

    let waitingWorkerFound = false;

    const controllerChanged = new Promise<void>((resolve) => {
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true });
      window.setTimeout(finish, 1500);
    });

    await Promise.allSettled(
      registrations.map(async (registration) => {
        await registration.update().catch(() => undefined);

        if (registration.waiting) {
          waitingWorkerFound = true;
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      })
    );

    if (waitingWorkerFound) {
      await controllerChanged;
    }
  } catch {
    // ignore service worker errors
  }
};

export const forceLoginRefresh = async (session: Session | null) => {
  const loginSignature = getLoginRefreshSignature(session);
  if (!loginSignature) return false;

  const previousSignature = sessionStorage.getItem(LOGIN_REFRESH_SIGNATURE_KEY);
  if (previousSignature === loginSignature) return false;

  sessionStorage.setItem(LOGIN_REFRESH_SIGNATURE_KEY, loginSignature);
  localStorage.setItem(RELEASE_KEY, APP_RELEASE);

  clearStaleLocalStorage();
  await clearAllCacheStorage();
  await updateAllServiceWorkers();

  const nextUrl = buildAppRefreshUrl(window.location.href);
  window.location.replace(nextUrl.toString());
  return true;
};

export const clearLoginRefreshSignature = () => {
  sessionStorage.removeItem(LOGIN_REFRESH_SIGNATURE_KEY);
};