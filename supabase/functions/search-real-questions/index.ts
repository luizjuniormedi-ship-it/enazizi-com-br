import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { validateAIOutput, logValidationRejection } from "../_shared/ai-validation.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TRUSTED_DOMAINS = [
  "inep.gov.br", "gov.br", "saude.sp.gov.br", "saude.gov.br",
  "enare.org.br", "abmes.org.br",
  "usp.br", "unicamp.br", "unifesp.br", "fmusp.br", "fcm.unicamp.br",
  "ufpr.br", "ufrj.br", "ufmg.br", "ufrgs.br", "ufba.br", "ufpe.br",
  "ufsc.br", "unesp.br", "uel.br", "uem.br", "ufg.br", "ufms.br",
  "ufpa.br", "ufma.br", "ufrn.br", "ufal.br", "ufes.br", "ufc.br",
  "ufpb.br", "ufpi.br", "ufmt.br", "unb.br", "ufam.br",
  "ufscar.br", "ufsm.br", "furg.br", "ufla.br",
  "pucrs.br", "pucsp.br", "pucminas.br", "pucpr.br",
  "mackenzie.br", "einstein.br", "hsl.org.br",
  "santacasasp.org.br", "fcmsantacasasp.edu.br",
  "fgv.br", "vunesp.com.br", "cesgranrio.org.br", "ibfc.org.br",
  "amrigs.org.br", "upenet.com.br", "fuvest.br", "comvest.unicamp.br",
  "famerp.br", "fmabc.br", "iamspe.sp.gov.br",
  "qconcursos.com.br", "pciconcursos.com.br", "questoesmedicas.com.br",
  "residenciamedicasp.com.br", "residenciamedica.com.br",
  "provamedicina.com.br", "residenciamedica.net",
  "medway.com.br", "medcel.com.br", "estrategiamed.com.br",
  "medgrupo.com.br", "sanarmed.com", "editorasanar.com.br",
  "jaleko.com.br", "afya.com.br", "med.estrategia.com",
];

const BLOCKED_DOMAINS = ["scribd.com", "youtube.com", "youtu.be", "facebook.com", "instagram.com", "twitter.com", "tiktok.com"];

const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female|upon examination|medical history)\b/i;

const CLINICAL_MARKERS = [
  /\b\d{1,3}\s*(anos?|meses?|dias?)\b/i,
  /\b(masculino|feminino|homem|mulher|paciente|gestante|idoso|criança|lactente)\b/i,
  /\b(PA|FC|FR|SpO2|temperatura|pressão arterial|frequência cardíaca)\b/i,
  /\b(exame físico|ao exame|ausculta|palpação|inspeção|percussão)\b/i,
  /\b(hemograma|glicemia|creatinina|ureia|PCR|VHS|TSH|ECG|tomografia|radiografia)\b/i,
  /\b(queixa|refere|relata|apresenta|evolui|procura|admitido|internado)\b/i,
];

const OPTION_PATTERN = /^[A-E]\)\s/;
const QUESTION_MARKER = /(?:[A-E]\)\s|alternativa|gabarito|\bquestão\b|\d+\.\s)/i;

const SPECIALTIES_POOL = [
  "Angiologia", "Cardiologia", "Cirurgia Geral", "Dermatologia",
  "Endocrinologia", "Gastroenterologia", "Ginecologia e Obstetrícia",
  "Hematologia", "Infectologia", "Medicina Preventiva", "Nefrologia",
  "Neurologia", "Oftalmologia", "Oncologia", "Ortopedia",
  "Otorrinolaringologia", "Pediatria", "Pneumologia", "Psiquiatria",
  "Reumatologia", "Urologia",
];

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────

