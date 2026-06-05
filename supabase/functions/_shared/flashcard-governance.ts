/**
 * ENAZIZI — FLASHCARD GOVERNANCE (Fase 1 P0)
 *
 * Quality gate + clamp + daily limit + zero-orphan guarantee.
 *
 * Diretivas:
 *  - quantity nunca > 15
 *  - cards triviais rejeitados (sem contexto / respostas genéricas)
 *  - limite diário server-side por user_id (50 default, admin/professor bypass)
 *  - todo insert em `flashcards` DEVE ter inserção paralela em `fsrs_cards`
 *    com rollback do insert se a etapa FSRS falhar.
 */

export const FLASHCARD_GOV_VERSION = "P1-2026-06-05-PREMIUM";
export const FLASHCARD_MAX_QUANTITY = 15;
export const FLASHCARD_DAILY_LIMIT_DEFAULT = 50;

// REGRAS PREMIUM - ATOMICIDADE
export const FLASHCARD_IDEAL_QUESTION_LEN = 120;
export const FLASHCARD_MAX_QUESTION_LEN = 180;
export const FLASHCARD_IDEAL_ANSWER_WORDS = 20;
export const FLASHCARD_MAX_ANSWER_WORDS = 40;
export const FLASHCARD_MIN_QUESTION_LEN = 20; // Reduzido para permitir Cloze curtos
export const FLASHCARD_MIN_ANSWER_LEN = 3;    // Reduzido para permitir respostas atômicas como "Sim", "Não", "1 hora"


// Respostas genéricas / triviais rejeitadas automaticamente.
const BANNED_PATTERNS: RegExp[] = [
  /(A\)|B\)|C\)|D\)|alternativa|opção|assinale|marque|correta|incorreta|letra [a-d]|caso clínico)/i,
  /^\s*(sim|n[aã]o|talvez|verdadeiro|falso)\s*\.?\s*$/i,
  /^\s*todas?\s+as?\s+(alternativas|op[cç][õo]es|anteriores)\s*\.?\s*$/i,
  /^\s*nenhuma?\s+das?\s+(alternativas|op[cç][õo]es|anteriores)\s*\.?\s*$/i,
];

const GENERIC_QUESTION_PATTERNS: RegExp[] = [
  /^defina\s+\w+\s*\.?$/i,
  /^conceito de\s+\w+\s*\.?$/i,
];

export type FlashcardCandidate = {
  question?: string;
  answer?: string;
  explanation?: string;
  [k: string]: unknown;
};

export type QualityResult = {
  ok: boolean;
  reason?: string;
};

export function clampQuantity(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(Math.max(Math.floor(n), 1), FLASHCARD_MAX_QUANTITY);
}

