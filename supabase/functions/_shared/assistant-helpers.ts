/**
 * Shared helpers for API Assistente edge functions.
 * All functions use service_role for DB access.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, corsResponse } from "./cors.ts";

export { corsHeaders };

export function jsonResponse(body: unknown, status = 200): Response {
  return corsResponse(body, status);
}

export function errorResponse(msg: string, status = 400): Response {
  return jsonResponse({ success: false, error: msg }, status);
}

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getUserIdFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Token ausente.");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Autenticação falhou.");
  return data.user.id;
}

/** Safe query helper — never throws, returns null on error */
export async function safeQuery<T>(
  db: SupabaseClient,
  fn: (client: SupabaseClient) => PromiseLike<{ data: T | null; error: any }>,
  label: string
): Promise<T | null> {
  try {
    const { data, error } = await fn(db);
    if (error) console.warn(`[Assistant] ${label}:`, error.message);
    return data;
  } catch (e) {
    console.warn(`[Assistant] ${label} exception:`, e);
    return null;
  }
}

/** Log a decision to assistant_decisions */
export async function logDecision(
  db: SupabaseClient,
  params: {
    user_id: string;
    decision_type: string;
    source_module: string;
    input_snapshot: Record<string, unknown>;
    decision_output: Record<string, unknown>;
    justification: string;
    confidence_score?: number;
  }
): Promise<{ id: string | null }> {
  const { data, error } = await db
    .from("assistant_decisions")
    .insert({
      user_id: params.user_id,
      decision_type: params.decision_type,
      source_module: params.source_module,
      input_snapshot: params.input_snapshot,
      decision_output: params.decision_output,
      justification: params.justification,
      confidence_score: params.confidence_score ?? null,
    })
    .select("id")
    .single();
  if (error) {
    // Loop 4B-idempotência: 23505 = unique violation no event_hash → decisão duplicada já existe; tratar como sucesso silencioso.
    if ((error as { code?: string }).code === "23505") {
      console.info("[Assistant] logDecision dedup (event_hash conflict)", {
        decision_type: params.decision_type,
        source_module: params.source_module,
      });
      return { id: null };
    }
    console.error("[Assistant] logDecision failed:", error.message);
    return { id: null };
  }
  return { id: (data as { id: string }).id };
}

/** Log an intervention to adaptive_interventions */
export async function logAdaptiveIntervention(
  db: SupabaseClient,
  params: {
    user_id: string;
    trigger_type: string;
    action_taken: string;
    context_node_id?: string;
    video_lesson_id?: string;
    friction_score_snapshot: number;
    recommendation_text: string;
    action_payload?: Record<string, unknown>;
    status?: 'shadow' | 'pending' | 'accepted' | 'ignored';
  }
): Promise<{ id: string | null }> {
  const { data, error } = await db
    .from("adaptive_interventions")
    .insert(params)
    .select("id")
    .single();
  if (error) {
    console.error("[Assistant] logAdaptiveIntervention failed:", error.message);
    return { id: null };
  }
  return { id: (data as { id: string }).id };
}