function hasClinicalContent(text: string): boolean {
  let matches = 0;
  for (const m of CLINICAL_MARKERS) {
    if (m.test(text)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

function simpleHash(text: string): string {
  // Normalize: lowercase, collapse whitespace, remove punctuation
  const normalized = text.toLowerCase().replace(/[^a-záàâãéèêíóòôõúçñ0-9\s]/gi, "").replace(/\s+/g, " ").trim();
  // Simple hash via charCode sum + length
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `${hash}_${normalized.length}_${normalized.slice(0, 40)}`;
}

function isSimilar(a: string, b: string): boolean {
  const na = a.slice(0, 120).toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.slice(0, 120).toLowerCase().replace(/\s+/g, " ").trim();
  if (na === nb) return true;
  // Check overlap
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  let common = 0;
  for (const w of wordsA) { if (wordsB.has(w)) common++; }
  const similarity = common / Math.max(wordsA.size, wordsB.size);
  return similarity > 0.85;
}

function isTrustedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch { return false; }
}

// ─── STEP 1: SOURCE DISCOVERY ───────────────────────────────────────────────

function buildQueryPool(specialty: string, banca: string | null): string[] {
  if (banca) {
    return [
      `"${banca}" ${specialty} questões alternativas gabarito`,
      `"${banca}" ${specialty} prova comentada residência médica`,
      `"${banca}" ${specialty} prova gabarito oficial`,
    ];
  }
  return [
    `site:medway.com.br ${specialty} questões comentadas residência`,
    `site:sanarmed.com ${specialty} questões comentadas prova`,
    `site:qconcursos.com.br ${specialty} questões residência médica`,
    `site:estrategiamed.com.br ${specialty} questões comentadas`,
    `site:medcel.com.br ${specialty} questões comentadas`,
    `site:med.estrategia.com ${specialty} questões gabarito residência`,
    `"${specialty}" prova residência médica gabarito oficial PDF`,
    `REVALIDA INEP ${specialty} prova questões gabarito`,
    `ENARE ${specialty} questões prova residência`,
    `SUS-SP ${specialty} prova residência médica gabarito`,
    `USP ${specialty} prova residência questões comentadas`,
    `UNICAMP ${specialty} prova residência médica gabarito`,
    `UNIFESP ${specialty} questões prova residência`,
    `Santa Casa ${specialty} prova residência médica questões`,
    `"questão" "${specialty}" prova residência médica alternativas gabarito`,
    `${specialty} questões objetivas residência médica 2024 2025 2026`,
    `${specialty} prova residência médica questões comentadas site:.br`,
    `${specialty} prova residência AMRIGS questões gabarito`,
    `${specialty} concurso residência médica questões 2025`,
    `site:jaleko.com.br ${specialty} questões comentadas residência`,
    `site:afya.com.br ${specialty} questões provas residência médica`,
    `site:residenciamedicasp.com.br ${specialty} provas anteriores`,
    `site:provamedicina.com.br ${specialty} questões provas residência`,
  ];
}

// ─── STEP 2: CONTENT COLLECTION ─────────────────────────────────────────────

interface RunLog {
  urls_tested: number;
  candidate_blocks_found: number;
  questions_extracted: number;
  questions_accepted: number;
  questions_rejected: number;
  duplicates_found: number;
  english_leaked: number;
  rejection_reasons: Record<string, number>;
  sources_used: string[];
  queries_executed: number;
}

function newRunLog(): RunLog {
  return {
    urls_tested: 0, candidate_blocks_found: 0, questions_extracted: 0,
    questions_accepted: 0, questions_rejected: 0, duplicates_found: 0,
    english_leaked: 0, rejection_reasons: {}, sources_used: [], queries_executed: 0,
  };
}

function logReject(log: RunLog, reason: string) {
  log.questions_rejected++;
  log.rejection_reasons[reason] = (log.rejection_reasons[reason] || 0) + 1;
}

// ─── STEP 3: CANDIDATE BLOCK DETECTION ──────────────────────────────────────

interface CandidateBlock {
  text: string;
  sourceUrl: string;
  qualityScore: number;
}

function extractCandidateBlocks(markdown: string, sourceUrl: string, maxChars: number): CandidateBlock[] {
  const sections = markdown.split(/\n{2,}/);
  const blocks: CandidateBlock[] = [];
  let totalLen = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section || section.length < 50) continue;

    const nextSection = sections[i + 1]?.trim() || "";
    const combined = section + " " + nextSection;

    if (QUESTION_MARKER.test(combined) || hasClinicalContent(section)) {
      const start = Math.max(0, i - 1);
      const end = Math.min(sections.length - 1, i + 3);
      const block = sections.slice(start, end + 1).join("\n\n");

      if (totalLen + block.length > maxChars) break;

      // Step 4: Quality scoring before AI
      const quality = scoreBlockQuality(block);
      if (quality >= 0.3) {
        blocks.push({ text: block, sourceUrl, qualityScore: quality });
        totalLen += block.length;
      }
      i = end;
    }
  }

  return blocks;
}

// ─── STEP 4: QUALITY SCORING BEFORE AI ──────────────────────────────────────

function scoreBlockQuality(block: string): number {
  let score = 0;
  const len = block.length;

  // Length score: longer blocks are more likely to be full questions
  if (len >= 500) score += 0.3;
  else if (len >= 200) score += 0.15;

  // Has at least 4 option-like patterns
  const optionMatches = block.match(/[A-E]\)\s/g) || [];
  if (optionMatches.length >= 4) score += 0.3;
  else if (optionMatches.length >= 2) score += 0.1;

  // Has clinical content markers
  if (hasClinicalContent(block)) score += 0.2;

  // Has gabarito marker
  if (/gabarito/i.test(block)) score += 0.1;

  // Penalty: English content
  if (ENGLISH_PATTERN.test(block)) score -= 0.5;

  // Penalty: too short
  if (len < 100) score -= 0.3;

  return Math.max(0, Math.min(1, score));
}