function normalize(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function validateFlashcardQuality(card: FlashcardCandidate): QualityResult {
  const question = (card.question ?? "").toString().trim();
  const answer = (card.answer ?? "").toString().trim();
  const answerWords = answer.split(/\s+/).length;

  // 1. Duração/Tamanho
  if (question.length < FLASHCARD_MIN_QUESTION_LEN) {
    return { ok: false, reason: `question_too_short(${question.length})` };
  }
  if (question.length > FLASHCARD_MAX_QUESTION_LEN) {
    return { ok: false, reason: `question_too_long(${question.length})` };
  }
  if (answerWords > FLASHCARD_MAX_ANSWER_WORDS) {
    return { ok: false, reason: `answer_too_long(${answerWords} words)` };
  }

  // 2. Proibições (Questão disfarçada)
  for (const re of BANNED_PATTERNS) {
    if (re.test(question) || re.test(answer)) {
      return { ok: false, reason: "banned_pattern_question_detected" };
    }
  }

  for (const re of GENERIC_QUESTION_PATTERNS) {
    if (re.test(question)) return { ok: false, reason: "trivial_question_pattern" };
  }

  // 3. Score de Qualidade (Heurística)
  const atomicityScore = question.length <= FLASHCARD_IDEAL_QUESTION_LEN ? 1.0 : 0.6;
  const answerScore = answerWords <= FLASHCARD_IDEAL_ANSWER_WORDS ? 1.0 : 0.7;
  const overallScore = (atomicityScore + answerScore) / 2;

  if (overallScore < 0.75) {
    return { ok: false, reason: `low_quality_score(${overallScore.toFixed(2)})` };
  }

  // 4. Contexto Clínico (Sinal)
  const hasClinicalSignal = /(paciente|choque|sepse|ic|dor|sinal|sintoma|diagn[oó]stico|tratamento|exame|conduta|prescrev|indica|contraindica|complica|fisiopatolog|manejo|prognost|est[áa]|dose|via|droga|medica)/i.test(question + " " + answer);
  if (!hasClinicalSignal) {
    return { ok: false, reason: "missing_clinical_context" };
  }

  return { ok: true };
}

export function dedupeBatch(cards: FlashcardCandidate[]): FlashcardCandidate[] {
  const seen = new Set<string>();
  const out: FlashcardCandidate[] = [];
  for (const c of cards) {
    const key = normalize((c.question ?? "").toString()).slice(0, 120);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

/**
 * Filtra batch de cards aplicando dedup + quality gate.
 * Retorna { accepted, rejected } para telemetria.
 */
export function applyQualityGate(cards: FlashcardCandidate[]): {
  accepted: FlashcardCandidate[];
  rejected: Array<{ reason: string; preview: string }>;
} {
  const accepted: FlashcardCandidate[] = [];
  const rejected: Array<{ reason: string; preview: string }> = [];
  const deduped = dedupeBatch(cards);

  for (const c of deduped) {
    const res = validateFlashcardQuality(c);
    if (res.ok) accepted.push(c);
    else rejected.push({ reason: res.reason ?? "unknown", preview: (c.question ?? "").toString().slice(0, 80) });
  }
  return { accepted, rejected };
}

/**
 * Verifica limite diário server-side. Admins e professores bypassam.
 * Conta APENAS cards criados nas últimas 24h.
 *
 * Retorna { allowed: boolean, used, limit, role }.
 */
export async function checkDailyFlashcardLimit(
  supabaseAdmin: any,
  userId: string,
  limitOverride?: number,
): Promise<{ allowed: boolean; used: number; limit: number; bypass: boolean }> {
  // role bypass
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const bypass = Array.isArray(roles) && roles.some((r: any) => r.role === "admin" || r.role === "professor");
  if (bypass) {
    return { allowed: true, used: 0, limit: -1, bypass: true };
  }

  const limit = limitOverride ?? FLASHCARD_DAILY_LIMIT_DEFAULT;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  const used = count ?? 0;
  return { allowed: used < limit, used, limit, bypass: false };
}

/**
 * Insere flashcards + fsrs_cards de forma atômica-lógica:
 *   - insere flashcards
 *   - tenta inserir fsrs_cards correspondentes
 *   - se fsrs falhar: DELETA flashcards inseridos (rollback) e lança erro.
 *
 * Garante zero novos órfãos pós Fase 1.
 */
export async function insertFlashcardsWithFsrs(
  supabaseAdmin: any,
  rows: Array<Record<string, unknown>>,
  opts: {
    userId: string;
    topic?: string | null;
    discipline?: string | null;
    deckId?: string | null;
    difficultyByQuestion?: Map<string, number>;
  },
): Promise<{ flashcards: any[]; fsrsCount: number }> {
  if (!rows.length) return { flashcards: [], fsrsCount: 0 };

  const { data: insertedFlashcards, error: flashError } = await supabaseAdmin
    .from("flashcards")
    .insert(rows)
    .select();

  if (flashError || !insertedFlashcards) {
    throw flashError ?? new Error("flashcard_insert_failed");
  }

  const fsrsRows = insertedFlashcards.map((f: any) => ({
    user_id: opts.userId,
    deck_id: opts.deckId ?? undefined,
    front: f.question,
    back: f.answer,
    explanation: f.explanation,
    topic: opts.topic ?? f.topic ?? null,
    discipline: opts.discipline ?? null,
    difficulty: opts.difficultyByQuestion?.get(f.question) ?? 3,
    due: new Date().toISOString(),
    stability: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    card_type: "flashcard",
    card_ref_id: f.id,
  }));

  const { error: fsrsError } = await supabaseAdmin.from("fsrs_cards").insert(fsrsRows);

  if (fsrsError) {
    // ROLLBACK — não deixar órfãos
    const ids = insertedFlashcards.map((f: any) => f.id);
    await supabaseAdmin.from("flashcards").delete().in("id", ids);
    throw new Error(`fsrs_insert_failed_rolled_back: ${fsrsError.message}`);
  }

  return { flashcards: insertedFlashcards, fsrsCount: fsrsRows.length };
}
