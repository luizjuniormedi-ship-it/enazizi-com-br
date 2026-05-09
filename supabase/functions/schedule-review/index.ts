// ⚠️ DEPRECATED (Fase 0 audit — observational freeze)
// Esta função está órfã: nenhum frontend ou outra edge function a chama.
// O motor oficial de revisão é o FSRS (ver useFsrs + tabela fsrs_cards).
// Decisão sobre deletar ou consolidar com FSRS será tomada pós-baseline (Fase 1+).
// NÃO conectar essa função sem antes consolidar com o FSRS — criaria pipeline duplicado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Spaced repetition intervals
const SR_INTERVALS: Record<string, number> = {
  D1: 1,
  D3: 3,
  D7: 7,
  D15: 15,
  D30: 30,
  D60: 60,
  D90: 90,
};

function getNextInterval(currentType: string, wasSuccessful: boolean): { type: string; days: number } {
  const keys = Object.keys(SR_INTERVALS);
  const idx = keys.indexOf(currentType);

  if (wasSuccessful) {
    // Advance to next interval
    const nextIdx = Math.min(idx + 1, keys.length - 1);
    return { type: keys[nextIdx], days: SR_INTERVALS[keys[nextIdx]] };
  } else {
    // Go back one step (but not below D1)
    const prevIdx = Math.max(idx - 1, 0);
    return { type: keys[prevIdx], days: SR_INTERVALS[keys[prevIdx]] };
  }
}

function calculateRisk(accuracy: number, daysSinceStudy: number): string {
  if (accuracy < 50 || daysSinceStudy > 14) return "alto";
  if (accuracy < 70 || daysSinceStudy > 7) return "medio";
  return "baixo";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const body = await req.json();
    const { tema_id, was_successful, accuracy } = body as {
      tema_id: string;
      was_successful: boolean;
      accuracy?: number;
    };

    if (!tema_id || was_successful == null) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tema_id, was_successful" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const userId = user.id;

    // Get the most recent review for this tema
    const { data: lastReview } = await adminClient
      .from("revisoes")
      .select("id, tipo_revisao, data_revisao")
      .eq("user_id", userId)
      .eq("tema_id", tema_id)
      .order("data_revisao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentType = lastReview?.tipo_revisao || "D1";
    const next = getNextInterval(currentType, was_successful);

    // Get tema info for risk calculation
    const { data: tema } = await adminClient
      .from("temas_estudados")
      .select("data_estudo")
      .eq("id", tema_id)
      .maybeSingle();

    const daysSinceStudy = tema?.data_estudo
      ? Math.floor(
          (Date.now() - new Date(tema.data_estudo).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    const risk = calculateRisk(accuracy ?? 50, daysSinceStudy);

    // Calculate priority (higher = more urgent)
    const priority = risk === "alto" ? 90 : risk === "medio" ? 60 : 30;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + next.days);

    // Mark current review as completed if exists
    if (lastReview) {
      await adminClient
        .from("revisoes")
        .update({
          status: "concluida",
          concluida_em: new Date().toISOString(),
        })
        .eq("id", lastReview.id);
    }

    // Schedule next review
    const { data: newReview, error: insertErr } = await adminClient
      .from("revisoes")
      .insert({
        user_id: userId,
        tema_id,
        data_revisao: nextDate.toISOString().split("T")[0],
        tipo_revisao: next.type,
        status: "pendente",
        risco_esquecimento: risk,
        prioridade: priority,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Also update user_topic_profiles
    await adminClient
      .from("user_topic_profiles")
      .update({
        next_review_at: nextDate.toISOString(),
        review_interval_days: next.days,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("topic", tema_id); // Will silently fail if no matching profile — that's fine

    return new Response(
      JSON.stringify({
        success: true,
        previous_type: currentType,
        next_review: {
          id: newReview.id,
          type: next.type,
          date: nextDate.toISOString().split("T")[0],
          interval_days: next.days,
          risk,
          priority,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
