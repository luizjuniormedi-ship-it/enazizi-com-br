// Sprint Gold-1 — Heurística inicial de qualidade (sem IA)
// Roda em lotes sobre gold_questions_metadata.quality_score IS NULL
// Critérios (max 110, cap em 100):
//   stem >= 400 chars              : +20
//   options 4-5 entries            : +20
//   correct_index definido         : +20
//   explanation com conteúdo       : +20
//   specialty_id definido          : +10
//   source_type oficial/prova/real : +10
//   sem english leak               : +10
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENGLISH_LEAK = /\b(however|therefore|thus|moreover|whereas|nonetheless|furthermore|hence|the patient is|the diagnosis is|management of)\b/i;
const OFFICIAL_SOURCES = /(oficial|prova|real|residencia|enem|enare|amrigs|amp|sus)/i;

function scoreQuestion(q: any): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let score = 0;

  const stem = (q.statement ?? "").toString();
  if (stem.trim().length >= 400) { score += 20; breakdown.stem_long = 20; }

  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length >= 4 && opts.length <= 5 && opts.every((o: any) => o && String(o).trim().length > 0)) {
    score += 20; breakdown.options_complete = 20;
  }

  if (q.correct_index !== null && q.correct_index !== undefined) {
    score += 20; breakdown.correct_answer = 20;
  }

  const expl = (q.explanation ?? "").toString();
  if (expl.trim().length >= 50) { score += 20; breakdown.explanation = 20; }

  if (q.specialty_id) { score += 10; breakdown.specialty = 10; }

  if (q.source_type && OFFICIAL_SOURCES.test(String(q.source_type))) {
    score += 10; breakdown.official_source = 10;
  }

  const haystack = `${stem} ${expl}`;
  if (!ENGLISH_LEAK.test(haystack)) { score += 10; breakdown.no_english_leak = 10; }

  return { score: Math.min(100, score), breakdown };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 500), 2000);
    const recompute: boolean = !!body.recompute;

    // Buscar IDs elegíveis (questions_bank only nesta sprint)
    let metaQuery = supabase
      .from("gold_questions_metadata")
      .select("id, question_id")
      .eq("question_source", "questions_bank")
      .limit(limit);
    if (!recompute) metaQuery = metaQuery.is("quality_score", null);

    const { data: metas, error: metaErr } = await metaQuery;
    if (metaErr) throw metaErr;
    if (!metas || metas.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "Nenhuma questão pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qIds = metas.map((m) => m.question_id);
    const { data: qs, error: qErr } = await supabase
      .from("questions_bank")
      .select("id, statement, options, correct_index, explanation, specialty_id, source_type")
      .in("id", qIds);
    if (qErr) throw qErr;

    const qMap = new Map((qs ?? []).map((q) => [q.id, q]));
    const now = new Date().toISOString();
    const distribution: Record<string, number> = {};
    let processed = 0, failed = 0;

    // Update em batches de 50
    const updates: any[] = [];
    for (const m of metas) {
      const q = qMap.get(m.question_id);
      if (!q) { failed++; continue; }
      const { score } = scoreQuestion(q);
      const bucket = `${Math.floor(score / 10) * 10}`;
      distribution[bucket] = (distribution[bucket] ?? 0) + 1;
      updates.push({
        id: m.id,
        quality_score: score,
        quality_score_method: "heuristic",
        quality_score_computed_at: now,
      });
    }

    // Upsert em lotes
    const CHUNK = 100;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const slice = updates.slice(i, i + CHUNK);
      const { error: upErr } = await supabase
        .from("gold_questions_metadata")
        .upsert(slice, { onConflict: "id" });
      if (upErr) { console.error("[gold-heuristic] upsert error", upErr); failed += slice.length; }
      else processed += slice.length;
    }

    return new Response(
      JSON.stringify({ ok: true, processed, failed, distribution, sample_size: metas.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[gold-heuristic] fatal", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