// ─── STEP 5: AI EXTRACTION ──────────────────────────────────────────────────

async function aiExtractQuestions(
  candidateBlocks: CandidateBlock[],
  specialty: string,
): Promise<any[]> {
  if (candidateBlocks.length === 0) return [];

  const contentBlock = candidateBlocks
    .map((b, i) => `--- BLOCO ${i + 1} (score: ${b.qualityScore.toFixed(2)}, fonte: ${b.sourceUrl}) ---\n${b.text}`)
    .join("\n\n");

  const prompt = `Você é um especialista em extrair questões reais de provas de residência médica a partir de conteúdo web.

OBJETIVO:
Extrair SOMENTE questões reais, completas e em português brasileiro, sem inventar, resumir ou reescrever.

IDIOMA OBRIGATÓRIO:
Extraia apenas questões já escritas em português brasileiro.
Descarte integralmente qualquer questão em inglês, espanhol ou outro idioma.
NÃO traduza. NÃO adapte. NÃO invente.

CONTEÚDO PRÉ-FILTRADO (blocos candidatos de provas):
${contentBlock.slice(0, 30000)}

TAREFA: Extraia no MÁXIMO 5 questões de ${specialty} ou áreas correlatas.

REGRAS CRÍTICAS:
1. Extraia apenas questões que estejam claramente presentes no conteúdo.
2. Não combine partes de questões diferentes.
3. Não crie alternativas ausentes.
4. Preserve o enunciado o mais fielmente possível.
5. Preserve as alternativas originais.
6. Só aceite questões com no mínimo 4 alternativas.
7. Só aceite questões com contexto médico real e enunciado minimamente completo (mínimo 200 caracteres).
8. Se houver gabarito explícito, use-o.
9. Se não houver gabarito explícito, marque isso claramente.
10. Se houver dúvida, descarte a questão.
11. Ignore questões sobre declarações financeiras ou conflitos de interesse.
12. MÁXIMO 5 questões para garantir JSON completo.

CLASSIFICAÇÃO DO GABARITO:
Use:
- "answer_source": "explicit_gabarito" — quando o gabarito está explícito no conteúdo
- "answer_source": "context_inferred" — quando inferido pelo contexto
- "answer_source": "unknown" — quando não há segurança suficiente

Se não houver segurança suficiente no gabarito, use:
- "correct_index": null
- "explanation": ""
- "answer_source": "unknown"

FORMATO JSON OBRIGATÓRIO (responda APENAS com este JSON, sem texto adicional):
{
  "questions": [
    {
      "statement": "Enunciado original completo...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "answer_source": "explicit_gabarito",
      "confidence_score": 0.95,
      "explanation": "Explicação curta e objetiva apenas se o gabarito estiver claro.",
      "topic": "${specialty}",
      "subtopic": "",
      "difficulty": 4,
      "source_url": "URL de onde foi extraída",
      "exam_info": "Nome da prova e ano se identificável"
    }
  ]
}

Se não encontrar questões válidas de ${specialty}, retorne: {"questions": []}`;

  try {
    const response = await aiFetch({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "Você extrai questões de provas de residência médica a partir de conteúdo web. Responda APENAS com JSON válido, sem markdown, sem explicações adicionais." },
        { role: "user", content: prompt },
      ],
      timeoutMs: 50000,
      maxRetries: 1,
    });

    if (!response.ok) {
      console.error("AI extraction error:", await response.text());
      return [];
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    return extractQuestionsFromJson(rawContent);
  } catch (e) {
    console.error("AI extraction failed:", e);
    return [];
  }
}

// ─── JSON EXTRACTION (robust, handles truncation) ───────────────────────────

function extractQuestionsFromJson(raw: string): any[] {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.questions && Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed)) return parsed;
  } catch { /* recovery */ }

  const arrMatch = cleaned.match(/"questions"\s*:\s*\[/);
  if (arrMatch && arrMatch.index !== undefined) {
    const startIdx = cleaned.indexOf("[", arrMatch.index);
    if (startIdx !== -1) {
      let substr = cleaned.slice(startIdx);
      let depth = 0, endIdx = -1;
      for (let i = 0; i < substr.length; i++) {
        if (substr[i] === "[") depth++;
        else if (substr[i] === "]") { depth--; if (depth === 0) { endIdx = i; break; } }
      }
      if (endIdx !== -1) {
        try { return JSON.parse(substr.slice(0, endIdx + 1)); } catch { /* continue */ }
      }
      return extractIndividualObjects(substr.slice(1));
    }
  }
  return extractIndividualObjects(cleaned);
}

