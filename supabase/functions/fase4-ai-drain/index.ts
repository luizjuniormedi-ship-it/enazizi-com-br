// Fase 4 — Drenagem da fila de classificação via IA + persistência atômica
// Auth admin obrigatório. Service role usado apenas dentro desta função.
// Padrão alinhado com classify-question-hierarchy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPLY_THRESHOLD = 0.90;
const REVIEW_THRESHOLD = 0.75;
const LOW_THRESHOLD = 0.60;

interface AIResult {
  id: string;
  specialty: string | null;
  confidence: number;
}

async function callAI(
  items: Array<{ id: string; topic: string | null; subtopic: string | null; statement: string | null }>,
  specNames: string[],
  apiKey: string,
): Promise<AIResult[]> {
  const list = items.map((q, i) =>
    `[${i + 1}] id=${q.id}\ntopic="${q.topic ?? ""}" subtopic="${q.subtopic ?? ""}"\nenunciado: ${(q.statement || "").replace(/\s+/g, " ").slice(0, 400)}`
  ).join("\n---\n");

  const prompt = `ESPECIALIDADES VÁLIDAS (use EXATAMENTE uma destas, com acentos):
- ${specNames.join("\n- ")}

Para cada item retorne id, specialty (string EXATA ou null), confidence (0-1).
Use confidence >= 0.90 quando óbvio. 0.75-0.89 quando há dúvida razoável. <0.70 quando ambíguo.
Use specialty=null APENAS para questões claramente não-médicas.

ITENS:
${list}

Responda JSON: {"results":[{"id":"...","specialty":"Cardiologia","confidence":0.95}]}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é especialista em currículo médico brasileiro (residência). Classifique decisivamente." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8000,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t.slice(0, 300)}`);
  }
  const j = await r.json();
  try {
    const parsed = JSON.parse(j.choices[0].message.content);
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth admin obrigatório
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(parseInt(body.batch_size ?? 500, 10), 10), 1000);
    const chunkSize = Math.min(Math.max(parseInt(body.chunk_size ?? 25, 10), 5), 50);
    const dryRun: boolean = body.dry_run === true;
    const runId = body.run_id || crypto.randomUUID();

    // Currículo
    const { data: specsRaw } = await admin
      .from("curriculum_specialties").select("id, nome").eq("ativo", true);
    const specs = specsRaw ?? [];
    const specByName = new Map<string, string>(
      specs.map((s: any) => [s.nome.toLowerCase().trim(), s.id])
    );
    const specNames = specs.map((s: any) => s.nome);

    // Fila: questões marcadas como skipped (sem out_of_scope) sem specialty
    const { data: rows, error: fetchErr } = await admin
      .from("questions_bank")
      .select("id, topic, subtopic, statement")
      .is("specialty_id", null)
      .eq("classification_method", "skipped")
      .neq("classification_reason", "out_of_scope")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (fetchErr) throw new Error(`fetch: ${fetchErr.message}`);

    const fetched = rows?.length ?? 0;
    const stats = {
      run_id: runId,
      fetched,
      returned: 0,
      applied_auto: 0,
      applied_review: 0,
      applied_low: 0,
      out_of_scope: 0,
      failed: 0,
      chunks_total: 0,
      chunks_empty: 0,
      chunks_retried: 0,
      confidence_sum: 0,
    };

    if (fetched === 0) {
      return new Response(JSON.stringify({ message: "queue empty", stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const truncated = (rows ?? []).map((r: any) => ({
      id: r.id,
      topic: r.topic,
      subtopic: r.subtopic,
      statement: (r.statement || "").slice(0, 500),
    }));

    for (let i = 0; i < truncated.length; i += chunkSize) {
      const chunk = truncated.slice(i, i + chunkSize);
      stats.chunks_total++;
      let results: AIResult[] = [];
      try { results = await callAI(chunk, specNames, apiKey); } catch (e) {
        console.error(`[fase4] chunk ${stats.chunks_total} err:`, (e as Error).message);
      }

      // Retry com sub-chunk menor se vier vazio
      if (results.length === 0) {
        stats.chunks_empty++;
        stats.chunks_retried++;
        const half = Math.max(5, Math.floor(chunk.length / 2));
        for (let j = 0; j < chunk.length; j += half) {
          try {
            const sub = await callAI(chunk.slice(j, j + half), specNames, apiKey);
            results.push(...sub);
          } catch (e) {
            console.error(`[fase4] retry err:`, (e as Error).message);
          }
        }
      }

      for (const res of results) {
        if (!res?.id) continue;
        stats.returned++;
        const conf = Number(res.confidence) || 0;
        stats.confidence_sum += conf;
        const specName = res.specialty ? String(res.specialty).toLowerCase().trim() : null;
        const specId = specName ? specByName.get(specName) : null;

        let update: Record<string, unknown>;
        if (!specId || conf < LOW_THRESHOLD) {
          update = {
            classification_method: "manual",
            classification_reason: "out_of_scope",
            classification_confidence: 1.0,
            classified_at: new Date().toISOString(),
          };
          stats.out_of_scope++;
        } else {
          let reason: string;
          if (conf >= APPLY_THRESHOLD) { reason = "ai_fallback"; stats.applied_auto++; }
          else if (conf >= REVIEW_THRESHOLD) { reason = "manual_review"; stats.applied_review++; }
          else { reason = "low_confidence"; stats.applied_low++; }
          update = {
            specialty_id: specId,
            classification_method: "ai",
            classification_reason: reason,
            classification_confidence: conf,
            classified_at: new Date().toISOString(),
          };
        }

        if (!dryRun) {
          const { error: updErr } = await admin
            .from("questions_bank").update(update).eq("id", res.id);
          if (updErr) {
            stats.failed++;
            console.error(`[fase4] update fail ${res.id}: ${updErr.message}`);
          }
        }
      }
    }

    const avgConf = stats.returned ? +(stats.confidence_sum / stats.returned).toFixed(3) : 0;
    const summary = {
      ...stats,
      avg_confidence: avgConf,
      dry_run: dryRun,
      coverage_returned_pct: fetched ? +(stats.returned / fetched * 100).toFixed(1) : 0,
    };
    console.log("[fase4] done", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fase4] fatal", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
