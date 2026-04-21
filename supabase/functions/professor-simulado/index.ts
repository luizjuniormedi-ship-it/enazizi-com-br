import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent, cleanQuestionText } from "../_shared/ai-fetch.ts";
import { IMAGE_REF_PATTERN, ENGLISH_PATTERN } from "../_shared/question-filters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeStatement(raw: string): string {
  let s = raw;
  // Remove gabarito/resposta correta that AI sometimes appends
  s = s.replace(/\n?\s*\*{0,2}(Gabarito|Resposta|Alternativa correta|Correct answer|Answer)[:\s].*/gi, "");
  // Remove metadata (topic/difficulty)
  s = s.replace(/\n?\s*\*{0,2}(Tópico|Tema|Especialidade|Subtema|Dificuldade|Difficulty)[:\s].*/gi, "");
  // Remove "Questão X:" prefix
  s = s.replace(/^\s*\*{0,2}Questão\s*\d*\s*:?\s*\*{0,2}\s*/gi, "");
  // Clean LaTeX residues
  s = cleanQuestionText(s);
  // Truncate after last "?" if trailing lines are short non-clinical metadata
  const lastQ = s.lastIndexOf("?");
  if (lastQ > 0 && lastQ < s.length - 2) {
    const after = s.slice(lastQ + 1).trim();
    const lines = after.split("\n").filter((l: string) => l.trim());
    if (lines.length > 0 && lines.length <= 5 &&
        lines.every((l: string) => l.trim().length < 100 && !/\d+\s*(mg|ml|mmHg|bpm|°C|%|U\/L|g\/dL|mEq|mmol)/.test(l))) {
      s = s.slice(0, lastQ + 1);
    }
  }
  return s.trim();
}

/** Filter out questions that reference images/figures we cannot display */
function filterImageRefs(questions: any[]): any[] {
  return questions.filter((q: any) => {
    const stmt = String(q.statement || "");
    if (IMAGE_REF_PATTERN.test(stmt)) {
      console.warn(`[professor-simulado] Rejeitada por ref a imagem: "${stmt.slice(0, 80)}"`);
      return false;
    }
    return true;
  });
}

type DifficultyLevel = "facil" | "intermediario" | "dificil";

function normalizeDifficultyLevel(value: unknown): DifficultyLevel | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 2) return "facil";
    if (value >= 4) return "dificil";
    return "intermediario";
  }

  const raw = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (["facil", "easy"].includes(raw)) return "facil";
  if (["intermediario", "medio", "medium"].includes(raw)) return "intermediario";
  if (["dificil", "hard"].includes(raw)) return "dificil";

  return null;
}