function extractIndividualObjects(text: string): any[] {
  const results: any[] = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        if (candidate.includes('"statement"')) {
          try {
            const obj = JSON.parse(candidate);
            if (obj.statement) results.push(obj);
          } catch {
            try {
              const fixed = candidate.replace(/,\s*\}/g, "}").replace(/,\s*\]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
              const obj = JSON.parse(fixed);
              if (obj.statement) results.push(obj);
            } catch { /* skip */ }
          }
        }
        start = -1;
      }
    }
  }
  return results;
}

// ─── STEP 6: POST-AI VALIDATION ─────────────────────────────────────────────

function isValidQuestion(q: any): { valid: boolean; reason: string } {
  if (!q?.statement) return { valid: false, reason: "no_statement" };
  const stmt = String(q.statement).trim();
  if (stmt.length < 400) return { valid: false, reason: `too_short_${stmt.length}` };
  if (!Array.isArray(q.options) || q.options.length < 4) return { valid: false, reason: "less_than_4_options" };

  // Options are already normalized by normalizeOptionPrefixes, just check we have 4+
  const validOpts = q.options.filter((opt: string) => {
    const trimmed = String(opt).trim();
    return trimmed.length > 0 && OPTION_PATTERN.test(trimmed);
  });
  if (validOpts.length < 4) return { valid: false, reason: "options_bad_format" };

  if (!q.source_url) return { valid: false, reason: "no_source_url" };

  if (q.correct_index !== null && q.correct_index !== undefined) {
    if (typeof q.correct_index !== "number") return { valid: false, reason: "correct_index_not_number" };
    if (q.correct_index < 0 || q.correct_index >= q.options.length) return { valid: false, reason: "correct_index_out_of_range" };
  }

  // English check
  if (ENGLISH_PATTERN.test(stmt)) return { valid: false, reason: "english_content" };

  // Global AI validation layer
  const aiVal = validateAIOutput({ statement: stmt, options: q.options, correct_index: q.correct_index, topic: q.topic }, {}, "question");
  if (!aiVal.valid) {
    logValidationRejection("question", aiVal.reason || "unknown", { specialty: q.topic }, stmt);
    return { valid: false, reason: aiVal.reason || "ai_validation_failed" };
  }

  return { valid: true, reason: "" };
}

function normalizeOptionPrefixes(options: any[]): string[] {
  const LETTERS = ["A", "B", "C", "D", "E"];
  // Strip existing prefixes and re-add canonical format
  const STRIP_PATTERN = /^\s*(?:\(?[A-Ea-e]\)?[\.\)\-:\s]+)/;
  return options.map((opt: any, i: number) => {
    const s = String(opt).trim();
    const stripped = s.replace(STRIP_PATTERN, "").trim();
    const letter = LETTERS[i] || LETTERS[0];
    // If already correct format, keep as-is
    if (new RegExp(`^${letter}\\)\\s`).test(s)) return s;
    return `${letter}) ${stripped}`;
  });
}

function normalizeQuestion(q: any): any {
  const answerSource = q.answer_source || "unknown";

  // Normalize option prefixes FIRST
  if (Array.isArray(q.options)) {
    q.options = normalizeOptionPrefixes(q.options);
  }

  if (q.correct_index === undefined || q.correct_index === null) {
    if (q.correct_answer !== undefined) {
      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      q.correct_index = letterMap[String(q.correct_answer).toUpperCase().trim()] ?? null;
    }
    if (q.correct_index === undefined || q.correct_index === null) {
      if (answerSource === "unknown") {
        q.correct_index = null;
        q.explanation = q.explanation || "Gabarito não confirmado — verificação manual recomendada.";
      } else {
        q.correct_index = 0;
      }
    }
  }

  if (q.correct_index !== null) {
    q.correct_index = Number(q.correct_index);
    if (isNaN(q.correct_index)) q.correct_index = null;
  }

  q.answer_source = answerSource;
  q.confidence_score = Number(q.confidence_score) || 0;
  q.subtopic = q.subtopic || "";
  q.exam_info = q.exam_info || "";
  q.difficulty = Math.max(3, Number(q.difficulty) || 4);

  return q;
}

// ─── STEP 7: DEDUPLICATION ──────────────────────────────────────────────────

