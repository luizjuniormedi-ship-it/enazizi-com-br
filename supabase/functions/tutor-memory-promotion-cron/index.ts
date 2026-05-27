// ENAZIZI — tutor-memory-promotion-cron (v22.1 + Hardening v25.1 LGPD-SAFE)
// Roda o ciclo de promoção e decay da memória do tutor.
//
// Hardening v25.1 (Opção C):
//   - Antes de promover, sanitiza PII em rows promovíveis (draft/validated).
//   - Defensivamente sanitiza linhas já em scope='global' que ainda contenham PII.
//   - Linhas com PII "hard" (CPF/email/telefone/CNPJ) são MOVIDAS para quarentena.
//   - Toda mudança é logada com [TUTOR_MEMORY_PII_SANITIZED] / [TUTOR_MEMORY_PROMOTION_*].
//
// Sem auth — uso interno. Dispare manualmente (curl) ou agende via cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sanitizePII, hasHardPII } from "../_shared/pii-sanitizer.ts";

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

async function runSanitizationPass(admin: any) {
  // Alvo: tudo que pode virar global (draft/validated) + qualquer scope='global' legado.
  const { data: rows, error } = await admin
    .from("tutor_knowledge_memory")
    .select("id, scope, promotion_status, question_original, answer_summary")
    .or("promotion_status.in.(draft,validated),scope.eq.global")
    .limit(500);

  if (error) {
    console.warn("[TUTOR_MEMORY_SANITIZE_QUERY_ERROR]", error.message);
    return { scanned: 0, sanitized: 0, quarantined: 0 };
  }

  let sanitized = 0;
  let quarantined = 0;

  for (const r of rows || []) {
    const q = r.question_original || "";
    const a = r.answer_summary || "";

    const sq = sanitizePII(q);
    const sa = sanitizePII(a);

    const hardQ = hasHardPII(q);
    const hardA = hasHardPII(a);

    if (hardQ || hardA) {
      // PII pesada: quarentena imediata, fora do pool global.
      await admin
        .from("tutor_knowledge_memory")
        .update({
          promotion_status: "quarantined",
          question_original: sq.text.slice(0, 2000),
          answer_summary: sa.text.slice(0, 8000),
        })
        .eq("id", r.id);
      quarantined++;
      console.log("[TUTOR_MEMORY_PROMOTION_REJECTED]", {
        id: r.id,
        reason: "hard_pii",
        hits: [...sq.hits, ...sa.hits],
      });
      continue;
    }

    if (sq.changed || sa.changed) {
      await admin
        .from("tutor_knowledge_memory")
        .update({
          question_original: sq.text.slice(0, 2000),
          answer_summary: sa.text.slice(0, 8000),
        })
        .eq("id", r.id);
      sanitized++;
      console.log("[TUTOR_MEMORY_PII_SANITIZED]", {
        id: r.id,
        scope: r.scope,
        status: r.promotion_status,
        hits: [...sq.hits, ...sa.hits],
      });
    }
  }

  return { scanned: rows?.length || 0, sanitized, quarantined };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  console.log("[PROMOTION_CRON_START]", new Date().toISOString());

  // 1) Sanitização ANTES da promoção — gate LGPD oficial.
  console.log("[TUTOR_MEMORY_PROMOTION_START]");
  const sanitizeStats = await runSanitizationPass(admin);
  console.log("[TUTOR_MEMORY_PROMOTION_SANITIZE_DONE]", sanitizeStats);

  // 2) Ciclo oficial de promoção/decay.
  const { data, error } = await admin.rpc("tutor_memory_run_promotion_cycle");
  if (error) {
    console.error("[PROMOTION_CRON_ERROR]", error.message);
    return json({ error: error.message, sanitize: sanitizeStats }, 500);
  }
  console.log("[TUTOR_MEMORY_PROMOTION_APPROVED]", data);

  // Snapshot agregado
  const { count: quarantinedTotal } = await admin
    .from("tutor_knowledge_memory")
    .select("id", { count: "exact", head: true })
    .eq("promotion_status", "quarantined");

  const { count: total } = await admin
    .from("tutor_knowledge_memory")
    .select("id", { count: "exact", head: true });

  const poisoningRate = total && total > 0 ? Number(quarantinedTotal || 0) / total : 0;

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
    sanitize: sanitizeStats,
  });

  return json({
    ok: true,
    cycle: data,
    quarantinedTotal,
    poisoningRate,
    sanitize: sanitizeStats,
  });
});
