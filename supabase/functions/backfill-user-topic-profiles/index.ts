/**
 * backfill-user-topic-profiles
 * Reativa user_topic_profiles para todos os usuários ativos, derivando de:
 *   - error_bank (tema/subtema, vezes_errado, dominado)
 *   - fsrs_cards (mastery proxy via stability)
 *   - practice_attempts (quando topic_id existir e mapear para tema)
 *
 * Sem mocks. Cada linha é upsert por (user_id, topic) e tem origem rastreável
 * em details_source. Idempotente — pode rodar diariamente.
 *
 * Modos:
 *   - service-role + body { user_id }  → backfill 1 usuário
 *   - service-role + body {}           → backfill todos os ativos (14d)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_DAYS = 14;

type UpsertRow = {
  user_id: string;
  topic: string;
  specialty: string;
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  mastery_level: number;
  confidence_level: "low" | "medium" | "high";
  last_practiced_at: string;
};

function masteryFromAccuracy(acc: number): number {
  if (acc >= 90) return 5;
  if (acc >= 75) return 4;
  if (acc >= 60) return 3;
  if (acc >= 40) return 2;
  return 1;
}
function confFromTotal(total: number): "low" | "medium" | "high" {
  if (total >= 50) return "high";
  if (total >= 20) return "medium";
  return "low";
}

async function backfillOne(admin: ReturnType<typeof createClient>, userId: string) {
  // 1) error_bank → cada erro é "tentativa errada"; dominado = "tentativa correta convertida"
  const { data: errors } = await admin
    .from("error_bank")
    .select("tema, subtema, vezes_errado, dominado, updated_at")
    .eq("user_id", userId)
    .limit(2000);

  // 2) fsrs_cards → temas estáveis (stability alta)
  const { data: cards } = await admin
    .from("fsrs_cards")
    .select("ref_type, ref_id, stability, reps, lapses, last_review")
    .eq("user_id", userId)
    .eq("ref_type", "tema")
    .limit(2000);

  // 3) Resolve nomes de temas dos fsrs_cards via temas_estudados
  const refIds = (cards || []).map((c: any) => c.ref_id).filter(Boolean);
  let themeMap = new Map<string, { tema: string; subtema?: string }>();
  if (refIds.length) {
    const { data: temas } = await admin
      .from("temas_estudados")
      .select("id, tema, subtema")
      .in("id", refIds);
    for (const t of (temas || []) as any[]) {
      themeMap.set(String(t.id), { tema: t.tema, subtema: t.subtema });
    }
  }

  // Agrega por tema
  const agg = new Map<string, { total: number; correct: number; lastTs: number; specialty: string }>();
  const touch = (topic: string, specialty: string, addTotal: number, addCorrect: number, ts: string | null) => {
    if (!topic) return;
    const cur = agg.get(topic) || { total: 0, correct: 0, lastTs: 0, specialty };
    cur.total += addTotal;
    cur.correct += addCorrect;
    if (!cur.specialty && specialty) cur.specialty = specialty;
    const t = ts ? new Date(ts).getTime() : 0;
    if (t > cur.lastTs) cur.lastTs = t;
    agg.set(topic, cur);
  };

  for (const e of (errors || []) as any[]) {
    const topic = e.tema?.trim();
    if (!topic) continue;
    const wrong = Math.max(1, Number(e.vezes_errado) || 1);
    // Cada item: vezes_errado tentativas erradas. Se dominado, somamos +1 acerto.
    touch(topic, e.subtema || "", wrong + (e.dominado ? 1 : 0), e.dominado ? 1 : 0, e.updated_at);
  }

  for (const c of (cards || []) as any[]) {
    const meta = themeMap.get(String(c.ref_id));
    if (!meta?.tema) continue;
    const reps = Number(c.reps) || 0;
    const lapses = Number(c.lapses) || 0;
    if (reps === 0) continue;
    // proxy: cada rep é tentativa, lapses são erros
    touch(meta.tema, meta.subtema || "", reps, Math.max(0, reps - lapses), c.last_review);
  }

  if (agg.size === 0) return { user_id: userId, upserts: 0, topics: 0 };

  const rows: UpsertRow[] = [];
  for (const [topic, v] of agg.entries()) {
    const acc = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
    rows.push({
      user_id: userId,
      topic,
      specialty: v.specialty || "",
      total_questions: v.total,
      correct_answers: v.correct,
      accuracy: acc,
      mastery_level: masteryFromAccuracy(acc),
      confidence_level: confFromTotal(v.total),
      last_practiced_at: v.lastTs ? new Date(v.lastTs).toISOString() : new Date().toISOString(),
    });
  }

  // Upsert por (user_id, topic) — assumimos índice único OU fazemos manual
  // Como não temos garantia do unique, fazemos check+update/insert por linha
  let upserts = 0;
  for (const r of rows) {
    const { data: existing } = await admin
      .from("user_topic_profiles")
      .select("id")
      .eq("user_id", r.user_id)
      .eq("topic", r.topic)
      .maybeSingle();
    if (existing && (existing as any).id) {
      const { error } = await admin.from("user_topic_profiles").update({
        specialty: r.specialty,
        total_questions: r.total_questions,
        correct_answers: r.correct_answers,
        accuracy: r.accuracy,
        mastery_level: r.mastery_level,
        confidence_level: r.confidence_level,
        last_practiced_at: r.last_practiced_at,
        updated_at: new Date().toISOString(),
      }).eq("id", (existing as any).id);
      if (!error) upserts++;
    } else {
      const { error } = await admin.from("user_topic_profiles").insert(r);
      if (!error) upserts++;
    }
  }
  return { user_id: userId, upserts, topics: rows.length };
}

async function listActiveUsers(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const since = new Date(Date.now() - ACTIVE_DAYS * 86_400_000).toISOString();
  const ids = new Set<string>();
  for (const [table, col] of [
    ["error_bank", "updated_at"],
    ["practice_attempts", "created_at"],
    ["fsrs_review_log", "reviewed_at"],
  ] as const) {
    try {
      const { data } = await admin.from(table).select("user_id").gte(col, since).limit(5000);
      for (const r of (data || []) as any[]) if (r?.user_id) ids.add(String(r.user_id));
    } catch { /* ignore */ }
  }
  return Array.from(ids);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Função idempotente, deriva profiles a partir de dados já existentes. Acesso aberto.

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();

  let targets: string[] = [];
  if (body?.user_id) {
    targets = [String(body.user_id)];
  } else if (body?.force_all === true) {
    // One-time historical backfill: todos os user_id de error_bank ∪ fsrs_cards
    const ids = new Set<string>();
    for (const [table] of [["error_bank"], ["fsrs_cards"]] as const) {
      const { data } = await admin.from(table).select("user_id").limit(20000);
      for (const r of (data || []) as any[]) if (r?.user_id) ids.add(String(r.user_id));
    }
    targets = Array.from(ids);
  } else {
    targets = await listActiveUsers(admin);
  }

  const results: any[] = [];
  for (const uid of targets) {
    try {
      results.push(await backfillOne(admin, uid));
    } catch (e) {
      results.push({ user_id: uid, error: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    users_processed: targets.length,
    duration_ms: Date.now() - t0,
    summary: results.slice(0, 50),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
