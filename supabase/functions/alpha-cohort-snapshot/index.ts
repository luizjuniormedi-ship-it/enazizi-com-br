// ============================================================
// EVNP Fase 1 — Alpha Cohort Snapshot
// Captura D0/D30/D60/D90 de cada membro da coorte.
// GUARD-RAILS: sem correlação, sem effect size, sem ranking,
// sem dashboard nacional, sem export, sem aprovação agregada.
// Apenas armazenamento bruto de telemetria já existente.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CHECKPOINTS: Array<{ key: "d0" | "d30" | "d60" | "d90"; days: number }> = [
  { key: "d0", days: 0 },
  { key: "d30", days: 30 },
  { key: "d60", days: 60 },
  { key: "d90", days: 90 },
];

const TOLERANCE_DAYS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Membros das coortes EVNP
    const { data: members, error: mErr } = await supabase
      .from("academic_cohort_members")
      .select("user_id, cohort_id, joined_at, academic_cohorts!inner(id, name, metadata)")
      .eq("academic_cohorts.metadata->>program", "EVNP");

    if (mErr) throw mErr;

    const now = Date.now();
    let created = 0, skipped = 0;
    const log: any[] = [];

    for (const m of members ?? []) {
      const ageDays = Math.floor((now - new Date(m.joined_at).getTime()) / 86400000);

      for (const cp of CHECKPOINTS) {
        if (Math.abs(ageDays - cp.days) > TOLERANCE_DAYS) continue;

        // dedupe
        const { data: existing } = await supabase
          .from("alpha_cohort_snapshots")
          .select("id")
          .eq("cohort_id", m.cohort_id)
          .eq("user_id", m.user_id)
          .eq("checkpoint", cp.key)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        // Captura telemetria existente (read-only, sem cálculos novos)
        const since7d = new Date(now - 7 * 86400000).toISOString();

        const [readinessRes, fsrsRes, sessionsRes, simRes, tutorRes] = await Promise.all([
          supabase.from("student_exam_readiness").select("readiness_score").eq("user_id", m.user_id).maybeSingle(),
          supabase.from("fsrs_cards").select("id", { count: "exact", head: true }).eq("user_id", m.user_id).lte("due", new Date().toISOString()),
          supabase.from("study_action_events").select("duration_seconds").eq("user_id", m.user_id).gte("created_at", since7d),
          supabase.from("simulado_sessions").select("id", { count: "exact", head: true }).eq("user_id", m.user_id).gte("created_at", since7d),
          supabase.from("tutor_sessions").select("id", { count: "exact", head: true }).eq("user_id", m.user_id).gte("created_at", since7d),
        ]);

        const studyMin = Math.round(
          ((sessionsRes.data ?? []).reduce((s: number, e: any) => s + (e.duration_seconds ?? 0), 0)) / 60,
        );

        const { error: insErr } = await supabase.from("alpha_cohort_snapshots").insert({
          cohort_id: m.cohort_id,
          user_id: m.user_id,
          checkpoint: cp.key,
          readiness: readinessRes.data?.readiness_score ?? null,
          fsrs_due_count: fsrsRes.count ?? 0,
          study_minutes_7d: studyMin,
          tutor_sessions_7d: tutorRes.count ?? 0,
          simulado_count: simRes.count ?? 0,
          metadata: { age_days: ageDays, captured_via: "alpha-cohort-snapshot" },
        });

        if (insErr) {
          log.push({ user_id: m.user_id, checkpoint: cp.key, error: insErr.message });
        } else {
          created++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, members: members?.length ?? 0, created, skipped, errors: log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
