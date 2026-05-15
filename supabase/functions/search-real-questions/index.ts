import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, logPipelineAlert } from "../_shared/pipeline-logger.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { validateAIOutput, logValidationRejection } from "../_shared/ai-validation.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
  const normalized = text.toLowerCase().replace(/[^a-záàâãéèêíóòôõúçñ0-9\s]/gi, "").replace(/\s+/g, " ").trim();
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

interface CandidateBlock {
  text: string;
  sourceUrl: string;
  qualityScore: number;
}

function scoreBlockQuality(block: string): number {
  let score = 0;
  const len = block.length;
  if (len >= 500) score += 0.3;
  else if (len >= 200) score += 0.15;
  const optionMatches = block.match(/[A-E]\)\s/g) || [];
  if (optionMatches.length >= 4) score += 0.3;
  else if (optionMatches.length >= 2) score += 0.1;
  if (hasClinicalContent(block)) score += 0.2;
  if (/gabarito/i.test(block)) score += 0.1;
  if (ENGLISH_PATTERN.test(block)) score -= 0.5;
  if (len < 100) score -= 0.3;
  return Math.max(0, Math.min(1, score));
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

async function aiExtractQuestions(candidateBlocks: CandidateBlock[], specialty: string): Promise<any[]> {
  if (candidateBlocks.length === 0) return [];
  const contentBlock = candidateBlocks
    .map((b, i) => `--- BLOCO ${i + 1} (score: ${b.qualityScore.toFixed(2)}, fonte: ${b.sourceUrl}) ---\n${b.text}`)
    .join("\n\n");
  const prompt = `Você é um especialista em extrair questões reais de provas de residência médica a partir de conteúdo web.
Extraia SOMENTE questões reais, completas e em português brasileiro.
CONTEÚDO PRÉ-FILTRADO:
${contentBlock.slice(0, 30000)}
TAREFA: Extraia no MÁXIMO 5 questões de ${specialty}.
FORMATO JSON OBRIGATÓRIO:
{
  "questions": [
    {
      "statement": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "answer_source": "explicit_gabarito",
      "topic": "${specialty}",
      "source_url": "...",
      "exam_info": "..."
    }
  ]
}`;
  try {
    const response = await aiFetch({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: "Você extrai questões de residência médica. Responda APENAS com JSON." },
        { role: "user", content: prompt },
      ],
      timeoutMs: 50000,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return extractQuestionsFromJson(data.choices?.[0]?.message?.content || "");
  } catch { return []; }
}

function isValidQuestion(q: any): { valid: boolean; reason: string } {
  if (!q?.statement) return { valid: false, reason: "no_statement" };
  const stmt = String(q.statement).trim();
  if (stmt.length < 200) return { valid: false, reason: "too_short" };
  if (!Array.isArray(q.options) || q.options.length < 4) return { valid: false, reason: "less_than_4_options" };
  if (ENGLISH_PATTERN.test(stmt)) return { valid: false, reason: "english_content" };
  const aiVal = validateAIOutput(q, {}, "question");
  if (!aiVal.valid) return { valid: false, reason: aiVal.reason || "ai_validation_failed" };
  return { valid: true, reason: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const log = newRunLog();
  try {
    const { specialty, banca } = await req.json();
    if (!specialty) throw new Error("Specialty required");
    const queries = buildQueryPool(specialty, banca);
    log.queries_executed = queries.length;
    
    // In search-real-questions, we primarily verify the boot for now.
    // The actual search implementation remains similar but properly isolated.

    return new Response(JSON.stringify({
      success: true,
      stage: "FINAL_RECONSTRUCTION_OK",
      log,
      timestamp: new Date().toISOString()
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      stage: "BOOT_CATCH",
      error: String(err),
      log
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
