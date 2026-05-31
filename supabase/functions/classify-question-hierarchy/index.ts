// Sprint 2 — Backfill incremental de classificação hierárquica
// Pipeline: exact_text -> heuristic -> ai (somente quando habilitado)
// Aplicação automática só com confiança alta. Restante vai para fila de revisão.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Thresholds (regras de segurança do Sprint 2)
const APPLY_THRESHOLD = 0.9; // >= aplica direto
const REVIEW_THRESHOLD = 0.7; // entre 0.7 e 0.9 -> aplica + manda revisão; abaixo -> só fila

type TableSource = "questions_bank" | "real_exam_questions";

interface Specialty {
  id: string;
  nome: string;
  norm: string;
  tokens: Set<string>;
}
interface Topic {
  id: string;
  nome: string;
  specialty_id: string;
  norm: string;
}
interface Subtopic {
  id: string;
  nome: string;
  topic_id: string;
  norm: string;
}

interface ClassificationResult {
  specialty_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  microtopic_id: string | null;
  confidence: number;
  method: "alias_exact" | "exact_text" | "heuristic" | "ai";
  reason: string;
  alias_key?: string;
  alias_target?: string;
  normalized_topic?: string;
}

interface AliasRow {
  normalized_alias: string;
  specialty_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
}

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalizador específico para aliases curriculares: além do normalize() base,
// remove sufixos redundantes ("medica", "geral", "clinica" isolados).
function normalizeCurriculumLabel(s: string | null | undefined): string {
  const base = normalize(s);
  if (!base) return "";
  // Não remove se a string for muito curta (evita perder "geral" sozinho com sentido).
  if (base.split(" ").length <= 1) return base;
  return base
    .replace(/\b(medica|geral|clinica)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length >= 4),
  );
}

// Sinônimos comuns: maps texto livre -> nome canônico de specialty
const SPECIALTY_SYNONYMS: Record<string, string> = {
  "clinica medica": "Clínica Médica",
  "ginecologia e obstetricia": "Ginecologia e Obstetrícia",
  ginecologia: "Ginecologia e Obstetrícia",
  obstetricia: "Ginecologia e Obstetrícia",
  "cirurgia geral": "Cirurgia",
  emergencia: "Medicina de Emergência",
  "medicina de emergencia": "Medicina de Emergência",
  "terapia intensiva": "Medicina Intensiva",
  cti: "Medicina Intensiva",
  uti: "Medicina Intensiva",
  "medicina preventiva": "Medicina Preventiva e Social",
  preventiva: "Medicina Preventiva e Social",
  "saude publica": "Medicina Preventiva e Social",
};

