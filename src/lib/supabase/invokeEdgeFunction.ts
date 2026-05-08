/**
 * invokeEdgeFunction — defensive wrapper for authenticated Edge Functions.
 *
 * After Sprint 1 hardening, all sensitive Edge Functions verify the JWT
 * server-side via `getClaims`. The supabase-js client already attaches the
 * user's session token to `functions.invoke`, but this wrapper guarantees:
 *   • we fail fast if there's no session (no silent anon calls)
 *   • we transparently refresh once on 401 and retry
 *   • we surface a friendly UX message instead of "Autenticação obrigatória"
 *
 * Do NOT use this for public webhooks (auth-email-hook, whatsapp-*,
 * telegram-classroom, cron jobs) — those run without a user JWT.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export class EdgeFunctionAuthError extends Error {
  constructor(message = "Sua sessão expirou. Faça login novamente.") {
    super(message);
    this.name = "EdgeFunctionAuthError";
  }
}

interface InvokeOptions {
  /** Skip the automatic refresh + retry on 401 (default: false). */
  noRetryOnAuth?: boolean;
  /** Suppress the auth toast (caller handles UX). */
  silent?: boolean;
}

async function getValidAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function isAuthError(error: unknown): boolean {
  if (!error) return false;
  const anyErr = error as { status?: number; message?: string; context?: { status?: number } };
  if (anyErr.status === 401 || anyErr.context?.status === 401) return true;
  const msg = (anyErr.message || "").toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("autenticação obrigatória") ||
    msg.includes("token inválido") ||
    msg.includes("token invalido") ||
    msg.includes("jwt expired")
  );
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body?: unknown,
  options: InvokeOptions = {},
): Promise<{ data: T | null; error: Error | null }> {
  const token = await getValidAccessToken();
  if (!token) {
    if (!options.silent) {
      toast.error("Sua sessão expirou. Faça login novamente.");
    }
    return { data: null, error: new EdgeFunctionAuthError() };
  }

  const result = await supabase.functions.invoke<T>(functionName, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.error && isAuthError(result.error) && !options.noRetryOnAuth) {
    if (!options.silent) toast.message("Sua sessão expirou. Reconectando…");
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    const newToken = refreshed?.session?.access_token;
    if (refreshError || !newToken) {
      if (!options.silent) toast.error("Sua sessão expirou. Faça login novamente.");
      return { data: null, error: new EdgeFunctionAuthError() };
    }
    const retry = await supabase.functions.invoke<T>(functionName, {
      body,
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (retry.error && isAuthError(retry.error)) {
      if (!options.silent) toast.error("Sua sessão expirou. Faça login novamente.");
      return { data: null, error: new EdgeFunctionAuthError() };
    }
    return { data: retry.data ?? null, error: (retry.error as Error | null) ?? null };
  }

  return { data: result.data ?? null, error: (result.error as Error | null) ?? null };
}
