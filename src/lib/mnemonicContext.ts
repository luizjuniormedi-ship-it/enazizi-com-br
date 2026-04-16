import { supabase } from "@/integrations/supabase/client";
import type { MnemonicClinicalContext } from "@/types/mnemonics";

export interface MnemonicContextSuggestion {
  term: string;
  score: number;
  category: "user" | "clinical" | "exam" | "differential";
  sources: string[];
  reasons: string[];
}

export interface ExpandedMnemonicContext {
  theme: string;
  userTerms: string[];
  suggestedTerms: MnemonicContextSuggestion[];
  finalTerms: string[];
  clinicalContext: MnemonicClinicalContext;
}

type RankedTerm = {
  term: string;
  score: number;
  category: MnemonicContextSuggestion["category"];
  sources: Set<string>;
  reasons: Set<string>;
};

const MEDICAL_PATTERN = /(dor|troponina|st|ecg|eletro|supr[aá]|infra|conduta|crit[eé]rio|crit[eé]rios|achado|achados|diferencial|vs|irradia|sudorese|n[aá]usea|protein[uú]ria|albumina|ldh|glicose|edema|acidose|anion|ceto|fibrila[cç][aã]o|pleural|exsudato|transudato|tempo é músculo|instável|conduta inicial)/i;

function normalizeComparable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

export function dedupeTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of terms) {
    const term = raw.replace(/\s+/g, " ").trim();
    const key = normalizeComparable(term);
    if (!term || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }

  return result;
}

function isUsefulTerm(term: string, theme: string) {
  const normalized = normalizeComparable(term);
  if (!normalized || normalized.length < 3 || normalized.length > 48) return false;
  if (normalized === normalizeComparable(theme)) return false;
  return true;
}

function areTermsSimilar(a: string, b: string) {
  const na = normalizeComparable(a);
  const nb = normalizeComparable(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function addRankedTerm(store: Map<string, RankedTerm>, rawTerm: string, score: number, source: string, category: RankedTerm["category"], reason: string, theme: string) {
  const term = rawTerm.replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
  if (!isUsefulTerm(term, theme)) return;

  const key = normalizeComparable(term);
  const existing = store.get(key);
  if (existing) {
    existing.score += score;
    existing.sources.add(source);
    existing.reasons.add(reason);
    return;
  }

  store.set(key, {
    term,
    score,
    category,
    sources: new Set([source]),
    reasons: new Set([reason]),
  });
}

function extractPhrasesFromText(text: string): string[] {
  if (!text) return [];
  const chunks = text.replace(/[\n\r]+/g, " ").split(/[.;:!?]|\s+-\s+|\s+\/\s+/).map((chunk) => chunk.trim()).filter(Boolean);
  const candidates = new Set<string>();

  for (const chunk of chunks) {
    const words = chunk.split(" ").filter(Boolean);
    if (words.length >= 2 && words.length <= 6 && MEDICAL_PATTERN.test(chunk)) candidates.add(chunk);
    for (let size = 2; size <= 4; size += 1) {
      for (let i = 0; i <= words.length - size; i += 1) {
        const phrase = words.slice(i, i + size).join(" ").trim();
        if (phrase.length >= 6 && phrase.length <= 42 && MEDICAL_PATTERN.test(phrase)) candidates.add(phrase);
      }
    }
  }

  return [...candidates];
}

function extractTextFromJson(value: unknown, bucket: string[] = []): string[] {
  if (typeof value === "string") {
    bucket.push(value);
    return bucket;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractTextFromJson(item, bucket));
    return bucket;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => extractTextFromJson(item, bucket));
  }
  return bucket;
}

export function buildFinalMnemonicTerms(userTerms: string[], suggestedTerms: Array<Pick<MnemonicContextSuggestion, "term" | "score">>, limit = 7): string[] {
  const finalTerms = dedupeTerms(userTerms);
  for (const suggestion of [...suggestedTerms].sort((a, b) => b.score - a.score)) {
    if (finalTerms.length >= limit) break;
    if (finalTerms.some((term) => areTermsSimilar(term, suggestion.term))) continue;
    finalTerms.push(suggestion.term);
  }
  return finalTerms.slice(0, limit);
}

