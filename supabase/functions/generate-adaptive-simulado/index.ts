import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson, cleanQuestionText } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──

type ModalityLevel = "FRAQUEZA_CRITICA" | "FRAQUEZA_MODERADA" | "ESTAVEL" | "FORTE";

interface PerformanceInput {
  by_modality: Record<string, number>;
  by_difficulty: Record<string, number>;
  response_time: Record<string, number>;
  error_patterns: string[];
}

interface ModalityAnalysis {
  modality: string;
  accuracy: number;
  level: ModalityLevel;
  responseTime: number;
  priority: number;
}

interface QuestionAllocation {
  modality: string;
  count: number;
  difficulty: string;
  exam_style: string;
}

// ── Classification ──

function classifyModality(accuracy: number): ModalityLevel {
  if (accuracy < 50) return "FRAQUEZA_CRITICA";
  if (accuracy < 65) return "FRAQUEZA_MODERADA";
  if (accuracy < 80) return "ESTAVEL";
  return "FORTE";
}

function analyzePerformance(perf: PerformanceInput): ModalityAnalysis[] {
  const modalities = Object.keys(perf.by_modality);
  return modalities.map(mod => {
    const accuracy = perf.by_modality[mod] ?? 0;
    const level = classifyModality(accuracy);
    const responseTime = perf.response_time[mod] ?? 0;
    // Priority: lower accuracy = higher priority, slow = bonus
    let priority = (100 - accuracy);
    if (responseTime > 180) priority += 20;
    else if (responseTime > 150) priority += 10;
    if (level === "FRAQUEZA_CRITICA") priority += 30;
    return { modality: mod, accuracy, level, responseTime, priority };
  }).sort((a, b) => b.priority - a.priority);
}

function buildAllocations(
  analysis: ModalityAnalysis[],
  targetCount: number,
  errorPatterns: string[]
): QuestionAllocation[] {
  const allocations: QuestionAllocation[] = [];
  const critical = analysis.filter(a => a.level === "FRAQUEZA_CRITICA");
  const moderate = analysis.filter(a => a.level === "FRAQUEZA_MODERADA");
  const stable = analysis.filter(a => a.level === "ESTAVEL" || a.level === "FORTE");

  let remainingSlots = targetCount;

  const distribute = (group: ModalityAnalysis[], weight: number, diffProfile: string) => {
    if (group.length === 0 || remainingSlots <= 0) return;
    
    // Calculate slots for this group based on weight, but don't exceed remaining
    let slotsForGroup = Math.min(remainingSlots, Math.round(targetCount * weight));
    if (slotsForGroup <= 0 && remainingSlots > 0 && group.length > 0) {
      slotsForGroup = remainingSlots; // Take what's left if this is the only group
    }

    const perMod = Math.max(1, Math.ceil(slotsForGroup / group.length));
    
    for (const mod of group) {
      const count = Math.min(perMod, remainingSlots);
      if (count <= 0) break;

      let difficulty = "medium";
      let examStyle = "ENARE";
      if (diffProfile === "critical") {
        difficulty = "hard";
        examStyle = mod.accuracy < 40 ? "ENARE" : "USP";
      } else if (diffProfile === "moderate") {
        difficulty = "medium";
        examStyle = "ENARE";
      } else {
        difficulty = "hard";
        examStyle = "USP";
      }

      allocations.push({ modality: mod.modality, count, difficulty, exam_style: examStyle });
      remainingSlots -= count;
    }
  };

  // 1st pass: Critical
  distribute(critical, 0.6, "critical");
  // 2nd pass: Moderate
  distribute(moderate, 0.3, "moderate");
  // 3rd pass: Stable (takes everything else)
  if (remainingSlots > 0) {
    distribute(stable, 1.0, "maintenance");
  }

  return allocations;
}

// ── Prompt ──

function buildPrompt(
  asset: any,
  difficulty: string,
  examStyle: string,
  errorPatterns: string[],
  questionsNeeded: number
): string {
  const findings = Array.isArray(asset.clinical_findings)
    ? asset.clinical_findings.join(", ")
    : String(asset.clinical_findings || "");
  const distractors = Array.isArray(asset.distractors)
    ? asset.distractors.join(", ")
    : String(asset.distractors || "");

  const focusHints = [];
  if (errorPatterns.includes("imagem")) focusHints.push("Exija interpretação visual detalhada da imagem.");
  if (errorPatterns.includes("conduta")) focusHints.push("Foque em decisão terapêutica e conduta.");
  if (errorPatterns.includes("diagnóstico")) focusHints.push("Foque em diagnóstico diferencial.");

  return `IDIOMA: PORTUGUÊS BRASILEIRO. Gere ${questionsNeeded} questão(ões) médica(s) de residência.

ASSET:
- Tipo: ${asset.image_type}
- Diagnóstico: ${asset.diagnosis}
- Achados: ${findings}
- Distratores: ${distractors}
- Especialidade: ${asset.specialty || "N/A"}
- Subtema: ${asset.subtopic || "N/A"}

CONFIGURAÇÃO:
- Dificuldade: ${difficulty}
- Banca: ${examStyle}
${focusHints.length > 0 ? `- Foco especial: ${focusHints.join(" ")}` : ""}

REGRAS:
- statement >= 400 chars (caso clínico completo: idade, sexo, HDA, exame físico, referência ao exame de imagem)
- 5 alternativas plausíveis (option_a até option_e)
- correct_index (0-4)${questionsNeeded > 1 ? ", DIFERENTE em cada questão" : ""}
- explanation >= 120 chars
- rationale_map completo (A-E)
- difficulty: "${difficulty}"
- exam_style: "${examStyle}"

Retorne APENAS JSON array com ${questionsNeeded} questão(ões).`;
}

