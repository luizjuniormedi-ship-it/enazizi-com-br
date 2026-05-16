/**
 * standard-handler — Sprint 1 hardening.
 *
 * Wraps an edge-function handler with:
 *   • CORS
 *   • Real JWT validation (uses getUser, no longer trusts the header alone)
 *   • Body parsing
 *   • Standard error envelope
 *
 * BEFORE: any request with ANY non-empty Authorization header was accepted
 *         and userId was a hardcoded "authenticated-user" string. This
 *         meant functions deployed with verify_jwt=false had effectively
 *         NO authentication at all.
 *
 * AFTER:  the JWT is verified server-side via supabase.auth.getUser().
 *         If invalid or missing, the request is rejected with 401.
 *         The real user id is forwarded to the handler.
 */
import { serve as _serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Re-export so existing edge functions can keep importing { serve } from here
// if they want, without adding new direct dependencies.
export { _serve as serve };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleStandardEdgeFunction(
  req: Request,
  handler: (body: any, userId: string) => Promise<Response>,
) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        { success: false, error: "UNAUTHORIZED", message: "Autenticação obrigatória." },
        401,
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("[standard-handler] Missing SUPABASE_URL / SUPABASE_ANON_KEY");
      return jsonResponse(
        { success: false, error: "SERVER_MISCONFIG", message: "Servidor mal configurado." },
        500,
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // getUser verifies the JWT signature and returns the user object.
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user?.id) {
      return jsonResponse(
        { success: false, error: "UNAUTHORIZED", message: "Token inválido ou expirado." },
        401,
      );
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));

    const response = await handler(body, userId);

    // Ensure CORS on every handler response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (e) {
    console.error("[standard-handler] error:", e);
    return jsonResponse(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: e instanceof Error ? e.message : "Erro interno no servidor.",
      },
      500,
    );
  }
}