function deduplicateQuestions(
  questions: any[],
  existingHashes: Set<string>,
  existingStatements: string[],
): { unique: any[]; dupes: number } {
  const unique: any[] = [];
  let dupes = 0;
  const seenHashes = new Set<string>();

  for (const q of questions) {
    const hash = simpleHash(q.statement);

    // Check against existing DB hashes
    if (existingHashes.has(hash)) { dupes++; continue; }

    // Check within this batch
    if (seenHashes.has(hash)) { dupes++; continue; }

    // Similarity check against existing statements
    if (existingStatements.some(ex => isSimilar(q.statement, ex))) { dupes++; continue; }

    seenHashes.add(hash);
    q._hash = hash;
    unique.push(q);
  }

  return { unique, dupes };
}

// ─── SEARCH AND SCRAPE ──────────────────────────────────────────────────────

async function searchAndCollect(
  specialty: string,
  banca: string | null,
  alreadyScrapedKeys: Set<string>,
  globalDeadline: number,
  log: RunLog,
): Promise<CandidateBlock[]> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.warn("FIRECRAWL_API_KEY não configurado — busca web desabilitada");
    return [];
  }

  const queries = buildQueryPool(specialty, banca);
  // Shuffle for variety
  for (let i = queries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queries[i], queries[j]] = [queries[j], queries[i]];
  }

  const selectedQueries = queries.slice(0, 4);
  const allBlocks: CandidateBlock[] = [];
  const seenUrls = new Set<string>();

  for (let i = 0; i < selectedQueries.length; i += 2) {
    if (allBlocks.length >= 15) break;
    if (Date.now() >= globalDeadline) break;

    const batch = selectedQueries.slice(i, i + 2);
    log.queries_executed += batch.length;
    const remainingMs = Math.max(1000, globalDeadline - Date.now());
    const queryTimeout = Math.min(12000, remainingMs - 1000);

    const promises = batch.map(async (query) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), queryTimeout);
        const resp = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query, limit: 5, lang: "pt-br", country: "BR",
            scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.data || [];
      } catch { return []; }
    });

    const batchResults = await Promise.all(promises);

    for (const items of batchResults) {
      for (const item of items) {
        const url = item.url || "";
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        log.urls_tested++;

        if (BLOCKED_DOMAINS.some(d => url.includes(d))) continue;

        try {
          const urlKey = new URL(url).hostname + new URL(url).pathname;
          if (alreadyScrapedKeys.has(urlKey)) continue;
        } catch { /* ignore */ }

        const markdown = item.markdown || "";
        if (markdown.length < 500) continue;

        // Extract candidate blocks from this page
        const blocks = extractCandidateBlocks(markdown, url, 18000);
        log.candidate_blocks_found += blocks.length;

        for (const block of blocks) {
          if (allBlocks.length < 15) allBlocks.push(block);
        }
      }
    }
  }

  console.log(`Collected ${allBlocks.length} candidate blocks from ${log.urls_tested} URLs`);
  return allBlocks;
}

// ─── EXISTING DATA FETCHERS ─────────────────────────────────────────────────

async function getExistingHashes(supabaseAdmin: any, specialty: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("real_exam_questions")
    .select("statement_hash")
    .eq("topic", specialty)
    .limit(500);
  return new Set((data || []).map((r: any) => r.statement_hash));
}

async function getExistingStatements(supabaseAdmin: any, specialty: string): Promise<string[]> {
  const { data: realData } = await supabaseAdmin
    .from("real_exam_questions")
    .select("statement")
    .eq("topic", specialty)
    .limit(200);

  const { data: bankData } = await supabaseAdmin
    .from("questions_bank")
    .select("statement")
    .eq("topic", specialty)
    .eq("is_global", true)
    .limit(200);

  return [...(realData || []), ...(bankData || [])].map((r: any) => r.statement);
}

async function getAlreadyScrapedUrls(supabaseAdmin: any, specialty: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("real_exam_questions")
    .select("source_url")
    .eq("topic", specialty)
    .limit(300);

  const urls = new Set<string>();
  for (const row of (data || [])) {
    try {
      const u = new URL(row.source_url);
      urls.add(u.hostname + u.pathname);
    } catch { /* ignore */ }
  }

  // Also check questions_bank
  const { data: bankData } = await supabaseAdmin
    .from("questions_bank")
    .select("explanation")
    .eq("topic", specialty)
    .eq("source", "web-scrape")
    .eq("is_global", true)
    .limit(100);

  for (const row of (bankData || [])) {
    const match = String(row.explanation || "").match(/\[Fonte:\s*(https?:\/\/[^\s\]|]+)/);
    if (match) {
      try { urls.add(new URL(match[1]).hostname + new URL(match[1]).pathname); } catch { /* ignore */ }
    }
  }

  return urls;
}

