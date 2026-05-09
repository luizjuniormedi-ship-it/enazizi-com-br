// Cockpit Cognitivo — agrega métricas de aprendizagem do aluno em uma chamada
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safe<T>(p: Promise<T>, fb: T): Promise<T> {
  return p.then((v) => v ?? fb).catch(() => fb);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const today = new Date().toISOString();
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_study_plan_reset_at")
      .eq("user_id", uid)
      .maybeSingle();
    const resetAt = profile?.last_study_plan_reset_at ?? "1900-01-01T00:00:00Z";

    const [
      errorsRes,
      mnemUtilRes,
      mnemStatsRes,
      fsrsDueRes,
      fsrsAllRes,
      revisoesPendRes,
      practiceRecentRes,
      visualSkillRes,
      mnemFeedbackRes,
    ] = await Promise.all([
      safe(
        supabase
          .from("error_bank")
          .select("tema, subtema, vezes_errado, dificuldade, updated_at, dominado")
          .eq("user_id", uid)
          .eq("dominado", false)
          .gt("updated_at", resetAt)
          .order("vezes_errado", { ascending: false })
          .limit(20),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase
          .from("mnemonic_utility_agg")
          .select("*")
          .eq("user_id", uid)
          .order("avg_utility", { ascending: false })
          .limit(20),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase.from("v_mnemonic_user_stats").select("*").eq("user_id", uid).maybeSingle(),
        { data: null } as any,
      ),
      safe(
        supabase
          .from("fsrs_cards")
          .select("id, card_type, due, stability, lapses, state")
          .eq("user_id", uid)
          .lte("due", today)
          .gt("updated_at", resetAt)
          .order("due", { ascending: true })
          .limit(50),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase.from("fsrs_cards").select("stability, lapses, state").eq("user_id", uid).gt("updated_at", resetAt).limit(500),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase
          .from("revisoes")
          .select("id, tipo_revisao, prioridade, risco_esquecimento, data_revisao, status")
          .eq("user_id", uid)
          .eq("status", "pendente")
          .gt("created_at", resetAt)
          .order("data_revisao", { ascending: true })
          .limit(20),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase
          .from("practice_attempts")
          .select("correct, created_at")
          .eq("user_id", uid)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(500),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase
          .from("visual_skill_snapshots")
          .select("image_type, accuracy, score, trend, attempts_count, weakest_area")
          .eq("user_id", uid),
        { data: [] as any[] } as any,
      ),
      safe(
        supabase
          .from("mnemonic_feedback")
          .select("rating_general, utility_score, created_at")
          .eq("user_id", uid)
          .gte("created_at", sevenDaysAgo)
          .gt("created_at", resetAt)
          .limit(200),
        { data: [] as any[] } as any,
      ),
    ]);

    const errors = errorsRes.data ?? [];
    const mnemUtility = mnemUtilRes.data ?? [];
    const mnemStats = mnemStatsRes.data ?? null;
    const fsrsDue = fsrsDueRes.data ?? [];
    const fsrsAll = fsrsAllRes.data ?? [];
    const revisoesPend = revisoesPendRes.data ?? [];
    const practice7d = practiceRecentRes.data ?? [];
    const visualSkill = visualSkillRes.data ?? [];
    const mnemFeedback7d = mnemFeedbackRes.data ?? [];

    // Acurácia 7d
    const total7d = practice7d.length;
    const correct7d = practice7d.filter((a: any) => a.correct).length;
    const accuracy7d = total7d > 0 ? Math.round((correct7d / total7d) * 100) : 0;

    // FSRS aggregate
    const stabilities = fsrsAll.map((c: any) => Number(c.stability) || 0);
    const avgStability =
      stabilities.length > 0 ? Math.round((stabilities.reduce((a, b) => a + b, 0) / stabilities.length) * 10) / 10 : 0;
    const totalLapses = fsrsAll.reduce((s: number, c: any) => s + (c.lapses || 0), 0);
    const fsrsDueCount = fsrsDue.length;

    // Mnemônicos úteis vs ruins
    const mnemUseful = mnemUtility.filter((m: any) => Number(m.avg_utility) >= 3 || Number(m.avg_rating) >= 4).slice(0, 5);
    const mnemBad = mnemUtility
      .filter(
        (m: any) =>
          (Number(m.avg_utility) > 0 && Number(m.avg_utility) < 2.5) ||
          Number(m.negative_count) >= Number(m.positive_count),
      )
      .slice(0, 5);

    // Top fraquezas
    const topWeaknesses = errors.slice(0, 6).map((e: any) => ({
      tema: e.tema,
      subtema: e.subtema,
      erros: e.vezes_errado,
      dificuldade: e.dificuldade,
      ultimo: e.updated_at,
    }));

    // Visual: encontrar pontos mais fracos
    const visualWeaknesses = visualSkill
      .filter((v: any) => Number(v.accuracy) < 0.7 && v.attempts_count > 0)
      .sort((a: any, b: any) => Number(a.accuracy) - Number(b.accuracy))
      .slice(0, 3);

    // Radar de modalidades (utility 0-100)
    const radar = {
      mnemonicos: mnemUtility.length > 0
        ? Math.round(
            (mnemUtility.reduce((s: number, m: any) => s + Number(m.avg_utility || 0), 0) / mnemUtility.length) * 25,
          )
        : 0,
      quizVisual: visualSkill.length > 0
        ? Math.round(
            visualSkill.reduce((s: number, v: any) => s + Number(v.score || 0), 0) / visualSkill.length,
          )
        : 0,
      questoes: accuracy7d,
      revisaoFsrs: Math.max(0, Math.min(100, Math.round(avgStability * 10))),
      simulados: 0,
      tutorIa: 0,
    };

    // Alertas cognitivos
    const alerts: Array<{ kind: string; severity: "high" | "medium" | "low"; message: string }> = [];
    if (errors.length >= 5) {
      alerts.push({
        kind: "errors",
        severity: "high",
        message: `Você tem ${errors.length} temas com erros não dominados. Foco em ${errors[0]?.tema}.`,
      });
    }
    if (fsrsDueCount >= 10) {
      alerts.push({
        kind: "fsrs",
        severity: "high",
        message: `${fsrsDueCount} revisões vencidas. Limpar agora aumenta sua retenção.`,
      });
    }
    if (mnemBad.length > 0) {
      alerts.push({
        kind: "mnemonic",
        severity: "medium",
        message: `Mnemônico de "${mnemBad[0].tema}" não está ajudando. Regenere para uma versão mais visual.`,
      });
    }
    if (visualWeaknesses.length > 0) {
      const w = visualWeaknesses[0];
      alerts.push({
        kind: "visual",
        severity: "medium",
        message: `Acurácia em ${w.image_type} está em ${Math.round(Number(w.accuracy) * 100)}%. Treine quiz visual.`,
      });
    }

    // Próximos passos
    const nextSteps: Array<{ id: string; title: string; cta: string; route: string; priority: "primary" | "secondary" | "quick" }> = [];
    if (errors[0]) {
      const tema = errors[0].tema as string;
      const subtema = errors[0].subtema as string | null | undefined;
      const params = new URLSearchParams({
        sc_source: "weak-topics",
        sc_taskType: "practice",
        sc_objective: "practice",
        sc_topic: tema,
        sc_specialty: tema,
        sc_difficulty: "misto",
        sc_count: "10",
      });
      if (subtema) params.set("sc_subtopic", subtema);
      nextSteps.push({
        id: "weak-topic",
        title: `Treinar ${tema} — simulado de 10 questões`,
        cta: "Treinar agora",
        route: `/dashboard/simulados?${params.toString()}`,
        priority: "primary",
      });
    }
    if (fsrsDueCount > 0) {
      nextSteps.push({
        id: "fsrs",
        title: `Limpar ${Math.min(fsrsDueCount, 10)} revisões vencidas`,
        cta: "Revisar",
        route: "/dashboard/sessao-estudo?focus=reviews&origin=cockpit&auto=1",
        priority: "secondary",
      });
    }
    if (mnemUseful[0]) {
      nextSteps.push({
        id: "mnem-review",
        title: `Reforçar mnemônico: ${mnemUseful[0].tema}`,
        cta: "Abrir",
        route: `/dashboard/mnemonic-studio-v2?result=${mnemUseful[0].result_id}`,
        priority: "quick",
      });
    } else if (errors[0]) {
      const e0: any = errors[0];
      const temaCompleto = e0.subtema ? `${e0.tema} — ${e0.subtema}` : e0.tema;
      nextSteps.push({
        id: "create-mnem",
        title: `Criar mnemônico para ${temaCompleto}`,
        cta: "Criar agora",
        // auto=1 dispara geração automática ao abrir o Studio
        route: `/dashboard/mnemonic-studio-v2?tema=${encodeURIComponent(temaCompleto)}&auto=1`,
        priority: "quick",
      });
    }

    // Perfil cognitivo
    const cognitiveProfile = {
      bestMnemonicTema: mnemUseful[0]?.tema ?? null,
      worstMnemonicTema: mnemBad[0]?.tema ?? null,
      strongestModality: Object.entries(radar).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? null,
      weakestModality: Object.entries(radar)
        .filter(([, v]) => Number(v) > 0)
        .sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] ?? null,
      avgMnemonicScore: mnemStats?.media_score_final ? Math.round(Number(mnemStats.media_score_final)) : 0,
      mnemonicsCreated: mnemStats?.total_resultados ?? 0,
    };

    return new Response(
      JSON.stringify({
        topWeaknesses,
        mnemUseful,
        mnemBad,
        fsrsDueCount,
        fsrsTotalCards: fsrsAll.length,
        avgStability,
        totalLapses,
        revisoesPending: revisoesPend.length,
        accuracy7d,
        questions7d: total7d,
        correct7d,
        radar,
        visualWeaknesses,
        alerts,
        nextSteps,
        cognitiveProfile,
        feedbackCount7d: mnemFeedback7d.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cockpit-data] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