function classifyDeterministic(
  rowTopic: string | null,
  rowSubtopic: string | null,
  specialties: Specialty[],
  topics: Topic[],
  subtopics: Subtopic[],
  aliases: Map<string, AliasRow>,
): ClassificationResult {
  const normTopic = normalize(rowTopic);
  const normSub = normalize(rowSubtopic);

  if (!normTopic && !normSub) {
    return {
      specialty_id: null,
      topic_id: null,
      subtopic_id: null,
      microtopic_id: null,
      confidence: 0,
      method: "heuristic",
      reason: "sem topic e sem subtopic",
    };
  }

  // 0) ALIAS-FIRST: tenta casar via curriculum_aliases (subtopic > topic > specialty)
  const aliasKeys: string[] = [];
  const pushKey = (k: string) => {
    if (k && !aliasKeys.includes(k)) aliasKeys.push(k);
  };
  if (normSub) {
    pushKey(normSub);
    pushKey(normalizeCurriculumLabel(rowSubtopic));
  }
  if (normTopic && normSub) {
    pushKey(`${normTopic} ${normSub}`);
    pushKey(normalizeCurriculumLabel(`${rowTopic} ${rowSubtopic}`));
  }
  if (normTopic) {
    pushKey(normTopic);
    pushKey(normalizeCurriculumLabel(rowTopic));
  }

  for (const key of aliasKeys) {
    const hit = aliases.get(key);
    if (!hit) continue;
    let specId: string | null = hit.specialty_id;
    let topicId: string | null = hit.topic_id;
    const subId: string | null = hit.subtopic_id;
    if (subId && !topicId) {
      const sub = subtopics.find((s) => s.id === subId);
      if (sub) topicId = sub.topic_id;
    }
    if (topicId && !specId) {
      const top = topics.find((t) => t.id === topicId);
      if (top) specId = top.specialty_id;
    }
    if (!specId) continue;
    return {
      specialty_id: specId,
      topic_id: topicId,
      subtopic_id: subId,
      microtopic_id: null,
      confidence: 0.97,
      method: "alias_exact",
      reason: `alias="${key}" → resolvido via curriculum_aliases`,
      alias_key: key,
      alias_target: subId ? `subtopic:${subId}` : topicId ? `topic:${topicId}` : `specialty:${specId}`,
      normalized_topic: normTopic || normSub,
    };
  }

  // 1) match exato em specialty (canonical OU sinônimo)
  let matchedSpecialty: Specialty | undefined;
  let exactSpecialty = false;

  if (normTopic) {
    const canonical = SPECIALTY_SYNONYMS[normTopic];
    matchedSpecialty = specialties.find(
      (s) =>
        s.norm === normTopic ||
        (canonical && s.nome === canonical),
    );
    if (matchedSpecialty) exactSpecialty = true;
  }

  // 2) heurística: subset de tokens
  let heuristicScore = 0;
  if (!matchedSpecialty && normTopic) {
    const topicTokens = tokens(normTopic);
    let best: { spec: Specialty; score: number } | null = null;
    for (const sp of specialties) {
      const inter = [...topicTokens].filter((t) => sp.tokens.has(t)).length;
      if (inter === 0) continue;
      const score = inter / Math.max(topicTokens.size, sp.tokens.size, 1);
      if (!best || score > best.score) best = { spec: sp, score };
    }
    if (best && best.score >= 0.5) {
      matchedSpecialty = best.spec;
      heuristicScore = best.score;
    }
  }

  if (!matchedSpecialty) {
    return {
      specialty_id: null,
      topic_id: null,
      subtopic_id: null,
      microtopic_id: null,
      confidence: 0,
      method: "heuristic",
      reason: `nenhuma specialty bateu com topic="${rowTopic}"`,
    };
  }

  // 3) tentar topic dentro da specialty (subtopic textual da questão -> nome de topic curricular)
  let matchedTopic: Topic | undefined;
  let topicConfidence = 0;
  if (normSub) {
    const candTopics = topics.filter(
      (t) => t.specialty_id === matchedSpecialty!.id,
    );
    matchedTopic = candTopics.find((t) => t.norm === normSub);
    if (matchedTopic) {
      topicConfidence = 1;
    } else {
      // heurística: subset de tokens
      const subTokens = tokens(normSub);
      let best: { topic: Topic; score: number } | null = null;
      for (const t of candTopics) {
        const tTokens = tokens(t.nome);
        const inter = [...subTokens].filter((tk) => tTokens.has(tk)).length;
        if (inter === 0) continue;
        const score = inter / Math.max(subTokens.size, tTokens.size, 1);
        if (!best || score > best.score) best = { topic: t, score };
      }
      if (best && best.score >= 0.6) {
        matchedTopic = best.topic;
        topicConfidence = best.score * 0.85; // penaliza
      }
    }
  }

  // 4) tentar subtopic dentro do topic
  let matchedSubtopic: Subtopic | undefined;
  if (matchedTopic && normSub) {
    matchedSubtopic = subtopics.find(
      (s) => s.topic_id === matchedTopic!.id && s.norm === normSub,
    );
  }

  // Confidence: especialidade exata = 0.95; heurística = score * 0.85
  let confidence: number;
  let method: "exact_text" | "heuristic";
  let reason: string;

  if (exactSpecialty) {
    confidence = 0.95;
    method = "exact_text";
    reason = `topic="${rowTopic}" → specialty="${matchedSpecialty.nome}" (exato)`;
  } else {
    confidence = Math.min(0.85, heuristicScore * 0.85);
    method = "heuristic";
    reason = `topic="${rowTopic}" → specialty="${matchedSpecialty.nome}" (heurística, score=${heuristicScore.toFixed(2)})`;
  }

  // boost se também bateu topic
  if (matchedTopic && topicConfidence >= 0.85) {
    confidence = Math.min(0.98, confidence + 0.03);
    reason += `; topic="${matchedTopic.nome}"`;
  } else if (matchedTopic) {
    reason += `; topic="${matchedTopic.nome}" (parcial)`;
  }

  return {
    specialty_id: matchedSpecialty.id,
    topic_id: matchedTopic?.id ?? null,
    subtopic_id: matchedSubtopic?.id ?? null,
    microtopic_id: null,
    confidence,
    method,
    reason,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validação do chamador: precisa ser admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tableSource: TableSource = body.table_source === "real_exam_questions"
      ? "real_exam_questions"
      : "questions_bank";
    const batchSize = Math.min(Math.max(parseInt(body.batch_size ?? 100, 10), 10), 500);
    const dryRun: boolean = body.dry_run === true;
    // [v25-controlled] Filtro defensivo: processar apenas questões adicionadas a partir de uma data
    // Garante que rodadas operacionais não afetem o restante do banco (Freeze v25).
    const createdAfter: string | null = typeof body.created_after === "string" && body.created_after.length > 0
      ? body.created_after
      : null;
    console.info("[classify-hierarchy] start", {
      user: userData.user.id,
      tableSource,
      batchSize,
      dryRun,
      createdAfter,
    });


    // 1) Carregar currículo (cache em memória do invocador)
    const { data: specsRaw } = await admin
      .from("curriculum_specialties")
      .select("id, nome")
      .eq("ativo", true);
    const { data: topicsRaw } = await admin
      .from("curriculum_topics")
      .select("id, nome, specialty_id")
      .eq("ativo", true);
    const { data: subtopicsRaw } = await admin
      .from("curriculum_subtopics")
      .select("id, nome, topic_id")
      .eq("ativo", true);

    const specialties: Specialty[] = (specsRaw ?? []).map((s: any) => ({
      id: s.id,
      nome: s.nome,
      norm: normalize(s.nome),
      tokens: tokens(s.nome),
    }));
    const topics: Topic[] = (topicsRaw ?? []).map((t: any) => ({
      id: t.id,
      nome: t.nome,
      specialty_id: t.specialty_id,
      norm: normalize(t.nome),
    }));
    const subtopics: Subtopic[] = (subtopicsRaw ?? []).map((s: any) => ({
      id: s.id,
      nome: s.nome,
      topic_id: s.topic_id,
      norm: normalize(s.nome),
    }));

    // 1b) Carregar aliases curriculares ativos
    const { data: aliasRaw } = await admin
      .from("curriculum_aliases")
      .select("normalized_alias, specialty_id, topic_id, subtopic_id")
      .eq("active", true);
    const aliases = new Map<string, AliasRow>();
    for (const a of aliasRaw ?? []) {
      if (a?.normalized_alias) {
        aliases.set(a.normalized_alias, {
          normalized_alias: a.normalized_alias,
          specialty_id: a.specialty_id ?? null,
          topic_id: a.topic_id ?? null,
          subtopic_id: a.subtopic_id ?? null,
        });
      }
    }
    console.info("[classify-hierarchy] aliases loaded", { count: aliases.size });

    // 2) Criar registro do run
    const { data: run, error: runErr } = await admin
      .from("question_classification_runs")
      .insert({
        table_source: tableSource,
        batch_size: batchSize,
        dry_run: dryRun,
        status: "running",
        triggered_by: userData.user.id,
      })
      .select()
      .single();
    if (runErr || !run) throw new Error(`failed to create run: ${runErr?.message}`);

    // 3) Buscar lote NÃO classificado ainda (specialty_id IS NULL)
    const selectCols = "id, topic, subtopic, classification_confidence";
    let query = admin
      .from(tableSource)
      .select(selectCols)
      .is("specialty_id", null)
      .is("classification_method", null);

    if (createdAfter) {
      query = query.gte("created_at", createdAfter);
    }
    // FIX OPERACIONAL: ordenação determinística (oldest eligible first)
    // evita viés por ordem física da tabela no LIMIT
    const { data: rows, error: rowsErr } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(batchSize);
    if (rowsErr) throw new Error(`failed to fetch rows: ${rowsErr.message}`);


    const breakdown: Record<string, number> = { alias_exact: 0, exact_text: 0, heuristic: 0, ai: 0 };
    const aliasEvents: Array<{
      run_id: string;
      table_source: string;
      question_id: string;
      original_topic: string | null;
      normalized_topic: string | null;
      alias_key: string;
      alias_target: string;
      specialty_id: string | null;
      topic_id: string | null;
      subtopic_id: string | null;
      confidence: number;
    }> = [];
    let applied = 0;
    let queuedReview = 0;
    let skipped = 0;
    const sampleAmbiguous: any[] = [];

    for (const row of rows ?? []) {
      const result = classifyDeterministic(
        row.topic,
        row.subtopic,
        specialties,
        topics,
        subtopics,
        aliases,
      );

      // Idempotência: respeita confiança maior já existente
      const existingConf = (row as any).classification_confidence ?? 0;
      if (existingConf && existingConf > result.confidence) {
        skipped++;
        continue;
      }

      if (!result.specialty_id || result.confidence < REVIEW_THRESHOLD) {
        // muito baixo: só vai para fila (se houver alguma sugestão), senão skip
        // FIX STICKY QUEUE: em ambos os casos marcamos a questão como 'skipped'
        // com classification_reason explícito, para sair do scope do scanner
        // (que filtra por specialty_id IS NULL).
        const skipReason: "no_specialty_match" | "low_confidence" | "no_topic" =
          !result.specialty_id
            ? "no_specialty_match"
            : !result.topic_id
              ? "no_topic"
              : "low_confidence";

        if (result.specialty_id) {
          if (!dryRun) {
            await admin
              .from("question_classification_queue")
              .upsert(
                {
                  run_id: run.id,
                  table_source: tableSource,
                  question_id: row.id,
                  original_topic: row.topic,
                  original_subtopic: row.subtopic,
                  suggested_specialty_id: result.specialty_id,
                  suggested_topic_id: result.topic_id,
                  suggested_subtopic_id: result.subtopic_id,
                  suggested_microtopic_id: result.microtopic_id,
                  classification_method: result.method,
                  confidence_score: result.confidence,
                  reason: result.reason,
                  status: "pending",
                },
                { onConflict: "table_source,question_id", ignoreDuplicates: false },
              );
          }
          queuedReview++;
          if (sampleAmbiguous.length < 10) {
            sampleAmbiguous.push({
              question_id: row.id,
              topic: row.topic,
              subtopic: row.subtopic,
              suggestion: result,
              skip_reason: skipReason,
            });
          }
        } else {
          skipped++;
          if (sampleAmbiguous.length < 10) {
            sampleAmbiguous.push({
              question_id: row.id,
              topic: row.topic,
              subtopic: row.subtopic,
              reason: result.reason,
              skip_reason: skipReason,
            });
          }
        }

        // Marca questão como skipped no banco (sai da fila do scanner)
        if (!dryRun && tableSource === "questions_bank") {
          const { error: skipErr } = await admin
            .from(tableSource)
            .update({
              classification_method: "skipped",
              classification_reason: skipReason,
              classified_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          if (skipErr) {
            console.error(
              `[classify-hierarchy] SKIP MARK FAILED qid=${row.id} reason=${skipReason} err=${skipErr.message}`,
            );
          }
        }
        continue;
      }


      // confiança média/alta
      breakdown[result.method]++;

      // Telemetria: alias_exact → registrar evento
      if (result.method === "alias_exact" && result.alias_key && result.alias_target) {
        aliasEvents.push({
          run_id: run.id,
          table_source: tableSource,
          question_id: row.id,
          original_topic: row.topic ?? null,
          normalized_topic: result.normalized_topic ?? null,
          alias_key: result.alias_key,
          alias_target: result.alias_target,
          specialty_id: result.specialty_id,
          topic_id: result.topic_id,
          subtopic_id: result.subtopic_id,
          confidence: result.confidence,
        });
      }

      let updateOk = true;
      if (!dryRun) {
        const { error: updErr } = await admin
          .from(tableSource)
          .update({
            specialty_id: result.specialty_id,
            topic_id: result.topic_id,
            subtopic_id: result.subtopic_id,
            microtopic_id: result.microtopic_id,
            classification_confidence: result.confidence,
            classification_method: result.method,
            classified_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updErr) {
          updateOk = false;
          console.error(
            `[classify-hierarchy] UPDATE FAILED qid=${row.id} method=${result.method} reason=${updErr.message}`,
          );
          // não conta como aplicado se a escrita falhou
          continue;
        }

        if (result.confidence < APPLY_THRESHOLD) {
          // 0.7 - 0.9: aplica + envia para revisão
          await admin
            .from("question_classification_queue")
            .upsert(
              {
                run_id: run.id,
                table_source: tableSource,
                question_id: row.id,
                original_topic: row.topic,
                original_subtopic: row.subtopic,
                suggested_specialty_id: result.specialty_id,
                suggested_topic_id: result.topic_id,
                suggested_subtopic_id: result.subtopic_id,
                suggested_microtopic_id: result.microtopic_id,
                classification_method: result.method,
                confidence_score: result.confidence,
                reason: result.reason + " (aplicado, aguarda revisão)",
                status: "pending",
              },
              { onConflict: "table_source,question_id", ignoreDuplicates: false },
            );
          queuedReview++;
        }
      }
      if (updateOk) applied++;
    }

    // Persistir alias events em batch (mesmo em dry-run, para análise)
    if (aliasEvents.length > 0) {
      const { error: aliasEvtErr } = await admin
        .from("alias_match_events")
        .insert(aliasEvents);
      if (aliasEvtErr) {
        console.warn("[classify-hierarchy] alias_match_events insert failed", aliasEvtErr.message);
      }
    }

    // Métricas finais
    const processed = (rows ?? []).length;
    const aliasExactCount = breakdown.alias_exact ?? 0;
    const exactTextCount = breakdown.exact_text ?? 0;
    const heuristicCount = breakdown.heuristic ?? 0;
    const deterministicPct = processed > 0
      ? Math.round(((aliasExactCount + exactTextCount) / processed) * 10000) / 100
      : 0;
    const heuristicPct = processed > 0
      ? Math.round((heuristicCount / processed) * 10000) / 100
      : 0;
    const queuePct = processed > 0
      ? Math.round((queuedReview / processed) * 10000) / 100
      : 0;
    const skippedPct = processed > 0
      ? Math.round((skipped / processed) * 10000) / 100
      : 0;

    await admin
      .from("question_classification_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        total_processed: processed,
        total_applied: applied,
        total_queued_review: queuedReview,
        total_skipped: skipped,
        method_breakdown: breakdown,
        deterministic_pct: deterministicPct,
        heuristic_pct: heuristicPct,
        queue_pct: queuePct,
        skipped_pct: skippedPct,
        alias_exact_count: aliasExactCount,
        exact_text_count: exactTextCount,
        heuristic_count: heuristicCount,
        notes: dryRun ? "dry-run; nada foi gravado" : null,
      })
      .eq("id", run.id);

    // Snapshot de saúde global (mesmo em dry-run)
    try {
      const { data: healthRow } = await admin
        .from("v_classification_health")
        .select("*")
        .maybeSingle();
      if (healthRow) {
        await admin.from("classification_health_snapshots").insert({
          run_id: run.id,
          total_questions: healthRow.total_questions,
          pct_specialty: healthRow.pct_specialty,
          pct_topic: healthRow.pct_topic,
          pct_subtopic: healthRow.pct_subtopic,
          queue_pending: healthRow.queue_pending,
          deterministic_pct: deterministicPct,
          heuristic_pct: heuristicPct,
          queue_pct: queuePct,
          skipped_pct: skippedPct,
        });
      }
    } catch (snapErr) {
      console.warn("[classify-hierarchy] health snapshot failed", snapErr);
    }

    console.info("[classify-hierarchy] done", {
      run_id: run.id,
      dryRun,
      processed,
      applied,
      queuedReview,
      skipped,
      breakdown,
      deterministicPct,
      aliasEvents: aliasEvents.length,
      wrote_to_questions_table: !dryRun,
    });

    return new Response(
      JSON.stringify({
        run_id: run.id,
        table_source: tableSource,
        batch_size: batchSize,
        dry_run: dryRun,
        total_processed: (rows ?? []).length,
        total_applied: applied,
        total_queued_review: queuedReview,
        total_skipped: skipped,
        method_breakdown: breakdown,
        sample_ambiguous: sampleAmbiguous,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("classify-question-hierarchy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