export async function expandMnemonicContext(theme: string, userTerms: string[]): Promise<ExpandedMnemonicContext> {
  const normalizedTheme = theme.split("—")[0].trim();
  const cleanUserTerms = dedupeTerms(userTerms);
  const rankedTerms = new Map<string, RankedTerm>();
  const subtopics = new Set<string>();
  const differentialTerms = new Set<string>();
  const examTerms = new Set<string>();
  const contextKeywords = new Set<string>();
  const usedSources = new Set<string>();

  cleanUserTerms.forEach((term) => addRankedTerm(rankedTerms, term, 120, "usuário", "user", "Termo digitado pelo usuário", normalizedTheme));

  const { data: { user } } = await supabase.auth.getUser();

  const [curriculumRes, questionsRes, realExamRes, flashcardsRes, mentalMapsRes, summariesRes, errorBankRes] = await Promise.all([
    supabase.from("curriculum_matrix").select("tema, subtema, gatilhos_clinicos, palavras_chave, tipo_cobranca, pre_requisitos").eq("ativo", true).or(`tema.ilike.%${normalizedTheme}%,subtema.ilike.%${normalizedTheme}%,palavras_chave.cs.{${normalizedTheme}}`).limit(8),
    supabase.from("questions_bank").select("topic, subtopic, statement, explanation, source_map_id").eq("review_status", "approved").or(`topic.ilike.%${normalizedTheme}%,subtopic.ilike.%${normalizedTheme}%,statement.ilike.%${normalizedTheme}%`).limit(12),
    supabase.from("real_exam_questions").select("topic, subtopic, statement, explanation, exam_info").eq("is_active", true).or(`topic.ilike.%${normalizedTheme}%,subtopic.ilike.%${normalizedTheme}%,statement.ilike.%${normalizedTheme}%`).limit(10),
    supabase.from("flashcards").select("topic, question, answer, source_map_id").or(`topic.ilike.%${normalizedTheme}%,question.ilike.%${normalizedTheme}%`).limit(10),
    (supabase.from("mental_maps" as any) as any).select("title, source_topic, tags, content_json, specialty").or(`title.ilike.%${normalizedTheme}%,source_topic.ilike.%${normalizedTheme}%`).limit(6),
    user ? supabase.from("summaries").select("topic, content").eq("user_id", user.id).or(`topic.ilike.%${normalizedTheme}%,content.ilike.%${normalizedTheme}%`).limit(6) : Promise.resolve({ data: [], error: null } as const),
    user ? supabase.from("error_bank").select("tema, subtema, conteudo, categoria_erro, vezes_errado").eq("user_id", user.id).eq("dominado", false).or(`tema.ilike.%${normalizedTheme}%,subtema.ilike.%${normalizedTheme}%,conteudo.ilike.%${normalizedTheme}%`).limit(10) : Promise.resolve({ data: [], error: null } as const),
  ]);

  for (const row of curriculumRes.data || []) {
    usedSources.add("curriculum_matrix");
    if (row.subtema) subtopics.add(row.subtema);
    (row.gatilhos_clinicos || []).forEach((term: string) => { addRankedTerm(rankedTerms, term, 38, "currículo", "clinical", "Gatilho clínico curricular", normalizedTheme); contextKeywords.add(term); });
    (row.palavras_chave || []).forEach((term: string) => { addRankedTerm(rankedTerms, term, 30, "currículo", "clinical", "Palavra-chave curricular", normalizedTheme); contextKeywords.add(term); });
    (row.pre_requisitos || []).forEach((term: string) => addRankedTerm(rankedTerms, term, 18, "currículo", "clinical", "Pré-requisito relacionado", normalizedTheme));
    (row.tipo_cobranca || []).forEach((term: string) => { const label = String(term).replace(/_/g, " "); addRankedTerm(rankedTerms, label, 16, "currículo", "exam", "Tipo de cobrança em prova", normalizedTheme); examTerms.add(label); });
  }

  for (const row of questionsRes.data || []) {
    usedSources.add("questions_bank");
    if (row.subtopic) subtopics.add(row.subtopic);
    if (row.topic) contextKeywords.add(row.topic);
    extractPhrasesFromText(`${row.statement || ""}. ${row.explanation || ""}`).slice(0, 6).forEach((term) => addRankedTerm(rankedTerms, term, 14, "questões", "clinical", "Achado frequente em questões", normalizedTheme));
  }

  for (const row of realExamRes.data || []) {
    usedSources.add("real_exam_questions");
    if (row.subtopic) subtopics.add(row.subtopic);
    if (row.topic) contextKeywords.add(row.topic);
    extractPhrasesFromText(`${row.statement || ""}. ${row.explanation || ""}. ${row.exam_info || ""}`).slice(0, 8).forEach((term) => {
      const category = /vs|diferencial|instável|conduta|critério/i.test(term) ? "exam" : "clinical";
      addRankedTerm(rankedTerms, term, 20, "provas reais", category, "Incidência em prova real", normalizedTheme);
      if (/vs|diferencial|instável/i.test(term)) differentialTerms.add(term);
      if (/conduta|critério|achado/i.test(term)) examTerms.add(term);
    });
  }

  for (const row of flashcardsRes.data || []) {
    usedSources.add("flashcards");
    if (row.topic) contextKeywords.add(row.topic);
    extractPhrasesFromText(`${row.question || ""}. ${row.answer || ""}`).slice(0, 6).forEach((term) => addRankedTerm(rankedTerms, term, 12, "flashcards", "clinical", "Termo recorrente em flashcards", normalizedTheme));
  }

  for (const row of (mentalMapsRes.data || []) as Array<{ title?: string; source_topic?: string; tags?: string[]; content_json?: unknown }>) {
    usedSources.add("mapas mentais");
    if (row.source_topic) subtopics.add(row.source_topic);
    if (row.title) addRankedTerm(rankedTerms, row.title, 16, "mapas mentais", "clinical", "Tema relacionado em mapa mental", normalizedTheme);
    (row.tags || []).forEach((tag) => { addRankedTerm(rankedTerms, tag, 14, "mapas mentais", "clinical", "Tag de mapa mental", normalizedTheme); contextKeywords.add(tag); });
    extractTextFromJson(row.content_json).flatMap((chunk) => extractPhrasesFromText(chunk)).slice(0, 8).forEach((term) => addRankedTerm(rankedTerms, term, 10, "mapas mentais", "clinical", "Conceito de mapa mental", normalizedTheme));
  }

  for (const row of summariesRes.data || []) {
    usedSources.add("resumos");
    if (row.topic) contextKeywords.add(row.topic);
    extractPhrasesFromText(row.content || "").slice(0, 6).forEach((term) => addRankedTerm(rankedTerms, term, 10, "resumos", "clinical", "Resumo do usuário", normalizedTheme));
  }

  for (const row of errorBankRes.data || []) {
    usedSources.add("error_bank");
    if (row.subtema) subtopics.add(row.subtema);
    addRankedTerm(rankedTerms, row.subtema || row.tema, 24 + Math.min((row.vezes_errado || 0) * 2, 16), "banco de erros", "clinical", "Tema com maior recorrência de erro", normalizedTheme);
    if (row.categoria_erro) { addRankedTerm(rankedTerms, row.categoria_erro, 16, "banco de erros", "exam", "Categoria de erro recorrente", normalizedTheme); examTerms.add(row.categoria_erro); }
    extractPhrasesFromText(row.conteudo || "").slice(0, 6).forEach((term) => {
      addRankedTerm(rankedTerms, term, 16 + Math.min((row.vezes_errado || 0), 8), "banco de erros", /vs|diferencial/i.test(term) ? "differential" : "clinical", "Achado vindo do banco de erros", normalizedTheme);
      if (/vs|diferencial|instável/i.test(term)) differentialTerms.add(term);
    });
  }

  const suggestedTerms = [...rankedTerms.values()].sort((a, b) => b.score - a.score).map((item) => ({ term: item.term, score: item.score, category: item.category, sources: [...item.sources], reasons: [...item.reasons] }));
  const finalTerms = buildFinalMnemonicTerms(cleanUserTerms, suggestedTerms);

  return {
    theme: normalizedTheme,
    userTerms: cleanUserTerms,
    suggestedTerms,
    finalTerms,
    clinicalContext: {
      tema_principal: normalizedTheme,
      subtopicos_relacionados: dedupeTerms([...subtopics]).slice(0, 6),
      palavras_chave: dedupeTerms([...contextKeywords, ...suggestedTerms.filter((term) => term.category !== "differential").map((term) => term.term)]).slice(0, 8),
      diferenciais_relevantes: dedupeTerms([...differentialTerms]).slice(0, 6),
      termos_de_prova: dedupeTerms([...examTerms]).slice(0, 6),
      fontes_utilizadas: [...usedSources],
    },
  };
}