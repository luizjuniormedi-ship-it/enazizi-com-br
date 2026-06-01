// Sprint Intel-1 — FASE 2
// compute-intelligence-index
//
// Escopo (v0.3 FINAL):
//  - Admin-only (valida JWT + has_role 'admin').
//  - Modos: dry_run=true (preview, NÃO grava) | dry_run=false (UPSERT real).
//  - Tabela única gravada: public.enamed_intelligence_index
//  - Sem integração com Planner / Missão do Dia / Tutor / FSRS / Banco de Erros / TRI / Theta.
//  - Sem cron, sem triggers, sem efeitos colaterais.
//
// Fontes (read-only):
//  - public.questions_bank        → question_count, historical_frequency
//  - public.practice_attempts     → student_error_rate, sample_size
//  - public.fsrs_cards            → fsrs_risk (avg 1 - retrievability)
//  - public.curriculum_specialties→ validação FK lógica de specialty_id
//  - public.curriculum_topics     → validação lógica de subspecialty_id (sem FK formal — documentado)
//
// Fórmula priority_score (0-100):
//   priority_score = 50 * historical_frequency_norm
//                  + 30 * student_error_rate
//                  + 20 * fsrs_risk
//   (Componentes ausentes contam como 0 → linhas experimentais ainda recebem score, nunca null/zerado por omissão.)
//
// Confidence level (baseado em sample_size = nº de tentativas observadas no agrupamento):
//   sample_size >= 100 → high
//   sample_size >= 30  → medium
//   sample_size >= 10  → low
//   sample_size <  10  → experimental
//
// Resposta SEMPRE inclui tables_written para auditoria.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COMPUTATION_VERSION = "v1.0";
const COMPUTED_BY = "compute-intelligence-index";
const TABLES_WRITTEN_DRY = [] as const;
const TABLES_WRITTEN_REAL = ["enamed_intelligence_index"] as const;

interface AggRow {
  specialty_id: string;
  subspecialty_id: string | null;
  question_count: number;
  attempts: number;
  errors: number;
  fsrs_risk_sum: number;
  fsrs_risk_n: number;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(stage: string, data: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      level: "INFO",
      ts: new Date().toISOString(),
      fn: COMPUTED_BY,
      stage,
      ...data,
    }),
  );
}