// ── Validation ──

function validateQuestion(q: any): string[] {
  const errors: string[] = [];
  if (!q.statement || q.statement.length < 400) errors.push("statement_short");
  if (!q.explanation || q.explanation.length < 120) errors.push("explanation_short");
  for (const c of ["a", "b", "c", "d", "e"]) {
    if (!q[`option_${c}`]) errors.push(`missing_option_${c}`);
  }
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index > 4) {
    errors.push("invalid_correct_index");
  }
  const rm = q.rationale_map;
  if (!rm || typeof rm !== "object") {
    errors.push("missing_rationale_map");
  } else {
    for (const k of ["A", "B", "C", "D", "E"]) {
      if (!rm[k] || rm[k].length < 10) errors.push(`weak_rationale_${k}`);
    }
  }
  return errors;
}

function scoreQuestion(q: any, asset: any): number {
  let s = 0;
  const stmt = q.statement || "";
  const expl = q.explanation || "";
  const diag = (asset.diagnosis || "").toLowerCase();

  // Clinical coherence (30%)
  if (diag && stmt.toLowerCase().includes(diag.split(" ")[0])) s += 30;
  else if (diag) s += 15;

  // Alternatives quality (20%)
  const opts = ["a", "b", "c", "d", "e"].map(c => (q[`option_${c}`] || "").trim().toLowerCase());
  s += new Set(opts).size === 5 ? 20 : 10;

  // Exam level (20%)
  s += stmt.length >= 500 ? 20 : stmt.length >= 400 ? 15 : 5;

  // Clarity (15%)
  const hasContext = ["anos", "sexo", "exame", "queixa", "história", "apresenta"].some(w => stmt.toLowerCase().includes(w));
  s += hasContext ? 15 : 8;

  // Explanation quality (15%)
  s += expl.length >= 200 ? 15 : expl.length >= 120 ? 10 : 3;

  return Math.min(s, 100);
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const user = { id: auth.userId };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const targetCount = Math.min(body.target_question_count || 20, 30);

    // ── 1. Build performance profile ──
    const performance: PerformanceInput = body.performance || {
      by_modality: { ecg: 70, xray: 60, ct: 40, us: 45, pathology: 30, ophthalmology: 35, dermatology: 65 },
      by_difficulty: { easy: 80, medium: 55, hard: 35 },
      response_time: { ecg: 90, xray: 120, ct: 160, us: 170, pathology: 180, ophthalmology: 190 },
      error_patterns: [],
    };

    // Robustness: ensure we have at least some modalities if empty
    if (!performance.by_modality || Object.keys(performance.by_modality).length === 0 || (Object.keys(performance.by_modality).length === 1 && performance.by_modality["text"])) {
      performance.by_modality = { ecg: 50, xray: 50, dermatology: 50, ct: 50, us: 50, pathology: 50, ophthalmology: 50 };
    }

    const analysis = analyzePerformance(performance);
    const allocations = buildAllocations(analysis, targetCount, performance.error_patterns || []);

    // ── 2. Fetch published questions from DB (prefer existing) ──
    const questions: any[] = [];
    const meta = {
      focus: analysis[0]?.modality || "mixed",
      strategy: `Targeting ${analysis.filter(a => a.level === "FRAQUEZA_CRITICA").length} critical weaknesses`,
      weakness_targeted: analysis.filter(a => a.level === "FRAQUEZA_CRITICA").map(a => a.modality).join(", ") || "none",
      distribution: { modalities: {} as Record<string, number>, difficulty: {} as Record<string, number>, exam_style: {} as Record<string, number> },
    };

    // Try to serve from existing published questions first (editorial quality gated)
    for (const alloc of allocations) {
      const { data: existing } = await sb
        .from("medical_image_questions")
        .select(`
          id, statement, option_a, option_b, option_c, option_d, option_e,
          correct_index, explanation, rationale_map, difficulty, exam_style,
          senior_audit_score, editorial_grade,
          medical_image_assets!inner(image_url, image_type, diagnosis, specialty, subtopic, clinical_confidence, is_active, review_status, integrity_status, validation_level, asset_origin)
        `)
        .eq("status", "published")
        .eq("medical_image_assets.image_type", alloc.modality)
        .eq("medical_image_assets.is_active", true)
        .eq("medical_image_assets.review_status", "published")
        .order("senior_audit_score", { ascending: false }, { nullsFirst: false })
        .limit(alloc.count * 2);

      if (existing && existing.length > 0) {
        // Prioritize excellent over good
        const excellent = existing.filter((q: any) => q.editorial_grade === "excellent");
        const good = existing.filter((q: any) => q.editorial_grade === "good");
        const prioritized = [...excellent, ...good].slice(0, alloc.count);

        for (const q of prioritized) {
          const asset = (q as any).medical_image_assets;
          questions.push({
            statement: q.statement,
            options: [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e],
            correct: q.correct_index,
            explanation: q.explanation,
            rationale_map: q.rationale_map,
            image_url: asset?.image_url || null,
            image_type: asset?.image_type || alloc.modality,
            topic: asset?.specialty || "",
            subtopic: asset?.subtopic || "",
            difficulty: q.difficulty,
            exam_style: q.exam_style,
            _isImageQuestion: true,
            _source: "bank",
            _editorialGrade: q.editorial_grade,
          });

          // Track distribution
          const mod = asset?.image_type || alloc.modality;
          meta.distribution.modalities[mod] = (meta.distribution.modalities[mod] || 0) + 1;
          meta.distribution.difficulty[q.difficulty] = (meta.distribution.difficulty[q.difficulty] || 0) + 1;
          meta.distribution.exam_style[q.exam_style] = (meta.distribution.exam_style[q.exam_style] || 0) + 1;
        }
      }
    }

    // ── 3. If not enough, generate via AI ──
    const deficit = targetCount - questions.length;
    if (deficit > 0) {
      // Find assets that need questions
      const priorityModalities = analysis
        .filter(a => a.level !== "FORTE")
        .map(a => a.modality)
        .filter(m => ["ct", "us", "pathology", "ophthalmology", "xray", "dermatology"].includes(m));

      if (priorityModalities.length > 0) {
        const { data: assets } = await sb
          .from("medical_image_assets")
          .select("id, asset_code, image_type, diagnosis, clinical_findings, distractors, difficulty, specialty, subtopic, image_url")
          .eq("is_active", true)
          .eq("review_status", "published")
          .in("image_type", priorityModalities)
          .limit(Math.min(deficit, 5));

        if (assets && assets.length > 0) {
          const questionsPerAsset = Math.min(3, Math.ceil(deficit / assets.length));

          for (const asset of assets) {
            if (questions.length >= targetCount) break;

            try {
              const prompt = buildPrompt(
                asset,
                "hard",
                analysis[0]?.accuracy < 50 ? "ENARE" : "USP",
                performance.error_patterns || [],
                questionsPerAsset
              );

              const response = await aiFetch({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-4o-mini",
                maxTokens: 12000,
                timeoutMs: 60000,
              });

              if (!response.ok) continue;

              const aiData = await response.json();
              const rawContent = aiData.choices?.[0]?.message?.content || "";
              const parsed = parseAiJson(rawContent);
              const arr = Array.isArray(parsed) ? parsed : [parsed];

              for (const q of arr) {
                if (questions.length >= targetCount) break;

                // Clean
                for (const f of ["statement", "option_a", "option_b", "option_c", "option_d", "option_e", "explanation"]) {
                  if (typeof q[f] === "string") q[f] = cleanQuestionText(q[f]);
                }

                const errors = validateQuestion(q);
                const score = scoreQuestion(q, asset);

                if (errors.length > 0 || score < 75) continue;

                questions.push({
                  statement: q.statement,
                  options: [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e],
                  correct: q.correct_index,
                  explanation: q.explanation,
                  rationale_map: q.rationale_map,
                  image_url: asset.image_url || null,
                  image_type: asset.image_type,
                  topic: asset.specialty || "",
                  subtopic: asset.subtopic || "",
                  difficulty: q.difficulty || "hard",
                  exam_style: q.exam_style || "ENARE",
                  _isImageQuestion: true,
                  _source: "generated",
                  _score: score,
                });

                const mod = asset.image_type;
                meta.distribution.modalities[mod] = (meta.distribution.modalities[mod] || 0) + 1;
                meta.distribution.difficulty[q.difficulty || "hard"] = (meta.distribution.difficulty[q.difficulty || "hard"] || 0) + 1;
                meta.distribution.exam_style[q.exam_style || "ENARE"] = (meta.distribution.exam_style[q.exam_style || "ENARE"] || 0) + 1;
              }
            } catch (e) {
              console.error(`[adaptive] AI generation failed for ${asset.asset_code}:`, e);
            }

            await new Promise(r => setTimeout(r, 500));
          }
        }
      }
    }

    // ── 4. Shuffle to avoid predictable order ──
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    return new Response(JSON.stringify({
      success: true,
      questions: questions.slice(0, targetCount),
      meta,
      total: Math.min(questions.length, targetCount),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[FATAL] generate-adaptive-simulado:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Erro desconhecido",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
