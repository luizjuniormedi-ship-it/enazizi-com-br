import type { Session } from "@supabase/supabase-js";

export const APP_RELEASE = "2026-04-19-v19";
export const RELEASE_KEY = "enazizi_release";
export const RELEASE_QUERY_KEY = "__app_release";
export const CACHE_BUST_QUERY_KEY = "__r";
export const LOGIN_REFRESH_QUERY_KEY = "__login_refresh";
export const LOGIN_REFRESH_SIGNATURE_KEY = "enazizi_login_refresh_signature";

export const buildAppRefreshUrl = (currentUrl: string | URL) => {
  const nextUrl = currentUrl instanceof URL ? new URL(currentUrl.toString()) : new URL(currentUrl);

  nextUrl.searchParams.set(RELEASE_QUERY_KEY, APP_RELEASE);
  nextUrl.searchParams.set(CACHE_BUST_QUERY_KEY, `${APP_RELEASE}-${Date.now()}`);
  nextUrl.searchParams.set(LOGIN_REFRESH_QUERY_KEY, "1");

  return nextUrl;
};

export const removeAppRefreshQueryParams = (currentUrl: string | URL) => {
  const nextUrl = currentUrl instanceof URL ? new URL(currentUrl.toString()) : new URL(currentUrl);

  nextUrl.searchParams.delete(RELEASE_QUERY_KEY);
  nextUrl.searchParams.delete(CACHE_BUST_QUERY_KEY);
  nextUrl.searchParams.delete(LOGIN_REFRESH_QUERY_KEY);

  return nextUrl;
};

export const getLoginRefreshSignature = (session: Session | null) => {
  const userId = session?.user?.id;
  if (!userId) return null;

  const lastSignInAt = session.user.last_sign_in_at ?? session.user.created_at ?? "unknown";
  const expiresAt = session.expires_at ?? "unknown";

  return `${APP_RELEASE}:${userId}:${lastSignInAt}:${expiresAt}`;
};