function confidenceFor(sampleSize: number): string {
  if (sampleSize >= 100) return "high";
  if (sampleSize >= 30) return "medium";
  if (sampleSize >= 10) return "low";
  return "experimental";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  log("BOOT", { method: req.method });

  try {
    if (req.method !== "POST") {
      return jsonResponse({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
    }

    // ---------- AUTH (admin only) ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401);
    }
    const token = authHeader.slice("Bearer ".length).trim();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      log("AUTH_FAIL", { reason: userErr?.message });
      return jsonResponse({ success: false, error: "UNAUTHORIZED" }, 401);
    }
    const userId = userData.user.id;

    // service-role client para ler tudo e gravar (RLS write_service_only)
    const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin, error: roleErr } = await svc.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      log("AUTH_FAIL", { reason: "not_admin", userId });
      return jsonResponse({ success: false, error: "FORBIDDEN" }, 403);
    }
    log("AUTH_OK", { userId });

    // ---------- INPUT ----------
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run !== false; // default TRUE (safety)
    const examKey: string = typeof body.exam_key === "string" && body.exam_key.trim()
      ? body.exam_key.trim()
      : "enamed";

    log("INPUT", { dryRun, examKey });

    // ---------- READ: questions_bank ----------
    // Paginação para passar do default de 1000 linhas.
    const PAGE = 1000;
    const agg = new Map<string, AggRow>();
    const keyOf = (s: string, t: string | null) => `${s}::${t ?? "_"}`;

    let from = 0;
    let totalQuestions = 0;
    while (true) {
      const { data, error } = await svc
        .from("questions_bank")
        .select("id, specialty_id, topic_id")
        .not("specialty_id", "is", null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`questions_bank read: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const q of data) {
        const k = keyOf(q.specialty_id as string, (q.topic_id as string | null) ?? null);
        const row = agg.get(k) ?? {
          specialty_id: q.specialty_id as string,
          subspecialty_id: (q.topic_id as string | null) ?? null,
          question_count: 0,
          attempts: 0,
          errors: 0,
          fsrs_risk_sum: 0,
          fsrs_risk_n: 0,
        };
        row.question_count += 1;
        agg.set(k, row);
        totalQuestions += 1;
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
    log("AGG_QUESTIONS", { groups: agg.size, totalQuestions });

    // ---------- READ: practice_attempts (joined logically via question_id) ----------
    // Para evitar carregar tudo, agregamos via RPC inline: select question_id, correct
    // depois mapeamos para specialty/topic usando um mini índice de questions.
    const qIndex = new Map<string, { s: string; t: string | null }>();
    {
      let f2 = 0;
      while (true) {
        const { data, error } = await svc
          .from("questions_bank")
          .select("id, specialty_id, topic_id")
          .not("specialty_id", "is", null)
          .range(f2, f2 + PAGE - 1);
        if (error) throw new Error(`qIndex read: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const q of data) {
          qIndex.set(q.id as string, {
            s: q.specialty_id as string,
            t: (q.topic_id as string | null) ?? null,
          });
        }
        if (data.length < PAGE) break;
        f2 += PAGE;
      }
    }

    let attemptsScanned = 0;
    {
      let f3 = 0;
      while (true) {
        const { data, error } = await svc
          .from("practice_attempts")
          .select("question_id, correct")
          .range(f3, f3 + PAGE - 1);
        if (error) throw new Error(`practice_attempts read: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const a of data) {
          const meta = qIndex.get(a.question_id as string);
          if (!meta) continue;
          const k = keyOf(meta.s, meta.t);
          const row = agg.get(k);
          if (!row) continue;
          row.attempts += 1;
          if (a.correct === false) row.errors += 1;
          attemptsScanned += 1;
        }
        if (data.length < PAGE) break;
        f3 += PAGE;
      }
    }
    log("AGG_ATTEMPTS", { attemptsScanned });

    // ---------- READ: fsrs_cards (card_type='question', card_ref_id = question id text) ----------
    let fsrsScanned = 0;
    {
      let f4 = 0;
      while (true) {
        const { data, error } = await svc
          .from("fsrs_cards")
          .select("card_ref_id, retrievability, card_type")
          .not("retrievability", "is", null)
          .range(f4, f4 + PAGE - 1);
        if (error) throw new Error(`fsrs_cards read: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const c of data) {
          const meta = qIndex.get(c.card_ref_id as string);
          if (!meta) continue;
          const k = keyOf(meta.s, meta.t);
          const row = agg.get(k);
          if (!row) continue;
          const r = Number(c.retrievability);
          if (!Number.isFinite(r)) continue;
          row.fsrs_risk_sum += Math.max(0, Math.min(1, 1 - r));
          row.fsrs_risk_n += 1;
          fsrsScanned += 1;
        }
        if (data.length < PAGE) break;
        f4 += PAGE;
      }
    }
    log("AGG_FSRS", { fsrsScanned });

    // ---------- VALIDATION ----------
    const { data: specs, error: specErr } = await svc
      .from("curriculum_specialties")
      .select("id");
    if (specErr) throw new Error(`curriculum_specialties: ${specErr.message}`);
    const validSpecs = new Set((specs ?? []).map((s) => s.id as string));

    const { data: tops, error: topErr } = await svc
      .from("curriculum_topics")
      .select("id");
    if (topErr) throw new Error(`curriculum_topics: ${topErr.message}`);
    const validTops = new Set((tops ?? []).map((t) => t.id as string));

    // ---------- BUILD ROWS ----------
    const previewRows: Array<Record<string, unknown>> = [];
    let invalidSpec = 0;
    let invalidSub = 0;
    let withScore = 0;
    let experimental = 0;
    let nullScore = 0;

    const seenKeys = new Set<string>();
    let duplicateKeyCount = 0;

    for (const row of agg.values()) {
      if (!validSpecs.has(row.specialty_id)) {
        invalidSpec += 1;
        continue; // não grava linha inválida
      }
      if (row.subspecialty_id !== null && !validTops.has(row.subspecialty_id)) {
        invalidSub += 1;
        // mantém grava como NULL para não perder o agregado da specialty
        row.subspecialty_id = null;
      }

      const dedupKey = `${row.specialty_id}::${row.subspecialty_id ?? "_"}::${examKey}`;
      if (seenKeys.has(dedupKey)) {
        duplicateKeyCount += 1;
        continue;
      }
      seenKeys.add(dedupKey);

      const historical = totalQuestions > 0 ? row.question_count / totalQuestions : 0;
      const studentErrorRate = row.attempts > 0 ? row.errors / row.attempts : null;
      const fsrsRisk = row.fsrs_risk_n > 0 ? row.fsrs_risk_sum / row.fsrs_risk_n : null;

      // Normalização leve da frequência: cap em 0.5 para evitar dominância de uma specialty enorme
      const histNorm = Math.min(1, historical * 2);
      const priority =
        50 * histNorm + 30 * (studentErrorRate ?? 0) + 20 * (fsrsRisk ?? 0);

      const sampleSize = row.attempts;
      const conf = confidenceFor(sampleSize);
      if (conf === "experimental") experimental += 1;
      if (priority > 0) withScore += 1;
      else nullScore += 1;

      previewRows.push({
        specialty_id: row.specialty_id,
        subspecialty_id: row.subspecialty_id,
        exam_key: examKey,
        question_count: row.question_count,
        historical_frequency: Number(historical.toFixed(4)),
        student_error_rate: studentErrorRate === null ? null : Number(studentErrorRate.toFixed(4)),
        fsrs_risk: fsrsRisk === null ? null : Number(fsrsRisk.toFixed(4)),
        priority_score: Number(priority.toFixed(2)),
        confidence_level: conf,
        sample_size: sampleSize,
        computed_by: COMPUTED_BY,
        computation_version: COMPUTATION_VERSION,
      });
    }

    log("BUILD_DONE", {
      preview_rows: previewRows.length,
      invalid_specialty: invalidSpec,
      invalid_subspecialty: invalidSub,
      duplicate_key_count: duplicateKeyCount,
    });

    // ---------- WRITE (only if !dryRun) ----------
    let inserted = 0;
    let updated = 0;
    let tablesWritten: readonly string[] = TABLES_WRITTEN_DRY;

    if (!dryRun) {
      // Conta existentes para classificar inserted vs updated
      const { data: existing, error: exErr } = await svc
        .from("enamed_intelligence_index")
        .select("specialty_id, subspecialty_id, exam_key")
        .eq("exam_key", examKey);
      if (exErr) throw new Error(`existing read: ${exErr.message}`);
      const existingKeys = new Set(
        (existing ?? []).map(
          (r) =>
            `${r.specialty_id}::${(r.subspecialty_id as string | null) ?? "_"}::${r.exam_key}`,
        ),
      );

      // UPSERT em lotes de 500
      const BATCH = 500;
      for (let i = 0; i < previewRows.length; i += BATCH) {
        const slice = previewRows.slice(i, i + BATCH).map((r) => ({
          ...r,
          computed_at: new Date().toISOString(),
        }));
        const { error: upErr } = await svc
          .from("enamed_intelligence_index")
          .upsert(slice, {
            onConflict: "specialty_id,subspecialty_id,exam_key",
            ignoreDuplicates: false,
          });
        if (upErr) throw new Error(`upsert: ${upErr.message}`);
        for (const r of slice) {
          const k = `${r.specialty_id}::${r.subspecialty_id ?? "_"}::${r.exam_key}`;
          if (existingKeys.has(k)) updated += 1;
          else inserted += 1;
        }
      }
      tablesWritten = TABLES_WRITTEN_REAL;
    }

    const durationMs = Date.now() - startedAt;
    const report = {
      success: true,
      mode: dryRun ? "dry_run" : "real_run",
      exam_key: examKey,
      processed: agg.size,
      preview_rows: previewRows.length,
      inserted,
      updated,
      with_score: withScore,
      experimental_count: experimental,
      null_score_count: nullScore,
      invalid_specialty_count: invalidSpec,
      invalid_subspecialty_count: invalidSub,
      duplicate_key_count: duplicateKeyCount,
      duration_ms: durationMs,
      tables_written: tablesWritten,
      computation_version: COMPUTATION_VERSION,
      // Amostra apenas em dry_run, para auditoria leve
      sample: dryRun ? previewRows.slice(0, 5) : undefined,
    };
    log("DONE", { mode: report.mode, processed: report.processed, durationMs });

    return jsonResponse(report, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("FAIL", { error: msg });
    return jsonResponse(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: msg,
        tables_written: [],
      },
      500,
    );
  }
});
