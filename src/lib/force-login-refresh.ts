import type { Session } from "@supabase/supabase-js";
import {
  APP_RELEASE,
  LOGIN_REFRESH_SIGNATURE_KEY,
  RELEASE_KEY,
  buildAppRefreshUrl,
  getLoginRefreshSignature,
} from "./app-release";
import { performHardAppReset } from "./app-hard-reset";

// Module-level guard: prevents two concurrent SIGNED_IN listeners (e.g. auth
// state change + visibility change) from both firing the hard reset within
// the same JS realm before the page actually reloads.
let forceRefreshInFlight = false;

export const forceLoginRefresh = async (session: Session | null) => {
  if (forceRefreshInFlight) return false;

  const loginSignature = getLoginRefreshSignature(session);
  if (!loginSignature) {
    console.debug("[Auth] No login signature available");
    return false;
  }

  const previousSignature = sessionStorage.getItem(LOGIN_REFRESH_SIGNATURE_KEY);
  console.debug("[Auth] Signature check:", { previous: previousSignature, current: loginSignature });
  
  if (previousSignature === loginSignature) {
    console.debug("[Auth] Signature match, skipping refresh");
    return false;
  }

  forceRefreshInFlight = true;

  try {
    console.info(
      `[ENAZIZI] Force login refresh fired — release=${APP_RELEASE}`
    );

    await performHardAppReset({
      preserveSessionEntries: [[LOGIN_REFRESH_SIGNATURE_KEY, loginSignature]],
    });

    sessionStorage.setItem(LOGIN_REFRESH_SIGNATURE_KEY, loginSignature);
    localStorage.setItem(RELEASE_KEY, APP_RELEASE);

    const nextUrl = buildAppRefreshUrl(window.location.href);
    window.location.replace(nextUrl.toString());
    return true;
  } catch (err) {
    // If anything fails, release the guard so a subsequent attempt can retry.
    forceRefreshInFlight = false;
    console.warn("[ENAZIZI] forceLoginRefresh failed:", err);
    return false;
  }
};

export const clearLoginRefreshSignature = () => {
  sessionStorage.removeItem(LOGIN_REFRESH_SIGNATURE_KEY);
};