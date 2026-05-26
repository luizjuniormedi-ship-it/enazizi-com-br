// ENAZIZI — tutor-memory-promotion-cron (v22.1)
// Roda o ciclo de promoção e decay da memória do tutor.
// Sem auth — uso interno. Dispare manualmente (curl) ou agende via cron.
//
// Resultado: { decayed, validated, promoted, canonical, quarantined_total, run_at }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  console.log("[PROMOTION_CRON_START]", new Date().toISOString());

  const { data, error } = await admin.rpc("tutor_memory_run_promotion_cycle");
  if (error) {
    console.error("[PROMOTION_CRON_ERROR]", error.message);
    return json({ error: error.message }, 500);
  }

  // Snapshot agregado: quanto está quarentinado, poisoning rate
  const { count: quarantinedTotal } = await admin
    .from("tutor_knowledge_memory")
    .select("id", { count: "exact", head: true })
    .eq("promotion_status", "quarantined");

  const { count: total } = await admin
    .from("tutor_knowledge_memory")
    .select("id", { count: "exact", head: true });

  const poisoningRate = total && total > 0 ? Number(quarantinedTotal || 0) / total : 0;

  // Atualiza métricas do dia
  try {
    const day = new Date().toISOString().slice(0, 10);
    await admin
      .from("memory_governance_metrics")
      .upsert({
        day,
        quarantined_total: quarantinedTotal || 0,
        poisoning_rate: Number(poisoningRate.toFixed(4)),
      }, { onConflict: "day" });
  } catch (e: any) {
    console.warn("[PROMOTION_CRON_METRIC_ERROR]", e?.message);
  }

  console.log("[PROMOTION_CRON_DONE]", {
    ...(data as any),
    quarantinedTotal,
    poisoningRate,
  });

  return json({
    ok: true,
    cycle: data,
    quarantinedTotal,
    poisoningRate,
  });
});
