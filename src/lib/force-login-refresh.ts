import type { Session } from "@supabase/supabase-js";
import {
  APP_RELEASE,
  LOGIN_REFRESH_SIGNATURE_KEY,
  RELEASE_KEY,
  buildAppRefreshUrl,
  getLoginRefreshSignature,
} from "./app-release";
import { performHardAppReset } from "./app-hard-reset";

export const forceLoginRefresh = async (session: Session | null) => {
  const loginSignature = getLoginRefreshSignature(session);
  if (!loginSignature) return false;

  const previousSignature = sessionStorage.getItem(LOGIN_REFRESH_SIGNATURE_KEY);
  if (previousSignature === loginSignature) return false;

  await performHardAppReset({
    preserveSessionEntries: [[LOGIN_REFRESH_SIGNATURE_KEY, loginSignature]],
  });

  sessionStorage.setItem(LOGIN_REFRESH_SIGNATURE_KEY, loginSignature);
  localStorage.setItem(RELEASE_KEY, APP_RELEASE);

  const nextUrl = buildAppRefreshUrl(window.location.href);
  window.location.replace(nextUrl.toString());
  return true;
};

export const clearLoginRefreshSignature = () => {
  sessionStorage.removeItem(LOGIN_REFRESH_SIGNATURE_KEY);
};