function inferDifficultyLevel(question: any, requestedDifficulty?: string): DifficultyLevel {
  const explicit = normalizeDifficultyLevel(question?.difficulty_level);
  if (explicit) return explicit;

  const numeric = Number(question?.difficulty);
  if (Number.isFinite(numeric)) {
    return normalizeDifficultyLevel(numeric) || "intermediario";
  }

  return normalizeDifficultyLevel(requestedDifficulty) || "intermediario";
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickCachedQuestions(params: {
  questions: any[];
  requestedCount: number;
  requestedDifficulty: string;
  difficultyMix?: { facil?: number; intermediario?: number; dificil?: number };
}): any[] {
  const grouped: Record<DifficultyLevel, any[]> = {
    facil: [],
    intermediario: [],
    dificil: [],
  };

  for (const question of params.questions) {
    grouped[inferDifficultyLevel(question, params.requestedDifficulty)].push(question);
  }

  const pools: Record<DifficultyLevel, any[]> = {
    facil: shuffleArray(grouped.facil),
    intermediario: shuffleArray(grouped.intermediario),
    dificil: shuffleArray(grouped.dificil),
  };

  const selected: any[] = [];

  const takeFromPool = (level: DifficultyLevel, count: number) => {
    if (count <= 0) return;
    selected.push(...pools[level].splice(0, count));
  };

  if (params.requestedDifficulty === "misto" && params.difficultyMix) {
    const targetFacil = Math.round(params.requestedCount * (params.difficultyMix.facil || 0) / 100);
    const targetIntermediario = Math.round(params.requestedCount * (params.difficultyMix.intermediario || 0) / 100);
    const targetDificil = Math.max(0, params.requestedCount - targetFacil - targetIntermediario);

    takeFromPool("facil", targetFacil);
    takeFromPool("intermediario", targetIntermediario);
    takeFromPool("dificil", targetDificil);
  } else {
    const requestedLevel = normalizeDifficultyLevel(params.requestedDifficulty);
    if (requestedLevel) {
      takeFromPool(requestedLevel, params.requestedCount);
    }
  }

  if (selected.length < params.requestedCount) {
    const leftovers = shuffleArray([
      ...pools.facil,
      ...pools.intermediario,
      ...pools.dificil,
    ]);
    selected.push(...leftovers.slice(0, params.requestedCount - selected.length));
  }

  return selected.slice(0, params.requestedCount);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Use anon-key client with user's token for auth validation (avoids session_not_found with service role)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check professor role
    const { data: roleData } = await sb.from("user_roles").select("role").eq("user_id", user.id).in("role", ["professor", "admin"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Apenas professores podem usar esta função." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...params } = await req.json();
    const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get professor's faculdade and name for scoping and notifications
    const isAdmin = roleData.some((r: any) => r.role === "admin");
    let professorFaculdade: string | null = null;
    let professorName: string = "seu professor";
    {
      const { data: profProfile } = await sb.from("profiles").select("faculdade, display_name").eq("user_id", user.id).single();
      if (profProfile) {
        professorFaculdade = profProfile.faculdade || null;
        professorName = (profProfile.display_name || "").split(" ")[0] || "seu professor";
      }
    }
    // Helper: check if notification already sent for this activity (dedup)
    const today = new Date().toISOString().slice(0, 10);
    const alreadyNotifiedWhatsApp = async (activityTag: string, targetIds: string[]): Promise<string[]> => {
      if (targetIds.length === 0) return [];
      const { data } = await sb.from("whatsapp_message_log")
        .select("target_user_id")
        .in("target_user_id", targetIds)
        .like("message_text", `%${activityTag}%`)
        .gte("created_at", `${today}T00:00:00Z`);
      return (data || []).map((r: any) => r.target_user_id);
    };
    const alreadyNotifiedInApp = async (titleTag: string, recipientIds: string[]): Promise<string[]> => {
      if (recipientIds.length === 0) return [];
      const { data } = await sb.from("admin_messages")
        .select("recipient_id")
        .in("recipient_id", recipientIds)
        .like("title", `%${titleTag}%`)
        .gte("created_at", `${today}T00:00:00Z`);
      return (data || []).map((r: any) => r.recipient_id);
    };

    switch (action) {
      case "generate_questions": {
        const { topics, count = 10, difficulty = "intermediario", difficultyMix, previousStatements, examBoard } = params;
        if (!topics || !topics.length) throw new Error("Selecione pelo menos um tema");

        const requestedCount = Math.min(count, 100);
        const SAFE_BATCH = 8;
        const topicList = topics.join(", ");

        // ── Compute exact per-slot targets ──
        type Slot = { level: DifficultyLevel; target: number };
        const slots: Slot[] = [];
        if (difficulty === "misto" && difficultyMix) {
          const nFacil = Math.round(requestedCount * (difficultyMix.facil || 0) / 100);
          const nInterm = Math.round(requestedCount * (difficultyMix.intermediario || 0) / 100);
          const nDificil = Math.max(0, requestedCount - nFacil - nInterm);
          if (nFacil > 0) slots.push({ level: "facil", target: nFacil });
          if (nInterm > 0) slots.push({ level: "intermediario", target: nInterm });
          if (nDificil > 0) slots.push({ level: "dificil", target: nDificil });
        } else {
          const level = normalizeDifficultyLevel(difficulty) || "intermediario";
          slots.push({ level, target: requestedCount });
        }

        console.log(`[Slots] Distribution: ${slots.map(s => `${s.level}=${s.target}`).join(", ")} (total=${requestedCount})`);

        // ── Difficulty descriptions for prompts ──
        const levelDesc: Record<DifficultyLevel, string> = {
          facil: "FÁCIL — conceitos diretos, diagnóstico clássico e evidente, apresentação típica, sem pegadinhas. O aluno deve conseguir acertar apenas com conhecimento básico.",
          intermediario: "INTERMEDIÁRIO — exige raciocínio clínico moderado, diagnósticos diferenciais simples, conduta padrão com uma ou duas comorbidades.",
          dificil: "DIFÍCIL — apresentações atípicas, múltiplas comorbidades, dilemas de conduta complexos, pegadinhas de prova de residência (ENARE/USP/UNIFESP).",
        };

        // ── High-yield subtopics ──
        const HIGH_YIELD: Record<string, string[]> = {
          "Cardiologia": ["Insuficiência Cardíaca", "Síndromes Coronarianas Agudas", "Hipertensão Arterial", "Arritmias", "Endocardite"],
          "Cirurgia": ["Abdome Agudo", "Politrauma", "Hérnias", "Colecistite", "Apendicite"],
          "Pediatria": ["Neonatologia", "Aleitamento Materno", "Bronquiolite", "Doenças Exantemáticas", "Imunização"],
          "Ginecologia e Obstetrícia": ["Pré-eclâmpsia", "Hemorragias da Gestação", "Pré-natal", "Diabetes Gestacional"],
          "Medicina Preventiva": ["SUS", "Epidemiologia", "Vacinação", "Estudos Epidemiológicos", "Bioestatística"],
          "Infectologia": ["HIV/AIDS", "Tuberculose", "Sepse", "Arboviroses", "Meningites"],
          "Pneumologia": ["Asma", "DPOC", "Pneumonia", "Tuberculose Pulmonar", "Tromboembolismo Pulmonar"],
          "Gastroenterologia": ["Doença do Refluxo", "Hemorragia Digestiva", "Cirrose Hepática", "Hepatites Virais"],
          "Endocrinologia": ["Diabetes Mellitus", "Tireoidopatias", "Cetoacidose Diabética", "Dislipidemias"],
          "Neurologia": ["AVC Isquêmico", "Epilepsia", "Cefaléias", "Meningites"],
          "Dermatologia": ["Hanseníase", "Câncer de Pele", "Lesões Elementares da Pele"],
          "Nefrologia": ["Insuficiência Renal Aguda", "Distúrbios Hidroeletrolíticos", "Distúrbios Ácido-Base"],
          "Hematologia": ["Anemias", "Leucemias", "Linfomas"],
          "Reumatologia": ["Lúpus Eritematoso Sistêmico", "Artrite Reumatoide", "Vasculites"],
          "Psiquiatria": ["Depressão", "Esquizofrenia", "Emergências Psiquiátricas"],
          "Urologia": ["Litíase Renal", "Infecção Urinária", "Hiperplasia Prostática"],
          "Terapia Intensiva": ["Ventilação Mecânica", "Sepse e Choque Séptico", "SDRA"],
        };
        const baseTopics = topics.map((t: string) => String(t).split("(")[0].trim()).filter(Boolean);
        const subtopicTerms: string[] = topics.flatMap((t: string) => {
          const match = String(t).match(/\(([^)]+)\)/);
          return match ? match[1].split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        });
        const hasSubtopicFilter = subtopicTerms.length > 0;
        const priorityLines = baseTopics
          .filter((t: string) => HIGH_YIELD[t])
          .map((t: string) => `- ${t}: ${HIGH_YIELD[t].join(", ")}`)
          .join("\n");
        const priorityBlock = priorityLines
          ? `\nSUBTÓPICOS PRIORITÁRIOS:\n${priorityLines}`
          : "";

        // ── Strict prompt builder per slot ──
        const examBoardContext = examBoard
          ? `\nESTILO DE BANCA OBRIGATÓRIO: ${examBoard}. Elabore questões no estilo e formato desta banca examinadora. Reproduza o nível de complexidade, a forma de cobrança e o perfil de alternativas típicos da ${examBoard}.`
          : "";
        const buildSlotPrompt = (batchSize: number, level: DifficultyLevel, prevStatements: string[]) => {
          const perTopic = Math.max(1, Math.floor(batchSize / topics.length));
          let prompt = `Gere exatamente ${batchSize} questões objetivas de múltipla escolha (A-E) para residência médica sobre: ${topicList}.${priorityBlock}${examBoardContext}

IDIOMA OBRIGATÓRIO: TUDO deve ser escrito em PORTUGUÊS BRASILEIRO (pt-BR). Enunciados, alternativas, explicações — absolutamente TUDO em português. NUNCA use inglês em nenhum campo.

NÍVEL DE DIFICULDADE OBRIGATÓRIO: ${levelDesc[level]}
TODAS as ${batchSize} questões DEVEM ser de nível ${level.toUpperCase()}.
Cada questão DEVE ter o campo "difficulty_level" com valor "${level}".

${topics.length > 1 ? `Distribua proporcionalmente entre os temas (~${perTopic} por tema). Cada questão DEVE ter o campo "block".` : `Todas pertencem ao bloco "${topics[0]}".`}

Retorne APENAS um array JSON válido:
[
  {
    "block": "Nome do bloco",
    "statement": "Caso clínico completo em português (mín 400 caracteres)",
    "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
    "correct_index": 0,
    "explanation": "Explicação detalhada em português",
    "topic": "Tema/subtema",
    "difficulty_level": "${level}"
  }
]

REGRAS INVIOLÁVEIS:
- Mínimo 400 caracteres no enunciado (caso clínico completo com identificação, HDA, exame físico, exames)
- 5 alternativas plausíveis (A-E)
- NUNCA use LaTeX ($x$, \\times). Use texto puro: 148×90 mmHg, 38%
- NUNCA referencie imagens, figuras ou gráficos
- NUNCA repita a mesma letra de gabarito consecutivamente
- Varie perfis de pacientes (idade, sexo, cenário)
- Retorne APENAS o JSON, sem texto adicional`;

          if (prevStatements.length > 0) {
            prompt += `\n\n=== NÃO REPITA ===\n${prevStatements.slice(0, 60).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n=== FIM ===`;
          }
          return prompt;
        };

        // ── Helper: strict post-generation filter ──
        const strictFilter = (questions: any[], level: DifficultyLevel): any[] => {
          return questions.filter((q: any) => {
            const stmt = String(q.statement || "");
            // Reject short
            if (stmt.length < 350) { console.warn(`[Filter] Rejeitada: curta (${stmt.length} chars)`); return false; }
            // Reject English
            if (ENGLISH_PATTERN.test(stmt)) { console.warn(`[Filter] Rejeitada: inglês detectado`); return false; }
            // Reject image refs
            if (IMAGE_REF_PATTERN.test(stmt)) { console.warn(`[Filter] Rejeitada: ref imagem`); return false; }
            // Reject invalid structure
            if (!Array.isArray(q.options) || q.options.length < 4) { console.warn(`[Filter] Rejeitada: opções inválidas`); return false; }
            // Check options for English too
            const optText = q.options.join(" ");
            if (ENGLISH_PATTERN.test(optText)) { console.warn(`[Filter] Rejeitada: opções em inglês`); return false; }
            return true;
          }).map((q: any) => ({
            ...q,
            statement: sanitizeStatement(q.statement || ""),
            options: Array.isArray(q.options) ? q.options.map((o: string) => cleanQuestionText(o)) : q.options,
            explanation: q.explanation ? cleanQuestionText(q.explanation) : q.explanation,
            block: q.block || baseTopics[0] || topics[0],
            difficulty_level: level, // Force the slot's level
          }));
        };

        // ── Cache lookup (shared across slots) ──
        const topicFilters = baseTopics.map((t: string) => `topic.ilike.%${t}%`).join(",");
        let allCached: any[] = [];

        if (hasSubtopicFilter) {
          const subFilters = subtopicTerms.map((s: string) => `topic.ilike.%${s}%`).join(",");
          const [{ data: subBank }, { data: subReal }] = await Promise.all([
            sb.from("questions_bank").select("statement, options, correct_index, explanation, topic, difficulty").or(subFilters).eq("is_global", true).eq("review_status", "approved").limit(requestedCount * 2),
            sb.from("real_exam_questions").select("statement, options, correct_index, explanation, topic, difficulty").or(subFilters).eq("is_active", true).limit(requestedCount * 2),
          ]);
          allCached = [...(subBank || []), ...(subReal || [])];
        }

        if (allCached.length < requestedCount) {
          const [{ data: cachedBank }, { data: cachedReal }] = await Promise.all([
            sb.from("questions_bank").select("statement, options, correct_index, explanation, topic, difficulty").or(topicFilters).eq("is_global", true).eq("review_status", "approved").limit(requestedCount * 2),
            sb.from("real_exam_questions").select("statement, options, correct_index, explanation, topic, difficulty").or(topicFilters).eq("is_active", true).limit(requestedCount * 2),
          ]);
          const existingKeys = new Set(allCached.map((q: any) => String(q.statement || "").slice(0, 80).toLowerCase()));
          const broadResults = [...(cachedBank || []), ...(cachedReal || [])].filter((q: any) => !existingKeys.has(String(q.statement || "").slice(0, 80).toLowerCase()));
          allCached = [...allCached, ...broadResults];
        }

        // Filter cache: remove English + image refs
        const allPrevStatements = Array.isArray(previousStatements) ? [...previousStatements] : [];
        if (allPrevStatements.length > 0) {
          const prevKeys = new Set(allPrevStatements.map((s: string) => String(s).slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
          allCached = allCached.filter((q: any) => !prevKeys.has(String(q.statement || "").slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
        }
        allCached = allCached.filter((q: any) => {
          const stmt = String(q.statement || "");
          return !IMAGE_REF_PATTERN.test(stmt) && !ENGLISH_PATTERN.test(stmt);
        });

        // ── Partition cache by difficulty ──
        const cacheByLevel: Record<DifficultyLevel, any[]> = { facil: [], intermediario: [], dificil: [] };
        for (const q of allCached) {
          cacheByLevel[inferDifficultyLevel(q, difficulty)].push(q);
        }

        // ── SLOT-BASED GENERATION ──
        let allQuestions: any[] = [];
        const globalPrev = [...allPrevStatements];
        let source: "ai" | "bank" | "mixed" | "cache" = "cache";
        const slotMetrics: any[] = [];

        for (const slot of slots) {
          const { level, target } = slot;
          console.log(`\n[Slot ${level}] Target: ${target} questions`);

          // 1. Try cache first for this slot
          const cachedForSlot = shuffleArray(cacheByLevel[level]);
          const fromCache = cachedForSlot.slice(0, target).map((q: any) => ({
            statement: sanitizeStatement(q.statement || ""),
            options: Array.isArray(q.options) ? q.options.map((o: string) => cleanQuestionText(o)) : [],
            correct_index: q.correct_index ?? 0,
            explanation: cleanQuestionText(q.explanation || ""),
            topic: q.topic || topics[0],
            block: baseTopics.find((t: string) => String(q.topic || "").toLowerCase().includes(t.toLowerCase())) || baseTopics[0] || topics[0],
            difficulty_level: level,
          }));

          let slotQuestions = [...fromCache];
          let remaining = target - slotQuestions.length;
          console.log(`[Slot ${level}] Cache: ${fromCache.length}, AI needed: ${remaining}`);

          // 2. AI generation for remaining
          if (remaining > 0) {
            source = source === "cache" ? "ai" : "mixed";
            const MAX_ATTEMPTS = Math.ceil(remaining * 2.0 / SAFE_BATCH) + 2;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && slotQuestions.length < target; attempt++) {
              const stillNeeded = Math.min(SAFE_BATCH, target - slotQuestions.length);
              if (stillNeeded <= 0) break;

              try {
                const prompt = buildSlotPrompt(stillNeeded, level, globalPrev);
                const response = await aiFetch({
                  messages: [{ role: "user", content: prompt }],
                  model: "google/gemini-2.5-flash",
                  maxTokens: 32768,
                  timeoutMs: 120000,
                });

                if (!response.ok) {
                  const t = await response.text();
                  console.error(`[Slot ${level}] AI batch ${attempt + 1} error:`, t.slice(0, 200));
                  continue;
                }

                const aiData = await response.json();
                const content = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (!jsonMatch) { console.warn(`[Slot ${level}] batch ${attempt + 1}: no JSON`); continue; }

                let rawJson = jsonMatch[0].replace(/,\s*([\]}])/g, "$1");
                let parsed: any[] = [];
                try { parsed = JSON.parse(rawJson); } catch {
                  const lb = rawJson.lastIndexOf("}");
                  if (lb > 0) try { parsed = JSON.parse(rawJson.slice(0, lb + 1) + "]"); } catch { continue; }
                  else continue;
                }

                // Strict filter: language, length, structure
                const valid = strictFilter(parsed, level);

                // Dedup
                const prevKeys = new Set(globalPrev.map((s: string) => String(s).slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
                const deduped = valid.filter((q: any) => {
                  const key = String(q.statement || "").slice(0, 100).toLowerCase().replace(/\s+/g, " ");
                  return !prevKeys.has(key);
                });

                for (const q of deduped) {
                  if (slotQuestions.length >= target) break;
                  globalPrev.push(String(q.statement || "").slice(0, 120));
                  slotQuestions.push(q);
                }

                console.log(`[Slot ${level}] batch ${attempt + 1}: +${deduped.length} valid, total: ${slotQuestions.length}/${target}`);
              } catch (err) {
                console.error(`[Slot ${level}] batch ${attempt + 1} exception:`, err);
              }
            }
          }

          // Track from cache too
          for (const q of fromCache) {
            globalPrev.push(String(q.statement || "").slice(0, 120));
          }

          slotMetrics.push({
            level,
            requested: target,
            delivered: slotQuestions.length,
            fromCache: fromCache.length,
            fromAI: slotQuestions.length - fromCache.length,
          });

          allQuestions = [...allQuestions, ...slotQuestions.slice(0, target)];
        }

        // ── Fix consecutive repeated correct_index ──
        for (let i = 1; i < allQuestions.length; i++) {
          const prev = allQuestions[i - 1];
          const curr = allQuestions[i];
          if (curr.correct_index === prev.correct_index && Array.isArray(curr.options) && curr.options.length === 5) {
            const avoid = new Set([prev.correct_index]);
            if (i >= 2) avoid.add(allQuestions[i - 2].correct_index);
            const candidates = [0, 1, 2, 3, 4].filter(x => !avoid.has(x));
            const newIdx = candidates[Math.floor(Math.random() * candidates.length)];
            const oldIdx = curr.correct_index;
            const temp = curr.options[newIdx];
            curr.options[newIdx] = curr.options[oldIdx];
            curr.options[oldIdx] = temp;
            curr.correct_index = newIdx;
          }
        }

        // ── Final truncation ──
        if (allQuestions.length > requestedCount) {
          allQuestions = allQuestions.slice(0, requestedCount);
        }

        // ── Log quality metrics ──
        const finalDistribution: Record<string, number> = {};
        for (const q of allQuestions) {
          const lvl = q.difficulty_level || "unknown";
          finalDistribution[lvl] = (finalDistribution[lvl] || 0) + 1;
        }
        console.log(`\n[RESULTADO FINAL]`);
        console.log(`Solicitado: ${requestedCount} | Entregue: ${allQuestions.length}`);
        console.log(`Distribuição: ${JSON.stringify(finalDistribution)}`);
        console.log(`Slots: ${JSON.stringify(slotMetrics)}`);

        const generatedCount = allQuestions.length;
        const missingCount = requestedCount - generatedCount;

        return ok({
          questions: allQuestions,
          source,
          requested_count: requestedCount,
          generated_count: generatedCount,
          missing_count: missingCount,
          exact_count: missingCount === 0,
          difficulty_distribution: finalDistribution,
          slot_metrics: slotMetrics,
        });
      }

      case "create_simulado": {
        const { title, description, topics, faculdade_filter, periodo_filter, total_questions, time_limit_minutes, questions_json, student_ids, scheduled_at, auto_assign } = params;

        // Determine status based on scheduling
        const isScheduled = scheduled_at && new Date(scheduled_at) > new Date();
        const simStatus = isScheduled ? "scheduled" : "published";

        const { data: simulado, error } = await sb.from("teacher_simulados").insert({
          professor_id: user.id,
          title: title || "Simulado",
          description,
          topics: topics || [],
          faculdade_filter: faculdade_filter || professorFaculdade || null,
          periodo_filter: periodo_filter || null,
          total_questions: total_questions || questions_json?.length || 10,
          time_limit_minutes: time_limit_minutes || 60,
          questions_json: questions_json || [],
          status: simStatus,
          scheduled_at: scheduled_at || null,
          auto_assign: auto_assign !== false,
        }).select("id").single();

        if (error) throw new Error(error.message);

        // Use explicit student_ids if provided, otherwise fall back to filter query
        let studentList: { user_id: string }[] = [];
        if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
          studentList = student_ids.map((id: string) => ({ user_id: id }));
        } else {
          let studentQuery = sb.from("profiles").select("user_id").eq("status", "active");
          if (faculdade_filter) studentQuery = studentQuery.eq("faculdade", faculdade_filter);
          if (periodo_filter) studentQuery = studentQuery.eq("periodo", periodo_filter);
          const { data: students } = await studentQuery;
          studentList = students || [];
        }

        if (studentList.length > 0) {
          const results = studentList.map((s: any) => ({
            simulado_id: simulado.id,
            student_id: s.user_id,
            total_questions: questions_json?.length || total_questions,
            status: "pending",
          }));
          await sb.from("teacher_simulado_results").insert(results);

          // Notify each student (in-app) — dedup by title tag
          const simTitleTag = `Simulado do Prof. ${professorName}: ${title || "Simulado"}`;
          const allStudentIds = studentList.map((s: any) => s.user_id);
          const alreadyInApp = await alreadyNotifiedInApp(simTitleTag, allStudentIds);
          const newInApp = studentList.filter((s: any) => !alreadyInApp.includes(s.user_id));
          if (newInApp.length > 0) {
            // Fetch student names for personalized in-app messages
            const { data: inAppProfiles } = await sb.from("profiles")
              .select("user_id, display_name")
              .in("user_id", newInApp.map((s: any) => s.user_id));
            const nameMap: Record<string, string> = {};
            (inAppProfiles || []).forEach((p: any) => { nameMap[p.user_id] = (p.display_name || "").split(" ")[0] || "aluno(a)"; });

            const scheduledStr = scheduled_at ? `\n⏰ Agendado: ${new Date(scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "";
            const notifications = newInApp.map((s: any) => ({
              sender_id: user.id,
              recipient_id: s.user_id,
              title: `📋 Novo ${simTitleTag}`,
              content: `📋 Olá ${nameMap[s.user_id] || "aluno(a)"}! O Prof. ${professorName} disponibilizou o simulado "${title || "Simulado"}" com ${questions_json?.length || total_questions} questões (${time_limit_minutes || 60}min).${scheduledStr}\n👉 Acesse Mais Ferramentas → Proficiência para realizar!\n🔗 https://enazizi.com`,
              priority: "important",
            }));
            await sb.from("admin_messages").insert(notifications);
          }

          // WhatsApp notification for students with phone — dedup
          try {
            const { data: phoneProfiles } = await sb
              .from("profiles")
              .select("user_id, display_name, phone, whatsapp_opt_out")
              .in("user_id", allStudentIds)
              .eq("whatsapp_opt_out", false)
              .not("phone", "is", null);

            const eligibleStudents = (phoneProfiles || []).filter((p: any) => p.phone && p.phone.length >= 10);
            const alreadyWA = await alreadyNotifiedWhatsApp(simTitleTag, eligibleStudents.map((p: any) => p.user_id));
            const newWA = eligibleStudents.filter((p: any) => !alreadyWA.includes(p.user_id));

            if (newWA.length > 0) {
              const whatsappMessages = newWA.map((p: any) => ({
                admin_user_id: user.id,
                target_user_id: p.user_id,
                message_text: `📋 *Novo Simulado — Prof. ${professorName}*\n\nOlá ${(p.display_name || "").split(" ")[0] || "aluno(a)"}! O Prof. ${professorName} disponibilizou o simulado "${title || "Simulado"}" com ${questions_json?.length || total_questions} questões (${time_limit_minutes || 60}min).${scheduled_at ? `\n⏰ Agendado: ${new Date(scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}\n\n👉 Acesse *Mais Ferramentas* → *Proficiência* para realizar!\n🔗 https://enazizi.com\n\nResponda SAIR para não receber mais.`,
                delivery_status: "pending",
                execution_mode: "auto",
              }));
              await sb.from("whatsapp_message_log").insert(whatsappMessages);

              const { data: exec } = await sb.from("whatsapp_send_executions").insert({
                admin_user_id: user.id,
                execution_date: today,
                mode: "auto",
                status: "running",
                total_items: newWA.length,
                total_sent: 0,
                total_error: 0,
                total_skipped: 0,
                started_at: new Date().toISOString(),
              }).select("id").single();

              if (exec) {
                await sb.from("whatsapp_message_log")
                  .update({ execution_id: exec.id })
                  .eq("delivery_status", "pending")
                  .is("execution_id", null)
                  .in("target_user_id", newWA.map((p: any) => p.user_id));
              }
              console.log(`WhatsApp: ${newWA.length} mensagens enfileiradas para simulado ${simulado.id}`);
            }
          } catch (whatsappErr) {
            console.error("Erro ao enfileirar WhatsApp (não bloqueante):", whatsappErr);
          }
        }

        return ok({ success: true, simulado_id: simulado.id, students_assigned: studentList.length, status: simStatus });
      }

      case "list_simulados": {
        // Check if user is admin
        const isAdmin = roleData.some((r: any) => r.role === "admin");
        
        let simuladosQuery = sb
          .from("teacher_simulados")
          .select("*");
        
        // Admins see all, professors see only their own
        if (!isAdmin) {
          simuladosQuery = simuladosQuery.eq("professor_id", user.id);
        }
        
        const { data: simulados } = await simuladosQuery.order("created_at", { ascending: false });

        // Get result counts
        const simIds = (simulados || []).map((s: any) => s.id);
        let resultsBySimulado: Record<string, { total: number; completed: number; avgScore: number }> = {};

        if (simIds.length > 0) {
          const { data: results } = await sb
            .from("teacher_simulado_results")
            .select("simulado_id, status, score")
            .in("simulado_id", simIds);

          for (const r of (results || [])) {
            if (!resultsBySimulado[r.simulado_id]) {
              resultsBySimulado[r.simulado_id] = { total: 0, completed: 0, avgScore: 0 };
            }
            resultsBySimulado[r.simulado_id].total++;
            if (r.status === "completed") {
              resultsBySimulado[r.simulado_id].completed++;
              resultsBySimulado[r.simulado_id].avgScore += (r.score || 0);
            }
          }

          // Calculate averages
          for (const key of Object.keys(resultsBySimulado)) {
            const d = resultsBySimulado[key];
            if (d.completed > 0) d.avgScore = Math.round(d.avgScore / d.completed);
          }
        }

        return ok({ simulados: (simulados || []).map((s: any) => ({ ...s, results_summary: resultsBySimulado[s.id] || { total: 0, completed: 0, avgScore: 0 } })) });
      }

      case "delete_simulado": {
        const { simulado_id } = params;
        if (!simulado_id) throw new Error("simulado_id obrigatório");

        const isAdminDel = roleData.some((r: any) => r.role === "admin");

        // Verify ownership (unless admin)
        if (!isAdminDel) {
          const { data: sim } = await sb.from("teacher_simulados").select("professor_id").eq("id", simulado_id).single();
          if (!sim || sim.professor_id !== user.id) {
            throw new Error("Você só pode apagar simulados criados por você.");
          }
        }

        // Delete results first (cascade)
        await sb.from("teacher_simulado_results").delete().eq("simulado_id", simulado_id);
        
        // Delete the simulado
        const { error: delError } = await sb.from("teacher_simulados").delete().eq("id", simulado_id);
        if (delError) throw new Error(delError.message);

        return ok({ success: true });
      }

      case "get_simulado_results": {
        const { simulado_id } = params;
        if (!simulado_id) throw new Error("simulado_id obrigatório");

        const { data: results } = await sb
          .from("teacher_simulado_results")
          .select("*")
          .eq("simulado_id", simulado_id)
          .order("score", { ascending: false });

        // Fetch questions_json from the simulado
        const { data: simData } = await sb
          .from("teacher_simulados")
          .select("questions_json")
          .eq("id", simulado_id)
          .single();

        // Enrich with student names
        const studentIds = (results || []).map((r: any) => r.student_id);
        const { data: profiles } = await sb.from("profiles").select("user_id, display_name, email, faculdade, periodo").in("user_id", studentIds);

        const enriched = (results || []).map((r: any) => {
          const p = (profiles || []).find((p: any) => p.user_id === r.student_id);
          return { ...r, student_name: p?.display_name || "Sem nome", student_email: p?.email || "", faculdade: p?.faculdade, periodo: p?.periodo };
        });

        return ok({ results: enriched, questions_json: simData?.questions_json || [] });
      }

      case "get_students": {
        const { faculdade, periodo } = params;
        const effectiveFaculdade = faculdade || professorFaculdade;
        let query = sb.from("profiles").select("user_id, display_name, email, faculdade, periodo, status").eq("status", "active");
        if (effectiveFaculdade) query = query.eq("faculdade", effectiveFaculdade);
        if (periodo) query = query.eq("periodo", periodo);

        const { data: students } = await query.order("display_name");
        return ok({ students: students || [] });
      }

      case "search_students": {
        const { query } = params;
        if (!query || query.length < 3) throw new Error("Digite pelo menos 3 caracteres para buscar");
        const searchTerm = `%${query}%`;
        const { data: found } = await sb.from("profiles")
          .select("user_id, display_name, email, faculdade, periodo")
          .eq("status", "active")
          .in("user_type", ["estudante", "medico"])
          .or(`display_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .order("display_name")
          .limit(20);
        return ok({ students: found || [] });
      }

      case "class_analytics": {
        const { faculdade, periodo } = params;
        const effectiveFaculdade = faculdade || professorFaculdade;

        // Get students matching filters
        let sQuery = sb.from("profiles").select("user_id, display_name, email, faculdade, periodo").eq("status", "active");
        if (effectiveFaculdade) sQuery = sQuery.eq("faculdade", effectiveFaculdade);
        if (periodo) sQuery = sQuery.eq("periodo", periodo);
        const { data: students } = await sQuery.order("display_name");
        if (!students || students.length === 0) return ok({ students: [], weakTopics: [], topPerformers: [], engagement: { avg_streak: 0, avg_xp: 0, inactive_count: 0, activity_completion_rate: 0 } });

        const studentIds = students.map((s: any) => s.user_id);

        // Get domain scores
        const { data: domains } = await sb.from("medical_domain_map")
          .select("user_id, specialty, domain_score, questions_answered, correct_answers, errors_count")
          .in("user_id", studentIds);

        // Get error bank
        const { data: errors } = await sb.from("error_bank")
          .select("user_id, tema, vezes_errado")
          .in("user_id", studentIds);

        // Get study performance
        const { data: perfData } = await sb.from("study_performance")
          .select("user_id, questoes_respondidas, taxa_acerto")
          .in("user_id", studentIds);

        // Get gamification data (engagement)
        const { data: gamData } = await sb.from("user_gamification")
          .select("user_id, xp, level, current_streak, last_activity_date")
          .in("user_id", studentIds);

        // Get teacher simulado results
        const { data: simResults } = await sb.from("teacher_simulado_results")
          .select("student_id, status, score")
          .in("student_id", studentIds);

        // Get teacher clinical case results
        const { data: caseResults } = await sb.from("teacher_clinical_case_results")
          .select("student_id, status, final_score")
          .in("student_id", studentIds);

        // Get study assignment results
        const { data: assignResults } = await sb.from("teacher_study_assignment_results")
          .select("student_id, status")
          .in("student_id", studentIds);

        const now = new Date();

        // Build per-student stats
        const studentStats = students.map((s: any) => {
          const sDomains = (domains || []).filter((d: any) => d.user_id === s.user_id);
          const sErrors = (errors || []).filter((e: any) => e.user_id === s.user_id);
          const sPerf = (perfData || []).find((p: any) => p.user_id === s.user_id);
          const sGam = (gamData || []).find((g: any) => g.user_id === s.user_id);
          const sSims = (simResults || []).filter((r: any) => r.student_id === s.user_id);
          const sCases = (caseResults || []).filter((r: any) => r.student_id === s.user_id);
          const sAssigns = (assignResults || []).filter((r: any) => r.student_id === s.user_id);

          const avgScore = sDomains.length > 0
            ? Math.round(sDomains.reduce((sum: number, d: any) => sum + d.domain_score, 0) / sDomains.length)
            : 0;
          const totalErrors = sErrors.reduce((sum: number, e: any) => sum + e.vezes_errado, 0);

          // Activity completion
          const totalActivities = sSims.length + sCases.length + sAssigns.length;
          const completedActivities = sSims.filter((r: any) => r.status === "completed").length
            + sCases.filter((r: any) => r.status === "completed").length
            + sAssigns.filter((r: any) => r.status === "completed").length;

          // Days since last activity
          const lastActivity = sGam?.last_activity_date ? new Date(sGam.last_activity_date) : null;
          const daysSinceActivity = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / 86400000) : 999;

          return {
            user_id: s.user_id,
            display_name: s.display_name || s.email,
            faculdade: s.faculdade,
            periodo: s.periodo,
            avg_domain_score: avgScore,
            questions_answered: sPerf?.questoes_respondidas || 0,
            accuracy: sPerf?.taxa_acerto ? Math.round(sPerf.taxa_acerto * 100) : 0,
            total_errors: totalErrors,
            specialties_studied: sDomains.length,
            xp: sGam?.xp || 0,
            level: sGam?.level || 1,
            streak: sGam?.current_streak || 0,
            days_inactive: daysSinceActivity,
            activities_total: totalActivities,
            activities_completed: completedActivities,
            simulados_completed: sSims.filter((r: any) => r.status === "completed").length,
            simulados_avg_score: sSims.filter((r: any) => r.status === "completed").length > 0
              ? Math.round(sSims.filter((r: any) => r.status === "completed").reduce((s: number, r: any) => s + (r.score || 0), 0) / sSims.filter((r: any) => r.status === "completed").length)
              : 0,
          };
        });

        // Weak topics
        const topicErrorMap: Record<string, number> = {};
        (errors || []).forEach((e: any) => { topicErrorMap[e.tema] = (topicErrorMap[e.tema] || 0) + e.vezes_errado; });
        const weakTopics = Object.entries(topicErrorMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => ({ topic, error_count: count }));

        // Top performers
        const topPerformers = [...studentStats].sort((a, b) => b.avg_domain_score - a.avg_domain_score).slice(0, 5);

        // At-risk students
        const atRiskStudents = studentStats.filter(s => s.avg_domain_score < 50 || s.days_inactive > 7).map(s => ({
          ...s,
          risk_reason: s.days_inactive > 7 ? `Inativo há ${s.days_inactive} dias` : `Score baixo: ${s.avg_domain_score}%`,
          risk_level: (s.days_inactive > 7 && s.avg_domain_score < 30) ? "critical" : "warning",
        }));

        // Engagement aggregates
        const avgStreak = studentStats.length > 0 ? Math.round(studentStats.reduce((s, st) => s + st.streak, 0) / studentStats.length) : 0;
        const avgXp = studentStats.length > 0 ? Math.round(studentStats.reduce((s, st) => s + st.xp, 0) / studentStats.length) : 0;
        const inactiveCount = studentStats.filter(s => s.days_inactive > 7).length;
        const totalActs = studentStats.reduce((s, st) => s + st.activities_total, 0);
        const completedActs = studentStats.reduce((s, st) => s + st.activities_completed, 0);
        const activityCompletionRate = totalActs > 0 ? Math.round((completedActs / totalActs) * 100) : 0;

        // Specialty breakdown
        const specialtyMap: Record<string, { total_score: number; count: number }> = {};
        (domains || []).forEach((d: any) => {
          if (!specialtyMap[d.specialty]) specialtyMap[d.specialty] = { total_score: 0, count: 0 };
          specialtyMap[d.specialty].total_score += d.domain_score;
          specialtyMap[d.specialty].count++;
        });
        const specialtyBreakdown = Object.entries(specialtyMap)
          .map(([specialty, v]) => ({ specialty, avg_score: Math.round(v.total_score / v.count), student_count: v.count }))
          .sort((a, b) => b.student_count - a.student_count)
          .slice(0, 15);

        return ok({
          students: studentStats,
          weakTopics,
          topPerformers,
          atRiskStudents,
          engagement: { avg_streak: avgStreak, avg_xp: avgXp, inactive_count: inactiveCount, activity_completion_rate: activityCompletionRate },
          specialtyBreakdown,
        });
      }

      case "student_detail": {
        const { student_id, class_avg_score } = params;
        if (!student_id) throw new Error("student_id obrigatório");

        // Profile
        const { data: profile } = await sb.from("profiles")
          .select("user_id, display_name, email, faculdade, periodo")
          .eq("user_id", student_id).single();
        if (!profile) throw new Error("Aluno não encontrado");

        // Domain scores
        const { data: domains } = await sb.from("medical_domain_map")
          .select("specialty, domain_score, questions_answered, correct_answers, errors_count")
          .eq("user_id", student_id);

        // Error bank
        const { data: errors } = await sb.from("error_bank")
          .select("tema, vezes_errado, categoria_erro")
          .eq("user_id", student_id)
          .order("vezes_errado", { ascending: false })
          .limit(15);

        // Study performance
        const { data: perf } = await sb.from("study_performance")
          .select("questoes_respondidas, taxa_acerto")
          .eq("user_id", student_id).maybeSingle();

        // Gamification
        const { data: gam } = await sb.from("user_gamification")
          .select("xp, level, current_streak, last_activity_date")
          .eq("user_id", student_id).maybeSingle();

        // Simulado results
        const { data: simResults } = await sb.from("teacher_simulado_results")
          .select("simulado_id, score, status, finished_at")
          .eq("student_id", student_id)
          .order("created_at", { ascending: false })
          .limit(20);

        // Enrich with simulado titles
        const simIds = (simResults || []).map((r: any) => r.simulado_id);
        let simTitles: Record<string, string> = {};
        if (simIds.length > 0) {
          const { data: sims } = await sb.from("teacher_simulados").select("id, title").in("id", simIds);
          for (const s of (sims || [])) simTitles[s.id] = s.title;
        }

        // Clinical case results
        const { data: caseResults } = await sb.from("teacher_clinical_case_results")
          .select("case_id, status, final_score, finished_at")
          .eq("student_id", student_id)
          .order("created_at", { ascending: false })
          .limit(20);

        let caseTitles: Record<string, string> = {};
        const caseIds = (caseResults || []).map((r: any) => r.case_id);
        if (caseIds.length > 0) {
          const { data: cases } = await sb.from("teacher_clinical_cases").select("id, title").in("id", caseIds);
          for (const c of (cases || [])) caseTitles[c.id] = c.title;
        }

        // Study assignment results
        const { data: assignResults } = await sb.from("teacher_study_assignment_results")
          .select("assignment_id, status, completed_at")
          .eq("student_id", student_id)
          .order("created_at", { ascending: false })
          .limit(20);

        let assignTitles: Record<string, string> = {};
        const assignIds = (assignResults || []).map((r: any) => r.assignment_id);
        if (assignIds.length > 0) {
          const { data: assigns } = await sb.from("teacher_study_assignments").select("id, title").in("id", assignIds);
          for (const a of (assigns || [])) assignTitles[a.id] = a.title;
        }

        // Weekly evolution: last 8 weeks of practice_attempts
        const eightWeeksAgo = new Date();
        eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
        const { data: attempts } = await sb.from("practice_attempts")
          .select("correct, created_at")
          .eq("user_id", student_id)
          .gte("created_at", eightWeeksAgo.toISOString())
          .order("created_at");

        // Group by week
        const weeklyMap: Record<string, { correct: number; total: number }> = {};
        (attempts || []).forEach((a: any) => {
          const d = new Date(a.created_at);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().slice(0, 10);
          if (!weeklyMap[key]) weeklyMap[key] = { correct: 0, total: 0 };
          weeklyMap[key].total++;
          if (a.correct) weeklyMap[key].correct++;
        });
        const weeklyEvolution = Object.entries(weeklyMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([week, v]) => ({ week, accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0, total: v.total }));

        // Quotas
        const { data: quotas } = await sb.from("user_quotas")
          .select("questions_used, questions_limit")
          .eq("user_id", student_id).maybeSingle();

        // Calculate avg domain score for comparison
        const avgDomainScore = (domains || []).length > 0
          ? Math.round((domains || []).reduce((s: number, d: any) => s + d.domain_score, 0) / (domains || []).length)
          : 0;

        return ok({
          profile,
          domain_scores: domains || [],
          error_topics: errors || [],
          study_performance: perf ? { questoes_respondidas: perf.questoes_respondidas, taxa_acerto: Math.round((perf.taxa_acerto || 0) * 100) } : null,
          gamification: gam || null,
          simulado_results: (simResults || []).map((r: any) => ({
            title: simTitles[r.simulado_id] || "Simulado",
            score: r.score != null ? Math.round(r.score) : null,
            status: r.status,
            finished_at: r.finished_at,
          })),
          clinical_case_results: (caseResults || []).map((r: any) => ({
            title: caseTitles[r.case_id] || "Caso Clínico",
            score: r.final_score != null ? Math.round(r.final_score) : null,
            status: r.status,
            finished_at: r.finished_at,
          })),
          study_assignments: (assignResults || []).map((r: any) => ({
            title: assignTitles[r.assignment_id] || "Tema de Estudo",
            status: r.status,
            completed_at: r.completed_at,
          })),
          weekly_evolution: weeklyEvolution,
          avg_domain_score: avgDomainScore,
          class_avg_score: class_avg_score || null,
          quotas: quotas || null,
        });
      }

      // ========== CLINICAL CASES (Plantão) ==========

      case "generate_clinical_case": {
        const { specialty = "Clínica Médica", difficulty = "intermediário" } = params;

        const CLINICAL_PROMPT = `Você é o simulador de PLANTÃO MÉDICO. Gere um caso clínico de pronto-socorro/plantão com:
- Queixa principal do paciente (em 1ª pessoa, como paciente falaria)
- Sinais vitais básicos
- Cenário do atendimento (PS, enfermaria, UTI)
- NÃO revele o diagnóstico ao aluno

Especialidade: ${specialty}
Dificuldade: ${difficulty}

Responda APENAS em JSON válido:
{
  "patient_presentation": "texto da apresentação do paciente em 1ª pessoa",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "setting": "Pronto-Socorro / UTI / Enfermaria",
  "triage_color": "vermelho/amarelo/verde",
  "hidden_diagnosis": "diagnóstico correto (NÃO mostrar ao aluno)",
  "hidden_key_findings": ["achado1", "achado2", "achado3"],
  "difficulty_score": 1-5
}

REGRAS:
- Seja realista e variado
- Inclua doenças tropicais, emergências, apresentações atípicas
- Use diretrizes médicas atualizadas (2024-2026)
- Variar faixa etária, sexo, comorbidades, cenário`;

        const response = await aiFetch({
          messages: [{ role: "user", content: CLINICAL_PROMPT }],
          model: "google/gemini-2.5-flash",
        });

        if (!response.ok) {
          const t = await response.text();
          console.error("AI error:", t);
          throw new Error("Erro ao gerar caso clínico");
        }

        const aiData = await response.json();
        const content = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
        const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const caseData = JSON.parse(jsonStr);

        return ok({ case_data: caseData, specialty, difficulty });
      }

      case "create_clinical_case": {
        const { title, specialty, difficulty, time_limit_minutes, case_prompt, faculdade_filter, periodo_filter, student_ids } = params;

        if (!case_prompt || !specialty) throw new Error("Dados do caso são obrigatórios");

        const { data: clinicalCase, error } = await sb.from("teacher_clinical_cases").insert({
          professor_id: user.id,
          title: title || `Plantão - ${specialty}`,
          specialty,
          difficulty: difficulty || "intermediário",
          time_limit_minutes: time_limit_minutes || 20,
          case_prompt,
          faculdade_filter: faculdade_filter || null,
          periodo_filter: periodo_filter || null,
          status: "published",
        }).select("id").single();

        if (error) throw new Error(error.message);

        // Find students and create pending results
        let studentIds: string[] = student_ids || [];

        if (studentIds.length === 0) {
          let studentQuery = sb.from("profiles").select("user_id").eq("status", "active");
          if (faculdade_filter) studentQuery = studentQuery.eq("faculdade", faculdade_filter);
          if (periodo_filter) studentQuery = studentQuery.eq("periodo", periodo_filter);
          const { data: students } = await studentQuery;
          studentIds = (students || []).map((s: any) => s.user_id);
        }

        if (studentIds.length > 0) {
          const results = studentIds.map((sid: string) => ({
            case_id: clinicalCase.id,
            student_id: sid,
            status: "pending",
          }));
          await sb.from("teacher_clinical_case_results").insert(results);

          // Notify each student (in-app) — dedup
          const caseTitleTag = `Caso Clínico do Prof. ${professorName}: ${title || "Plantão"}`;
          const alreadyCaseInApp = await alreadyNotifiedInApp(caseTitleTag, studentIds);
          const newCaseInApp = studentIds.filter((sid: string) => !alreadyCaseInApp.includes(sid));
          if (newCaseInApp.length > 0) {
            // Fetch student names for personalized in-app messages
            const { data: caseInAppProfiles } = await sb.from("profiles")
              .select("user_id, display_name")
              .in("user_id", newCaseInApp);
            const caseNameMap: Record<string, string> = {};
            (caseInAppProfiles || []).forEach((p: any) => { caseNameMap[p.user_id] = (p.display_name || "").split(" ")[0] || "aluno(a)"; });

            const notifications = newCaseInApp.map((sid: string) => ({
              sender_id: user.id,
              recipient_id: sid,
              title: `🏥 ${caseTitleTag}`,
              content: `🏥 Olá ${caseNameMap[sid] || "aluno(a)"}! O Prof. ${professorName} criou o caso clínico "${title || "Plantão"}" (${specialty}, dificuldade: ${difficulty || "intermediário"}).\n👉 Acesse Mais Ferramentas → Proficiência para realizar!\n🔗 https://enazizi.com`,
              priority: "important",
            }));
            await sb.from("admin_messages").insert(notifications);
          }

          // WhatsApp notification — dedup
          try {
            const { data: phoneProfiles } = await sb
              .from("profiles")
              .select("user_id, display_name, phone, whatsapp_opt_out")
              .in("user_id", studentIds)
              .eq("whatsapp_opt_out", false)
              .not("phone", "is", null);

            const eligibleStudents = (phoneProfiles || []).filter((p: any) => p.phone && p.phone.length >= 10);
            const alreadyCaseWA = await alreadyNotifiedWhatsApp(caseTitleTag, eligibleStudents.map((p: any) => p.user_id));
            const newCaseWA = eligibleStudents.filter((p: any) => !alreadyCaseWA.includes(p.user_id));

            if (newCaseWA.length > 0) {
              const whatsappMessages = newCaseWA.map((p: any) => ({
                admin_user_id: user.id,
                target_user_id: p.user_id,
                message_text: `🏥 *Novo ${caseTitleTag}*\n\nOlá ${(p.display_name || "").split(" ")[0] || "aluno(a)"}! O Prof. ${professorName} criou o caso clínico "${title || "Plantão"}" (${specialty}, dificuldade: ${difficulty || "intermediário"}).\n\n👉 Acesse *Mais Ferramentas* → *Proficiência* para realizar!\n🔗 https://enazizi.com\n\nResponda SAIR para não receber mais.`,
                delivery_status: "pending",
                execution_mode: "auto",
              }));
              await sb.from("whatsapp_message_log").insert(whatsappMessages);

              const { data: exec } = await sb.from("whatsapp_send_executions").insert({
                admin_user_id: user.id,
                execution_date: today,
                mode: "auto",
                status: "running",
                total_items: newCaseWA.length,
                total_sent: 0,
                total_error: 0,
                total_skipped: 0,
                started_at: new Date().toISOString(),
              }).select("id").single();

              if (exec) {
                await sb.from("whatsapp_message_log")
                  .update({ execution_id: exec.id })
                  .eq("delivery_status", "pending")
                  .is("execution_id", null)
                  .in("target_user_id", newCaseWA.map((p: any) => p.user_id));
              }
              console.log(`WhatsApp: ${newCaseWA.length} mensagens enfileiradas para caso clínico ${clinicalCase.id}`);
            }
          } catch (whatsappErr) {
            console.error("Erro ao enfileirar WhatsApp caso clínico (não bloqueante):", whatsappErr);
          }
        }

        return ok({ success: true, case_id: clinicalCase.id, students_assigned: studentIds.length });
      }

      case "list_clinical_cases": {
        const isAdminCases = roleData.some((r: any) => r.role === "admin");
        let casesQuery = sb.from("teacher_clinical_cases").select("*");
        if (!isAdminCases) {
          casesQuery = casesQuery.eq("professor_id", user.id);
        }
        const { data: cases } = await casesQuery.order("created_at", { ascending: false });

        const caseIds = (cases || []).map((c: any) => c.id);
        let resultsByCaseId: Record<string, { total: number; completed: number; avgScore: number }> = {};

        if (caseIds.length > 0) {
          const { data: results } = await sb
            .from("teacher_clinical_case_results")
            .select("case_id, status, final_score")
            .in("case_id", caseIds);

          for (const r of (results || [])) {
            if (!resultsByCaseId[r.case_id]) resultsByCaseId[r.case_id] = { total: 0, completed: 0, avgScore: 0 };
            resultsByCaseId[r.case_id].total++;
            if (r.status === "completed") {
              resultsByCaseId[r.case_id].completed++;
              resultsByCaseId[r.case_id].avgScore += (r.final_score || 0);
            }
          }

          for (const key of Object.keys(resultsByCaseId)) {
            const d = resultsByCaseId[key];
            if (d.completed > 0) d.avgScore = Math.round(d.avgScore / d.completed);
          }
        }

        return ok({
          cases: (cases || []).map((c: any) => ({
            ...c,
            results_summary: resultsByCaseId[c.id] || { total: 0, completed: 0, avgScore: 0 },
          })),
        });
      }

      case "get_clinical_case_results": {
        const { case_id } = params;
        if (!case_id) throw new Error("case_id obrigatório");

        const { data: results } = await sb
          .from("teacher_clinical_case_results")
          .select("*")
          .eq("case_id", case_id)
          .order("final_score", { ascending: false });

        const studentIds = (results || []).map((r: any) => r.student_id);
        const { data: profiles } = await sb.from("profiles")
          .select("user_id, display_name, email, faculdade, periodo")
          .in("user_id", studentIds);

        const enriched = (results || []).map((r: any) => {
          const p = (profiles || []).find((p: any) => p.user_id === r.student_id);
          return {
            ...r,
            student_name: p?.display_name || "Sem nome",
            student_email: p?.email || "",
            faculdade: p?.faculdade,
            periodo: p?.periodo,
          };
        });

        return ok({ results: enriched });
      }

      // ========== STUDY ASSIGNMENTS ==========

      case "create_study_assignment": {
        const { title, specialty, topics_to_cover, material_url, material_filename, faculdade_filter, periodo_filter, student_ids } = params;

        if (!title || !specialty || !topics_to_cover) throw new Error("Título, especialidade e tópicos são obrigatórios");

        const { data: assignment, error } = await sb.from("teacher_study_assignments").insert({
          professor_id: user.id,
          title,
          specialty,
          topics_to_cover,
          material_url: material_url || null,
          material_filename: material_filename || null,
          faculdade_filter: faculdade_filter || null,
          periodo_filter: periodo_filter || null,
          status: "active",
        }).select("id").single();

        if (error) throw new Error(error.message);

        // Find students
        let studentIds: string[] = student_ids || [];
        if (studentIds.length === 0) {
          let studentQuery = sb.from("profiles").select("user_id").eq("status", "active");
          if (faculdade_filter) studentQuery = studentQuery.eq("faculdade", faculdade_filter);
          if (periodo_filter) studentQuery = studentQuery.eq("periodo", periodo_filter);
          const { data: students } = await studentQuery;
          studentIds = (students || []).map((s: any) => s.user_id);
        }

        if (studentIds.length > 0) {
          const results = studentIds.map((sid: string) => ({
            assignment_id: assignment.id,
            student_id: sid,
            status: "pending",
          }));
          await sb.from("teacher_study_assignment_results").insert(results);

          // Notify each student (in-app) — dedup
          const assignTitleTag = `Tema de Estudo do Prof. ${professorName}: ${title}`;
          const alreadyAssignInApp = await alreadyNotifiedInApp(assignTitleTag, studentIds);
          const newAssignInApp = studentIds.filter((sid: string) => !alreadyAssignInApp.includes(sid));
          if (newAssignInApp.length > 0) {
            // Fetch student names for personalized in-app messages
            const { data: assignInAppProfiles } = await sb.from("profiles")
              .select("user_id, display_name")
              .in("user_id", newAssignInApp);
            const assignNameMap: Record<string, string> = {};
            (assignInAppProfiles || []).forEach((p: any) => { assignNameMap[p.user_id] = (p.display_name || "").split(" ")[0] || "aluno(a)"; });

            const notifications = newAssignInApp.map((sid: string) => ({
              sender_id: user.id,
              recipient_id: sid,
              title: `📚 ${assignTitleTag}`,
              content: `📚 Olá ${assignNameMap[sid] || "aluno(a)"}! O Prof. ${professorName} atribuiu o tema "${title}" (${specialty}).\n📌 Tópicos: ${topics_to_cover || "vários"}\n👉 Acesse Mais Ferramentas → Proficiência para estudar!\n🔗 https://enazizi.com`,
              priority: "important",
            }));
            await sb.from("admin_messages").insert(notifications);
          }

          // WhatsApp notification — dedup
          try {
            const { data: phoneProfiles } = await sb
              .from("profiles")
              .select("user_id, display_name, phone, whatsapp_opt_out")
              .in("user_id", studentIds)
              .eq("whatsapp_opt_out", false)
              .not("phone", "is", null);

            const eligibleStudents = (phoneProfiles || []).filter((p: any) => p.phone && p.phone.length >= 10);
            const alreadyAssignWA = await alreadyNotifiedWhatsApp(assignTitleTag, eligibleStudents.map((p: any) => p.user_id));
            const newAssignWA = eligibleStudents.filter((p: any) => !alreadyAssignWA.includes(p.user_id));

            if (newAssignWA.length > 0) {
              const whatsappMessages = newAssignWA.map((p: any) => ({
                admin_user_id: user.id,
                target_user_id: p.user_id,
                message_text: `📚 *Novo ${assignTitleTag}*\n\nOlá ${(p.display_name || "").split(" ")[0] || "aluno(a)"}! O Prof. ${professorName} atribuiu o tema "${title}" (${specialty}).\n📌 Tópicos: ${topics_to_cover || "vários"}\n\n👉 Acesse *Mais Ferramentas* → *Proficiência* para estudar!\n🔗 https://enazizi.com\n\nResponda SAIR para não receber mais.`,
                delivery_status: "pending",
                execution_mode: "auto",
              }));
              await sb.from("whatsapp_message_log").insert(whatsappMessages);

              const { data: exec } = await sb.from("whatsapp_send_executions").insert({
                admin_user_id: user.id,
                execution_date: today,
                mode: "auto",
                status: "running",
                total_items: newAssignWA.length,
                total_sent: 0,
                total_error: 0,
                total_skipped: 0,
                started_at: new Date().toISOString(),
              }).select("id").single();

              if (exec) {
                await sb.from("whatsapp_message_log")
                  .update({ execution_id: exec.id })
                  .eq("delivery_status", "pending")
                  .is("execution_id", null)
                  .in("target_user_id", newAssignWA.map((p: any) => p.user_id));
              }
              console.log(`WhatsApp: ${newAssignWA.length} mensagens enfileiradas para tema ${assignment.id}`);
            }
          } catch (whatsappErr) {
            console.error("Erro ao enfileirar WhatsApp tema estudo (não bloqueante):", whatsappErr);
          }
        }

        return ok({ success: true, assignment_id: assignment.id, students_assigned: studentIds.length });
      }

      case "list_study_assignments": {
        const isAdminAssign = roleData.some((r: any) => r.role === "admin");
        let assignQuery = sb.from("teacher_study_assignments").select("*");
        if (!isAdminAssign) {
          assignQuery = assignQuery.eq("professor_id", user.id);
        }
        const { data: assignments } = await assignQuery.order("created_at", { ascending: false });

        const assignmentIds = (assignments || []).map((a: any) => a.id);
        let resultsByAssignment: Record<string, { total: number; completed: number; studying: number }> = {};

        if (assignmentIds.length > 0) {
          const { data: results } = await sb
            .from("teacher_study_assignment_results")
            .select("assignment_id, status")
            .in("assignment_id", assignmentIds);

          for (const r of (results || [])) {
            if (!resultsByAssignment[r.assignment_id]) resultsByAssignment[r.assignment_id] = { total: 0, completed: 0, studying: 0 };
            resultsByAssignment[r.assignment_id].total++;
            if (r.status === "completed") resultsByAssignment[r.assignment_id].completed++;
            if (r.status === "studying") resultsByAssignment[r.assignment_id].studying++;
          }
        }

        return ok({
          assignments: (assignments || []).map((a: any) => ({
            ...a,
            results_summary: resultsByAssignment[a.id] || { total: 0, completed: 0, studying: 0 },
          })),
        });
      }

      case "get_study_assignment_results": {
        const { assignment_id } = params;
        if (!assignment_id) throw new Error("assignment_id obrigatório");

        const { data: results } = await sb
          .from("teacher_study_assignment_results")
          .select("*")
          .eq("assignment_id", assignment_id);

        const studentIds = (results || []).map((r: any) => r.student_id);
        const { data: profiles } = await sb.from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", studentIds);

        const enriched = (results || []).map((r: any) => {
          const p = (profiles || []).find((p: any) => p.user_id === r.student_id);
          return { ...r, student_name: p?.display_name || "Sem nome", student_email: p?.email || "" };
        });

        return ok({ results: enriched });
      }

      case "delete_clinical_case": {
        const { case_id } = params;
        if (!case_id) throw new Error("case_id obrigatório");
        const isAdminDel = roleData.some((r: any) => r.role === "admin");
        if (!isAdminDel) {
          const { data: caseCheck } = await sb.from("teacher_clinical_cases").select("id").eq("id", case_id).eq("professor_id", user.id).single();
          if (!caseCheck) throw new Error("Caso não encontrado ou sem permissão");
        }
        await sb.from("teacher_clinical_case_results").delete().eq("case_id", case_id);
        await sb.from("teacher_clinical_cases").delete().eq("id", case_id);
        return ok({ success: true });
      }

      case "delete_study_assignment": {
        const { assignment_id } = params;
        if (!assignment_id) throw new Error("assignment_id obrigatório");
        const isAdminDelA = roleData.some((r: any) => r.role === "admin");
        if (!isAdminDelA) {
          const { data: assignCheck } = await sb.from("teacher_study_assignments").select("id").eq("id", assignment_id).eq("professor_id", user.id).single();
          if (!assignCheck) throw new Error("Tema não encontrado ou sem permissão");
        }
        await sb.from("teacher_study_assignment_results").delete().eq("assignment_id", assignment_id);
        await sb.from("teacher_study_assignments").delete().eq("id", assignment_id);
        return ok({ success: true });
      }

      case "professor_bi": {
        const { faculdade, periodo, student_id } = params;
        const isAdminBI = roleData.some((r: any) => r.role === "admin");

        // ---- PROFICIENCY DATA (teacher-created activities) ----
        // Simulados
        let simQuery = sb.from("teacher_simulados").select("id, title, topics, questions_json");
        if (!isAdminBI) simQuery = simQuery.eq("professor_id", user.id);
        const { data: sims } = await simQuery;

        const simIds = (sims || []).map((s: any) => s.id);
        let simResultsRaw: any[] = [];
        if (simIds.length > 0) {
          let rq = sb.from("teacher_simulado_results").select("simulado_id, student_id, score, status, answers_json").in("simulado_id", simIds);
          if (student_id) rq = rq.eq("student_id", student_id);
          const { data } = await rq;
          simResultsRaw = data || [];
        }

        // Clinical cases
        let caseQuery = sb.from("teacher_clinical_cases").select("id, title, specialty");
        if (!isAdminBI) caseQuery = caseQuery.eq("professor_id", user.id);
        const { data: biCases } = await caseQuery;

        const biCaseIds = (biCases || []).map((c: any) => c.id);
        let caseResultsRaw: any[] = [];
        if (biCaseIds.length > 0) {
          let crq = sb.from("teacher_clinical_case_results").select("case_id, student_id, status, final_score").in("case_id", biCaseIds);
          if (student_id) crq = crq.eq("student_id", student_id);
          const { data } = await crq;
          caseResultsRaw = data || [];
        }

        // Study assignments
        let assignBIQuery = sb.from("teacher_study_assignments").select("id, title, specialty");
        if (!isAdminBI) assignBIQuery = assignBIQuery.eq("professor_id", user.id);
        const { data: biAssigns } = await assignBIQuery;

        const biAssignIds = (biAssigns || []).map((a: any) => a.id);
        let assignResultsRaw: any[] = [];
        if (biAssignIds.length > 0) {
          let arq = sb.from("teacher_study_assignment_results").select("assignment_id, student_id, status").in("assignment_id", biAssignIds);
          if (student_id) arq = arq.eq("student_id", student_id);
          const { data } = await arq;
          assignResultsRaw = data || [];
        }

        // Collect all student IDs involved
        const allStudentIds = [...new Set([
          ...simResultsRaw.map((r: any) => r.student_id),
          ...caseResultsRaw.map((r: any) => r.student_id),
          ...assignResultsRaw.map((r: any) => r.student_id),
        ])];

        // Get student profiles
        let biProfiles: any[] = [];
        if (allStudentIds.length > 0) {
          const { data } = await sb.from("profiles").select("user_id, display_name, email, faculdade, periodo").in("user_id", allStudentIds);
          biProfiles = data || [];
        }

        // KPIs
        const totalActivities = (sims || []).length + (biCases || []).length + (biAssigns || []).length;
        const allResults = [...simResultsRaw, ...caseResultsRaw, ...assignResultsRaw];
        const completedResults = allResults.filter((r: any) => r.status === "completed");
        const pendingResults = allResults.filter((r: any) => r.status === "pending");
        const completionRate = allResults.length > 0 ? Math.round((completedResults.length / allResults.length) * 100) : 0;

        // Average score from simulados + cases
        const scoredResults = [...simResultsRaw.filter((r: any) => r.status === "completed" && r.score != null),
                               ...caseResultsRaw.filter((r: any) => r.status === "completed" && r.final_score != null)];
        const avgScore = scoredResults.length > 0
          ? Math.round(scoredResults.reduce((s: number, r: any) => s + (r.score || r.final_score || 0), 0) / scoredResults.length)
          : 0;

        // Topic performance from simulados (cross questions_json with answers_json)
        const topicPerf: Record<string, { correct: number; total: number }> = {};
        for (const sim of (sims || [])) {
          const questions = sim.questions_json || [];
          const resultsForSim = simResultsRaw.filter((r: any) => r.simulado_id === sim.id && r.status === "completed");
          for (const result of resultsForSim) {
            const answers = result.answers_json || [];
            questions.forEach((q: any, idx: number) => {
              const topic = q.topic || q.block || "Geral";
              if (!topicPerf[topic]) topicPerf[topic] = { correct: 0, total: 0 };
              topicPerf[topic].total++;
              const studentAnswer = answers[idx];
              if (studentAnswer?.is_correct) {
                topicPerf[topic].correct++;
              }
            });
          }
        }

        const topicBreakdown = Object.entries(topicPerf)
          .map(([topic, v]) => ({ topic, correct: v.correct, total: v.total, accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0 }))
          .sort((a, b) => a.accuracy - b.accuracy);

        const deficientTopics = topicBreakdown.filter(t => t.accuracy < 50 && t.total >= 2);
        const masteredTopics = topicBreakdown.filter(t => t.accuracy >= 80 && t.total >= 2);

        // Specialty performance from clinical cases
        const specialtyPerf: Record<string, { total: number; completed: number; avgScore: number }> = {};
        for (const c of (biCases || [])) {
          const sp = c.specialty || "Geral";
          if (!specialtyPerf[sp]) specialtyPerf[sp] = { total: 0, completed: 0, avgScore: 0 };
          const cRes = caseResultsRaw.filter((r: any) => r.case_id === c.id);
          for (const r of cRes) {
            specialtyPerf[sp].total++;
            if (r.status === "completed") {
              specialtyPerf[sp].completed++;
              specialtyPerf[sp].avgScore += (r.final_score || 0);
            }
          }
        }
        for (const key of Object.keys(specialtyPerf)) {
          if (specialtyPerf[key].completed > 0) specialtyPerf[key].avgScore = Math.round(specialtyPerf[key].avgScore / specialtyPerf[key].completed);
        }

        // Activity detail table
        const activityTable: any[] = [];
        for (const r of simResultsRaw) {
          const sim = (sims || []).find((s: any) => s.id === r.simulado_id);
          const p = biProfiles.find((p: any) => p.user_id === r.student_id);
          activityTable.push({
            type: "Simulado", title: sim?.title || "Simulado",
            student_name: p?.display_name || p?.email || "—",
            student_id: r.student_id,
            score: r.score != null ? Math.round(r.score) : null,
            status: r.status,
          });
        }
        for (const r of caseResultsRaw) {
          const c = (biCases || []).find((c: any) => c.id === r.case_id);
          const p = biProfiles.find((p: any) => p.user_id === r.student_id);
          activityTable.push({
            type: "Caso Clínico", title: c?.title || "Caso",
            student_name: p?.display_name || p?.email || "—",
            student_id: r.student_id,
            score: r.final_score != null ? Math.round(r.final_score) : null,
            status: r.status,
          });
        }
        for (const r of assignResultsRaw) {
          const a = (biAssigns || []).find((a: any) => a.id === r.assignment_id);
          const p = biProfiles.find((p: any) => p.user_id === r.student_id);
          activityTable.push({
            type: "Tema de Estudo", title: a?.title || "Tema",
            student_name: p?.display_name || p?.email || "—",
            student_id: r.student_id,
            score: null,
            status: r.status,
          });
        }

        // ---- GENERAL PLATFORM DATA ----
        let platformData: any = null;
        if (allStudentIds.length > 0) {
          // Gamification
          const { data: gamData } = await sb.from("user_gamification")
            .select("user_id, xp, current_streak, last_activity_date")
            .in("user_id", student_id ? [student_id] : allStudentIds);

          // Topic profiles for accuracy by specialty
          const { data: topicProfiles } = await sb.from("user_topic_profiles")
            .select("user_id, specialty, accuracy, total_questions")
            .in("user_id", student_id ? [student_id] : allStudentIds);

          // Error bank top themes
          const { data: errorData } = await sb.from("error_bank")
            .select("tema, vezes_errado")
            .in("user_id", student_id ? [student_id] : allStudentIds);

          // Practice attempts (4 weeks)
          const fourWeeksAgo = new Date();
          fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
          let attemptQuery = sb.from("practice_attempts")
            .select("user_id, correct, created_at")
            .gte("created_at", fourWeeksAgo.toISOString());
          if (student_id) {
            attemptQuery = attemptQuery.eq("user_id", student_id);
          } else if (allStudentIds.length <= 100) {
            attemptQuery = attemptQuery.in("user_id", allStudentIds);
          }
          const { data: attempts } = await attemptQuery.limit(5000);

          // Aggregate gamification
          const gams = gamData || [];
          const avgXp = gams.length > 0 ? Math.round(gams.reduce((s: number, g: any) => s + (g.xp || 0), 0) / gams.length) : 0;
          const avgStreak = gams.length > 0 ? Math.round(gams.reduce((s: number, g: any) => s + (g.current_streak || 0), 0) / gams.length) : 0;
          const now2 = new Date();
          const inactiveCount = gams.filter((g: any) => {
            if (!g.last_activity_date) return true;
            return (now2.getTime() - new Date(g.last_activity_date).getTime()) / 86400000 > 7;
          }).length;

          // Questions answered
          const totalQuestions = (attempts || []).length;
          const correctQuestions = (attempts || []).filter((a: any) => a.correct).length;
          const avgAccuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

          // Error themes top 10
          const errorMap: Record<string, number> = {};
          (errorData || []).forEach((e: any) => { errorMap[e.tema] = (errorMap[e.tema] || 0) + e.vezes_errado; });
          const topErrors = Object.entries(errorMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tema, count]) => ({ tema, count }));

          // Specialty accuracy (radar)
          const specMap: Record<string, { total: number; acc: number }> = {};
          (topicProfiles || []).forEach((tp: any) => {
            if (!specMap[tp.specialty]) specMap[tp.specialty] = { total: 0, acc: 0 };
            specMap[tp.specialty].total += tp.total_questions;
            specMap[tp.specialty].acc += tp.accuracy * tp.total_questions;
          });
          const specialtyAccuracy = Object.entries(specMap)
            .filter(([, v]) => v.total > 0)
            .map(([specialty, v]) => ({ specialty, accuracy: Math.round(v.acc / v.total), total_questions: v.total }))
            .sort((a, b) => b.total_questions - a.total_questions)
            .slice(0, 12);

          // Student engagement list
          const studentEngagement = biProfiles.map((p: any) => {
            const g = gams.find((g: any) => g.user_id === p.user_id);
            const pAttempts = (attempts || []).filter((a: any) => a.user_id === p.user_id);
            return {
              user_id: p.user_id,
              display_name: p.display_name || p.email || "—",
              xp: g?.xp || 0,
              streak: g?.current_streak || 0,
              questions_answered: pAttempts.length,
              accuracy: pAttempts.length > 0 ? Math.round((pAttempts.filter((a: any) => a.correct).length / pAttempts.length) * 100) : 0,
            };
          }).sort((a, b) => b.xp - a.xp);

          platformData = {
            kpis: { total_questions: totalQuestions, avg_accuracy: avgAccuracy, avg_streak: avgStreak, avg_xp: avgXp, inactive_count: inactiveCount },
            top_errors: topErrors,
            specialty_accuracy: specialtyAccuracy,
            student_engagement: studentEngagement,
          };
        }

        // ---- AT-RISK STUDENTS ----
        const atRiskStudents: any[] = [];
        const now3 = new Date();
        for (const p of biProfiles) {
          const reasons: string[] = [];
          // Check avg score
          const studentSimResults = simResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed" && r.score != null);
          const studentCaseResults = caseResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed" && r.final_score != null);
          const allScored = [...studentSimResults.map((r: any) => r.score), ...studentCaseResults.map((r: any) => r.final_score)];
          const avgStudentScore = allScored.length > 0 ? Math.round(allScored.reduce((a: number, b: number) => a + b, 0) / allScored.length) : null;
          if (avgStudentScore !== null && avgStudentScore < 50) reasons.push(`Média ${avgStudentScore}% (abaixo de 50%)`);

          // Check inactivity via gamification
          const gam = platformData?.student_engagement?.find((s: any) => s.user_id === p.user_id);
          // Also check pending > 3 days
          const studentPending = allResults.filter((r: any) => r.student_id === p.user_id && r.status === "pending");
          if (studentPending.length >= 3) reasons.push(`${studentPending.length} atividades pendentes`);

          if (gam && gam.streak === 0 && gam.questions_answered === 0) reasons.push("Sem atividade na plataforma");

          if (reasons.length > 0) {
            atRiskStudents.push({
              user_id: p.user_id,
              display_name: p.display_name || p.email || "—",
              reasons,
              criticality: reasons.length >= 2 ? "critico" : "atencao",
              avg_score: avgStudentScore,
            });
          }
        }

        // ---- WEEKLY EVOLUTION (last 8 weeks) ----
        const weeklyEvolution: any[] = [];
        if (platformData) {
          const eightWeeksAgo = new Date();
          eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
          let evoQuery = sb.from("practice_attempts")
            .select("correct, created_at")
            .gte("created_at", eightWeeksAgo.toISOString());
          if (student_id) {
            evoQuery = evoQuery.eq("user_id", student_id);
          } else if (allStudentIds.length <= 100) {
            evoQuery = evoQuery.in("user_id", allStudentIds);
          }
          const { data: evoAttempts } = await evoQuery.limit(10000);

          const weekMap: Record<string, { correct: number; total: number }> = {};
          for (const a of (evoAttempts || [])) {
            const d = new Date(a.created_at);
            const weekStart = new Date(d);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const key = weekStart.toISOString().slice(0, 10);
            if (!weekMap[key]) weekMap[key] = { correct: 0, total: 0 };
            weekMap[key].total++;
            if (a.correct) weekMap[key].correct++;
          }

          Object.entries(weekMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([week, v]) => {
              weeklyEvolution.push({
                week,
                accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
                total: v.total,
              });
            });
        }

        // ---- STUDENT PERCENTILE (when student_id is provided) ----
        let studentPercentile: any = null;
        if (student_id && platformData?.student_engagement?.length > 1) {
          const engList = platformData.student_engagement;
          const studentEng = engList.find((s: any) => s.user_id === student_id);
          if (studentEng) {
            const sortedByAcc = [...engList].sort((a: any, b: any) => a.accuracy - b.accuracy);
            const rank = sortedByAcc.findIndex((s: any) => s.user_id === student_id) + 1;
            studentPercentile = {
              display_name: studentEng.display_name,
              accuracy: studentEng.accuracy,
              percentile: Math.round((rank / sortedByAcc.length) * 100),
              rank,
              total_students: sortedByAcc.length,
            };
          }
        }

        // ---- STUDENT MATRIX (student × activity heatmap) ----
        const studentMatrix = biProfiles.map((p: any) => {
          const activities: any[] = [];
          for (const sim of (sims || [])) {
            const r = simResultsRaw.find((r: any) => r.simulado_id === sim.id && r.student_id === p.user_id);
            activities.push({ id: sim.id, type: "Simulado", title: sim.title, score: r?.score != null ? Math.round(r.score) : null, status: r?.status || "not_assigned" });
          }
          for (const c of (biCases || [])) {
            const r = caseResultsRaw.find((r: any) => r.case_id === c.id && r.student_id === p.user_id);
            activities.push({ id: c.id, type: "Caso", title: c.title, score: r?.final_score != null ? Math.round(r.final_score) : null, status: r?.status || "not_assigned" });
          }
          for (const a of (biAssigns || [])) {
            const r = assignResultsRaw.find((r: any) => r.assignment_id === a.id && r.student_id === p.user_id);
            activities.push({ id: a.id, type: "Tema", title: a.title, score: null, status: r?.status || "not_assigned" });
          }
          return { student_id: p.user_id, display_name: p.display_name || p.email || "—", activities };
        });

        // ---- STUDENT RANKING (by proficiency performance) ----
        const studentRanking = biProfiles.map((p: any) => {
          const sScored = simResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed" && r.score != null);
          const cScored = caseResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed" && r.final_score != null);
          const allScores = [...sScored.map((r: any) => r.score), ...cScored.map((r: any) => r.final_score)];
          const avgSc = allScores.length > 0 ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) : 0;
          const totalAssigned = simResultsRaw.filter((r: any) => r.student_id === p.user_id).length
            + caseResultsRaw.filter((r: any) => r.student_id === p.user_id).length
            + assignResultsRaw.filter((r: any) => r.student_id === p.user_id).length;
          const totalDone = simResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed").length
            + caseResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed").length
            + assignResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed").length;
          const completionR = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0;
          return { user_id: p.user_id, display_name: p.display_name || p.email || "—", avg_score: avgSc, completion_rate: completionR, total_done: totalDone, total_assigned: totalAssigned };
        }).sort((a, b) => b.avg_score - a.avg_score);

        // ---- TOPIC × STUDENT CROSS ----
        const topicStudentCross: Record<string, Record<string, { correct: number; total: number }>> = {};
        for (const sim of (sims || [])) {
          const questions = sim.questions_json || [];
          const resultsForSim = simResultsRaw.filter((r: any) => r.simulado_id === sim.id && r.status === "completed");
          for (const result of resultsForSim) {
            const answers = result.answers_json || [];
            const pName = biProfiles.find((p: any) => p.user_id === result.student_id)?.display_name || "—";
            questions.forEach((q: any, idx: number) => {
              const topic = q.topic || q.block || "Geral";
              if (!topicStudentCross[topic]) topicStudentCross[topic] = {};
              if (!topicStudentCross[topic][pName]) topicStudentCross[topic][pName] = { correct: 0, total: 0 };
              topicStudentCross[topic][pName].total++;
              const studentAnswer = answers[idx];
              if (studentAnswer?.is_correct) {
                topicStudentCross[topic][pName].correct++;
              }
            });
          }
        }
        const topicStudentCrossArr = Object.entries(topicStudentCross).map(([topic, students]) => ({
          topic,
          students: Object.entries(students).map(([name, v]) => ({
            name, correct: v.correct, total: v.total, accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
          })),
        })).sort((a, b) => a.topic.localeCompare(b.topic));

        // ---- PROFICIENCY VS PLATFORM CORRELATION ----
        const proficiencyVsPlatform = biProfiles.map((p: any) => {
          const sScored = simResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed" && r.score != null);
          const cScored = caseResultsRaw.filter((r: any) => r.student_id === p.user_id && r.status === "completed" && r.final_score != null);
          const allScores = [...sScored.map((r: any) => r.score), ...cScored.map((r: any) => r.final_score)];
          const profAcc = allScores.length > 0 ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) : null;
          const platEng = platformData?.student_engagement?.find((s: any) => s.user_id === p.user_id);
          const platAcc = platEng?.accuracy ?? null;
          return {
            student_id: p.user_id,
            name: p.display_name || p.email || "—",
            prof_accuracy: profAcc,
            platform_accuracy: platAcc,
            gap: profAcc != null && platAcc != null ? profAcc - platAcc : null,
          };
        }).filter((s: any) => s.prof_accuracy != null || s.platform_accuracy != null);

        // ---- ACTIVITY HEATMAP (practice_attempts by day of week × hour) ----
        let activityHeatmap: any[] = [];
        if (platformData) {
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          let heatQuery = sb.from("practice_attempts").select("created_at").gte("created_at", twoWeeksAgo.toISOString());
          if (student_id) {
            heatQuery = heatQuery.eq("user_id", student_id);
          } else if (allStudentIds.length <= 100) {
            heatQuery = heatQuery.in("user_id", allStudentIds);
          }
          const { data: heatAttempts } = await heatQuery.limit(5000);
          const heatMap: Record<string, number> = {};
          for (const a of (heatAttempts || [])) {
            const d = new Date(a.created_at);
            const key = `${d.getDay()}-${d.getHours()}`;
            heatMap[key] = (heatMap[key] || 0) + 1;
          }
          activityHeatmap = Object.entries(heatMap).map(([key, count]) => {
            const [day, hour] = key.split("-").map(Number);
            return { day, hour, count };
          });
        }

        return ok({
          proficiency: {
            kpis: { total_activities: totalActivities, completion_rate: completionRate, avg_score: avgScore, pending: pendingResults.length },
            topic_breakdown: topicBreakdown,
            deficient_topics: deficientTopics,
            mastered_topics: masteredTopics,
            specialty_perf: specialtyPerf,
            activity_table: activityTable.slice(0, 200),
          },
          platform: platformData,
          students: biProfiles.map((p: any) => ({ user_id: p.user_id, display_name: p.display_name || p.email })),
          at_risk_students: atRiskStudents,
          weekly_evolution: weeklyEvolution,
          student_percentile: studentPercentile,
          student_matrix: studentMatrix,
          student_ranking: studentRanking,
          topic_student_cross: topicStudentCrossArr,
          proficiency_vs_platform: proficiencyVsPlatform,
          activity_heatmap: activityHeatmap,
        });
      }

      case "professor_bi_suggestion": {
        const { summary } = params;
        if (!summary) throw new Error("Resumo dos dados é obrigatório");

        const prompt = `Você é um consultor pedagógico especializado em educação médica. Com base nos dados de desempenho da turma abaixo, gere de 3 a 5 recomendações pedagógicas específicas e acionáveis.

DADOS DA TURMA:
${JSON.stringify(summary, null, 2)}

Retorne APENAS um array JSON:
[
  {
    "title": "Título curto da recomendação",
    "description": "Descrição detalhada da ação pedagógica sugerida",
    "priority": "alta" | "media" | "baixa",
    "target": "turma" | "individual"
  }
]

REGRAS:
- Foque nos assuntos deficitários identificados
- Sugira metodologias ativas (PBL, TBL, simulação, estudo dirigido)
- Considere o engajamento e frequência dos alunos
- Seja específico: mencione os temas e especialidades pelos nomes
- Tudo em português brasileiro`;

        const response = await aiFetch({
          messages: [{ role: "user", content: prompt }],
          model: "google/gemini-2.5-flash",
        });

        if (!response.ok) throw new Error("Erro ao gerar sugestões");

        const aiData = await response.json();
        const content = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return ok({ suggestions });
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("professor-simulado error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