async function pickSpecialtyWithFewest(supabaseAdmin: any): Promise<string> {
  const counts: { specialty: string; count: number }[] = [];
  for (const sp of SPECIALTIES_POOL) {
    const { count } = await supabaseAdmin
      .from("real_exam_questions")
      .select("id", { count: "exact", head: true })
      .eq("topic", sp);
    counts.push({ specialty: sp, count: count || 0 });
  }
  counts.sort((a, b) => a.count - b.count);
  const bottom = counts.slice(0, 3);
  return bottom[Math.floor(Math.random() * bottom.length)].specialty;
}

// ─── SOURCE TYPE DETECTION ──────────────────────────────────────────────────

function detectSourceType(url: string, pageContent?: string): "hub_page" | "pdf_direct" | "html_question_page" | "indexed_only" {
  const lower = url.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf_direct";
  if (pageContent) {
    const pdfCount = (pageContent.match(/\.pdf/gi) || []).length;
    const examKeywords = /prova|gabarito|edição|ano/gi;
    const examMatches = (pageContent.match(examKeywords) || []).length;
    if (pdfCount >= 3 && examMatches >= 2) return "hub_page";
    if ((pageContent.match(/[A-E]\)\s/g) || []).length >= 8) return "html_question_page";
  }
  return "indexed_only";
}

// ─── HUB PAGE PROCESSOR ────────────────────────────────────────────────────

async function processHubPage(
  url: string,
  supabaseAdmin: any,
  userId: string | null,
): Promise<{ sources_found: number; pdf_links: any[] }> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  let pageText = "";

  if (FIRECRAWL_API_KEY) {
    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });
      const data = await resp.json();
      pageText = data?.data?.markdown || "";
    } catch { /* fallback */ }
  }

  if (!pageText) {
    try {
      const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      pageText = await resp.text();
    } catch { return { sources_found: 0, pdf_links: [] }; }
  }

  // Extract PDF links
  const pdfLinks: { name: string; url: string; year?: number; specialty?: string }[] = [];
  const pdfRegex = /https?:\/\/[^\s"'<>)]+\.pdf/gi;
  const matches = pageText.match(pdfRegex) || [];
  const seenUrls = new Set<string>();

  for (const m of matches) {
    if (seenUrls.has(m)) continue;
    seenUrls.add(m);
    const yearMatch = m.match(/(20\d{2})/);
    const name = decodeURIComponent(m.split("/").pop() || "prova.pdf").replace(/[_-]/g, " ");
    pdfLinks.push({ name, url: m, year: yearMatch ? parseInt(yearMatch[1]) : undefined });
  }

  // Also extract section titles with years for context
  const yearSections = pageText.match(/(?:20\d{2})\s*(?:\/\s*20\d{2})?.*?(?:prova|gabarito|objetiva|r1|r\+)/gi) || [];

  // Index each discovered source
  let sourcesFound = 0;
  for (const link of pdfLinks) {
    try {
      await supabaseAdmin.from("external_exam_sources").upsert({
        title: link.name,
        source_url: link.url,
        year: link.year,
        source_type: "pdf_direct",
        permission_type: "indexed_external",
        processing_status: "pending",
        created_by: userId,
      }, { onConflict: "source_url" });
      sourcesFound++;
    } catch { /* skip duplicates */ }
  }

  // Log the hub page itself
  try {
    await supabaseAdmin.from("external_exam_sources").upsert({
      title: `Hub: ${new URL(url).hostname}`,
      source_url: url,
      source_type: "hub_page",
      permission_type: "indexed_external",
      processing_status: "completed",
      extracted_questions_count: 0,
      created_by: userId,
    }, { onConflict: "source_url" });
  } catch { /* ignore */ }

  // Log to ingestion_log
  await supabaseAdmin.from("ingestion_log").insert({
    source_name: `Hub: ${url}`,
    source_url: url,
    source_type: "hub_page",
    permission_type: "indexed_external",
    questions_found: pdfLinks.length,
    status: "navigated",
    created_by: userId,
  });

  return { sources_found: sourcesFound, pdf_links: pdfLinks };
}

