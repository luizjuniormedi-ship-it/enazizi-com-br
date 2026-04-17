const LOCAL_STORAGE_PREFIXES_TO_PURGE = [
  "enazizi_mission_",
  "enazizi_dashboard_snapshot_",
  "enazizi_weekly_snap_",
  "enazizi_daily_plan_cache_",
  "rq-cache-",
];

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

  await unregisterServiceWorkers();
  await Promise.allSettled([clearAllCacheStorage(), clearIndexedDbStorage()]);
};