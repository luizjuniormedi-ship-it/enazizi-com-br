const LOCAL_STORAGE_PREFIXES_TO_PURGE = [
  "enazizi_mission_",
  "enazizi_dashboard_snapshot_",
  "enazizi_weekly_snap_",
  "enazizi_daily_plan_cache_",
  "rq-cache-",
];

const HARD_RESET_STEP_TIMEOUT_MS = 1500;

const settleWithin = async (operation: Promise<unknown>) => {
  let timeoutId: number | undefined;

  try {
    await Promise.race([
      operation,
      new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(resolve, HARD_RESET_STEP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

export const clearStaleLocalStorage = () => {
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

export const clearSessionStorage = (preserveEntries: Array<[string, string]> = []) => {
  try {
    sessionStorage.clear();
    preserveEntries.forEach(([key, value]) => {
      sessionStorage.setItem(key, value);
    });
  } catch {
    // ignore storage errors
  }
};

export const clearAllCacheStorage = async () => {
  if (!("caches" in window)) return;

  try {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
  } catch {
    // ignore cache API errors
  }
};

export const unregisterServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  } catch {
    // ignore service worker errors
  }
};

const deleteIndexedDbDatabase = (databaseName: string) =>
  new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });

export const clearIndexedDbStorage = async () => {
  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (!("indexedDB" in window) || typeof indexedDbWithDatabases.databases !== "function") return;

  try {
    const databases = await indexedDbWithDatabases.databases();
    const deletions = databases
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name))
      .map((name) => deleteIndexedDbDatabase(name));

    await Promise.allSettled(deletions);
  } catch {
    // ignore indexedDB errors
  }
};

export const performHardAppReset = async (options?: {
  preserveSessionEntries?: Array<[string, string]>;
}) => {
  clearStaleLocalStorage();
  clearSessionStorage(options?.preserveSessionEntries ?? []);

  // Browser storage APIs can remain pending forever (notably after a PWA
  // update). The app bootstrap must fail open so React can still mount and
  // authentication can decide the user's route.
  await settleWithin(unregisterServiceWorkers());
  await settleWithin(Promise.allSettled([clearAllCacheStorage(), clearIndexedDbStorage()]));
};