// ─── MAIN PIPELINE ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let runId: string | null = null;

  try {
    const globalDeadline = Date.now() + 55000;
    const body = await req.json().catch(() => ({}));
    const autoMode = body.auto === true;
    const banca = body.banca || null;

    // ─── NEW: Hub page mode ─────────────────────────────────────────
    if (body.mode === "hub_page" && body.url) {
      const userId = body.user_id || null;
      const result = await processHubPage(body.url, supabaseAdmin, userId);
      return new Response(JSON.stringify({
        success: true,
        mode: "hub_page",
        ...result,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── NEW: Index only mode ───────────────────────────────────────
    if (body.mode === "index_only" && body.url) {
      await supabaseAdmin.from("external_exam_sources").upsert({
        title: body.title || `Indexed: ${body.url}`,
        source_url: body.url,
        specialty: body.specialty,
        year: body.year,
        source_type: "indexed_only",
        permission_type: body.permission_type || "indexed_external",
        processing_status: "indexed",
        created_by: body.user_id || null,
      }, { onConflict: "source_url" });

      await supabaseAdmin.from("ingestion_log").insert({
        source_name: body.title || body.url,
        source_url: body.url,
        source_type: "indexed_only",
        permission_type: body.permission_type || "indexed_external",
        status: "indexed",
        created_by: body.user_id || null,
      });

      return new Response(JSON.stringify({ success: true, mode: "index_only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── NEW: Auto-detect URL source type ───────────────────────────
    if (body.mode === "auto_detect" && body.url) {
      const sourceType = detectSourceType(body.url);
      return new Response(JSON.stringify({ source_type: sourceType, url: body.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Original pipeline (specialty search mode) ──────────────────
    const specialty = autoMode
      ? await pickSpecialtyWithFewest(supabaseAdmin)
      : (body.specialty || "Cardiologia");

    console.log(`=== PIPELINE START: ${specialty} (auto=${autoMode}, banca=${banca}) ===`);

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "FIRECRAWL_API_KEY não configurada. O Web Scraping automatizado requer esta chave para buscar questões em fontes oficiais. Por favor, adicione a chave nas configurações do Supabase.",
        questions_inserted: 0,
        sources_used: [],
        pages_scraped: 0,
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Create scraping run log
    const { data: runData } = await supabaseAdmin
      .from("scraping_runs")
      .insert({ specialty, banca, status: "running" })
      .select("id")
      .single();
    runId = runData?.id || null;

    const log = newRunLog();

    // Fetch existing data for dedup
    const [existingHashes, existingStatements, alreadyScrapedKeys] = await Promise.all([
      getExistingHashes(supabaseAdmin, specialty),
      getExistingStatements(supabaseAdmin, specialty),
      getAlreadyScrapedUrls(supabaseAdmin, specialty),
    ]);

    console.log(`Existing: ${existingHashes.size} hashes, ${existingStatements.length} statements, ${alreadyScrapedKeys.size} URLs`);

    // Step 1-4: Search, collect, detect candidates, score quality
    const candidateBlocks = await searchAndCollect(specialty, banca, alreadyScrapedKeys, globalDeadline, log);

    if (candidateBlocks.length === 0) {
      console.log("No candidate blocks found");
      if (runId) {
        await supabaseAdmin.from("scraping_runs").update({
          status: "completed", finished_at: new Date().toISOString(), ...log,
        }).eq("id", runId);
      }
      return new Response(JSON.stringify({
        success: true, specialty, auto: autoMode,
        questions_inserted: 0, sources_used: [], pages_scraped: 0, run_id: runId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 5: AI extraction
    const rawQuestions = await aiExtractQuestions(candidateBlocks, specialty);
    log.questions_extracted = rawQuestions.length;
    console.log(`AI extracted ${rawQuestions.length} raw questions`);

    // Step 6: Post-AI validation
    const validQuestions: any[] = [];
    for (const q of rawQuestions) {
      const normalized = normalizeQuestion(q);
      const { valid, reason } = isValidQuestion(normalized);

      if (!valid) {
        logReject(log, reason);
        if (reason === "english_content") log.english_leaked++;
        console.log(`Rejected: ${reason}`);
        continue;
      }

      validQuestions.push(normalized);
    }

    console.log(`${validQuestions.length} questions passed validation`);

    // Step 7: Deduplication
    const { unique, dupes } = deduplicateQuestions(validQuestions, existingHashes, existingStatements);
    log.duplicates_found = dupes;
    console.log(`${unique.length} unique questions (${dupes} duplicates removed)`);

    if (unique.length === 0) {
      log.questions_accepted = 0;
      if (runId) {
        await supabaseAdmin.from("scraping_runs").update({
          status: "completed", finished_at: new Date().toISOString(), ...log,
        }).eq("id", runId);
      }
      return new Response(JSON.stringify({
        success: true, specialty, auto: autoMode,
        questions_inserted: 0, sources_used: [], pages_scraped: candidateBlocks.length,
        run_id: runId, duplicates: dupes,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 8: Metadata enrichment + Step 9: Insert into real_exam_questions
    const sources = new Set<string>();
    const rows = unique.map((q: any) => {
      const sourceUrl = String(q.source_url || "").trim();
      if (sourceUrl) sources.add(sourceUrl);

      // Compute quality score
      const qualityScore = computeQuestionQuality(q);

      return {
        statement: String(q.statement).trim(),
        options: q.options.map(String),
        correct_index: q.correct_index,
        explanation: String(q.explanation || "").trim(),
        topic: specialty,
        subtopic: String(q.subtopic || "").trim(),
        difficulty: q.difficulty,
        source_url: sourceUrl,
        exam_info: String(q.exam_info || "").trim(),
        answer_source: q.answer_source,
        confidence_score: q.confidence_score,
        quality_score: qualityScore,
        statement_hash: q._hash,
      };
    });

    const { error: insertError } = await supabaseAdmin.from("real_exam_questions").insert(rows);
    if (insertError) {
      console.error("Insert real_exam_questions error:", insertError);
      // Try inserting one by one to skip duplicates
      let inserted = 0;
      for (const row of rows) {
        const { error: singleErr } = await supabaseAdmin.from("real_exam_questions").insert(row);
        if (!singleErr) inserted++;
      }
      log.questions_accepted = inserted;
    } else {
      log.questions_accepted = rows.length;
    }

    // Also insert into questions_bank for backward compatibility
    const adminUserId = await getAdminUserId(supabaseAdmin);
    if (adminUserId) {
      const bankRows = unique.map((q: any) => ({
        user_id: adminUserId,
        statement: String(q.statement).trim(),
        options: q.options.map(String),
        correct_index: q.correct_index ?? 0,
        explanation: `[Fonte: ${q.source_url || "web-scrape"}${q.exam_info ? ` | ${q.exam_info}` : ""}]\n\n${String(q.explanation || "").trim()}`,
        topic: specialty,
        difficulty: q.difficulty,
        source: "web-scrape",
        source_type: "indexed_external",
        permission_type: "indexed_external",
        source_url: q.source_url || "",
        is_global: true,
        review_status: "pending",
      }));

      const { error: bankErr } = await supabaseAdmin.from("questions_bank").insert(bankRows);
      if (bankErr) console.error("Insert questions_bank error:", bankErr);

      // Auto-generate flashcards
      const fcRows = unique.filter((q: any) => q.correct_index !== null).map((q: any) => {
        const correctOpt = String(q.options[q.correct_index] || "").replace(/^[A-E]\)\s*/, "");
        const stmt = String(q.statement).trim().slice(0, 300);
        return {
          user_id: adminUserId,
          question: stmt.length < String(q.statement).trim().length ? stmt + "... Qual a conduta/diagnóstico correto?" : stmt,
          answer: `✅ ${correctOpt}\n\n${q.explanation ? `📖 ${q.explanation}` : ""}`,
          topic: specialty,
          is_global: true,
        };
      });

      if (fcRows.length > 0) {
        const { error: fcErr } = await supabaseAdmin.from("flashcards").insert(fcRows);
        if (fcErr) console.error("Insert flashcards error:", fcErr);
        else console.log(`Created ${fcRows.length} flashcards`);
      }
    }

    log.sources_used = [...sources];

    // Update run log
    if (runId) {
      await supabaseAdmin.from("scraping_runs").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        ...log,
      }).eq("id", runId);
    }

    console.log(`=== PIPELINE COMPLETE: ${log.questions_accepted} accepted, ${log.questions_rejected} rejected, ${log.duplicates_found} dupes ===`);

    return new Response(JSON.stringify({
      success: true,
      specialty,
      auto: autoMode,
      questions_inserted: log.questions_accepted,
      sources_used: log.sources_used,
      pages_scraped: log.urls_tested,
      candidate_blocks: log.candidate_blocks_found,
      questions_extracted: log.questions_extracted,
      questions_rejected: log.questions_rejected,
      duplicates_found: log.duplicates_found,
      english_leaked: log.english_leaked,
      rejection_reasons: log.rejection_reasons,
      run_id: runId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Pipeline error:", e);
    if (runId) {
      await supabaseAdmin.from("scraping_runs").update({
        status: "error", finished_at: new Date().toISOString(),
        error_message: e instanceof Error ? e.message : "Unknown error",
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function computeQuestionQuality(q: any): number {
  let score = 0;
  const stmt = String(q.statement || "");

  // Statement length
  if (stmt.length >= 400) score += 0.25;
  else if (stmt.length >= 250) score += 0.15;

  // Has clinical markers
  if (hasClinicalContent(stmt)) score += 0.2;

  // Has confirmed gabarito
  if (q.answer_source === "explicit_gabarito") score += 0.25;
  else if (q.answer_source === "context_inferred") score += 0.1;

  // Confidence
  score += (q.confidence_score || 0) * 0.15;

  // Has exam info
  if (q.exam_info && q.exam_info.length > 3) score += 0.1;

  // Has explanation
  if (q.explanation && q.explanation.length > 20) score += 0.05;

  return Math.min(1, score);
}

async function getAdminUserId(supabaseAdmin: any): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  return data?.user_id || null;
}
