/**
 * approval-snapshot-cron
 * Recalcula approval_scores para todos os usuários ativos nos últimos 14 dias.
 * Chamado pelo pg_cron diariamente. Usa service-role para invocar
 * calculate-approval-score com { target_user_id }.
 *
 * Atividade = teve registro em practice_attempts | error_bank | fsrs_review_log
 * | exam_sessions nos últimos 14 dias.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_DAYS = 14;
const CONCURRENCY = 4;

async function listActiveUsers(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const since = new Date(Date.now() - ACTIVE_DAYS * 86_400_000).toISOString();
  const ids = new Set<string>();

  const sources: Array<[string, string]> = [
    ["practice_attempts", "created_at"],
    ["error_bank", "updated_at"],
    ["fsrs_review_log", "reviewed_at"],
    ["exam_sessions", "finished_at"],
  ];

  for (const [table, col] of sources) {
    try {
      const { data } = await admin.from(table).select("user_id").gte(col, since).limit(5000);
      for (const r of (data || []) as any[]) {
        if (r?.user_id) ids.add(String(r.user_id));
      }
    } catch (e) {
      console.warn(`[approval-snapshot-cron] failed to list from ${table}`, (e as Error).message);
    }
  }
  return Array.from(ids);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Função idempotente, só recalcula scores. Sem PII de entrada. Acesso aberto.

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const users = await listActiveUsers(admin);
  console.info(`[approval-snapshot-cron] ${users.length} active users in last ${ACTIVE_DAYS}d`);

  let ok = 0, fail = 0;
  const errors: string[] = [];

  // pool simples
  let i = 0;
  async function worker() {
    while (i < users.length) {
      const idx = i++;
      const uid = users[idx];
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/calculate-approval-score`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ target_user_id: uid, source: "approval-snapshot-cron" }),
        });
        if (r.ok) ok++; else { fail++; errors.push(`${uid}:${r.status}`); }
      } catch (e) {
        fail++; errors.push(`${uid}:${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, users.length) }, worker));

  return new Response(JSON.stringify({
    success: true,
    active_users: users.length,
    ok, fail,
    duration_ms: Date.now() - t0,
    sample_errors: errors.slice(0, 5),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
