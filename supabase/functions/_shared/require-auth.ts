/**
 * require-auth — Loop 3E hardening helper.
 *
 * Single source of truth for authenticating a caller before any
 * AI call or sensitive write. Pattern:
 *
 *   const auth = await requireAuth(req);
 *   if (!auth.ok) return auth.response;
 *   const userId = auth.userId;
 *
 * Strategy: getClaims() first (cheap, signature-only, no network).
 * If that fails (older signing-keys, malformed token, etc.) fall back
 * to getUser() (network call to /auth/v1/user) with the supplied JWT.
 * Only return ok when we actually resolved a user id.
 *
 * Always returns a JSON 401 envelope with a requestId on failure — never
 * a bare string, never a 500 — so the frontend can show a friendly toast
 * and so we never burn AI credits on anonymous calls.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function unauthorizedResponse(message: string, requestId: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "UNAUTHORIZED",
      message,
      requestId,
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export type RequireAuthResult =
  | { ok: true; userId: string; token: string; requestId: string }
  | { ok: false; response: Response; requestId: string };

export async function requireAuth(req: Request): Promise<RequireAuthResult> {
  const requestId = newRequestId();

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      requestId,
      response: unauthorizedResponse("Usuário não autenticado.", requestId),
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return {
      ok: false,
      requestId,
      response: unauthorizedResponse("Usuário não autenticado.", requestId),
    };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[require-auth] Missing SUPABASE_URL / SUPABASE_ANON_KEY");
    return {
      ok: false,
      requestId,
      response: unauthorizedResponse("Servidor mal configurado.", requestId),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // 1) getClaims — cheap, JWKS-based.
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (!error && sub) {
      return { ok: true, userId: String(sub), token, requestId };
    }
  } catch (e) {
    console.warn("[require-auth] getClaims threw, falling back to getUser:", e);
  }

  // 2) Fallback: getUser (network call).
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) {
      return { ok: true, userId: data.user.id, token, requestId };
    }
  } catch (e) {
    console.warn("[require-auth] getUser threw:", e);
  }

  return {
    ok: false,
    requestId,
    response: unauthorizedResponse("Usuário não autenticado.", requestId),
  };
}

export { corsHeaders as authCorsHeaders };
