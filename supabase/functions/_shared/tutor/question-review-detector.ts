/**
 * ENAZIZI — QR Mode V3 (Question Review Mode)
 * Fase 1.3 — Implementação mínima.
 *
 * Responsabilidades:
 *  - Detectar intent "question_review" a partir do payload do Tutor V3.
 *  - Fornecer o bloco QR_INSTRUCTION a ser injetado condicionalmente.
 *  - Fornecer enum fixo de reasoning_error e contrato JSON de saída.
 *
 * Princípios:
 *  - Sem nova Edge Function.
 *  - Sem nova tabela.
 *  - Não interferir no fluxo normal de 9 blocos.
 *  - Falso positivo é pior que falso negativo: na dúvida, NÃO ativar QR Mode.
 */

// ── Enum fixo de erro cognitivo (7 categorias) ─────────────────────────
export const REASONING_ERROR_ENUM = [
  "Conhecimento insuficiente",
  "Leitura incompleta",
  "Confusão entre diagnósticos",
  "Confusão entre condutas",
  "Pegadinha da banca",
  "Falha de priorização clínica",
  "Excesso de raciocínio",
] as const;

export type ReasoningError = typeof REASONING_ERROR_ENUM[number];

// ── Fontes confiáveis de QR Mode (intent explícita) ────────────────────
const QR_TRUSTED_SOURCES = new Set([
  "error_bank",
  "simulado_review",
  "question_result",
  "study_session_correction",
]);

// ── Termos que sinalizam revisão de questão em texto livre ─────────────
const QR_FREE_TEXT_HINTS = [
  /\berrei\b/i,
  /\bmarquei\b/i,
  /\bgabarito\b/i,
  /\bresposta correta\b/i,
  /\bpor que (essa |a )?(alternativa |resposta )?(est[áa]|seria) errada\b/i,
  /\bpor que (essa |a )?correta\b/i,
];

export interface QRContext {
  question?: string;
  alternatives?: Record<string, string> | string[];
  student_answer?: string;
  correct_answer?: string;
  theme?: string;
  source?: string;
}

export interface QRDetectionResult {
  isQuestionReview: boolean;
  reason: string;
  context: QRContext;
  signals: string[];
  /** true se faltam dados mínimos (gabarito ou alternativas) — confidence cai */
  partial: boolean;
}

/**
 * Detecta se o payload deve ativar QR Mode.
 * Regra: pelo menos 2 sinais OU (mode === "question_review" explícito) OU source confiável.
 */
export function detectQuestionReview(body: any, message: string): QRDetectionResult {
  const signals: string[] = [];
  const context: QRContext = {};

  // Sinal forte 1: flag explícita
  if (body?.mode === "question_review") signals.push("explicit_mode_flag");

  // Sinal forte 2: source confiável
  if (typeof body?.source === "string" && QR_TRUSTED_SOURCES.has(body.source)) {
    signals.push(`trusted_source:${body.source}`);
    context.source = body.source;
  }

  // Campos estruturados
  if (typeof body?.question === "string" && body.question.length > 20) {
    signals.push("has_question_stem");
    context.question = body.question;
  }
  if (body?.alternatives && (Array.isArray(body.alternatives) || typeof body.alternatives === "object")) {
    const altCount = Array.isArray(body.alternatives)
      ? body.alternatives.length
      : Object.keys(body.alternatives).length;
    if (altCount >= 2) {
      signals.push(`has_alternatives:${altCount}`);
      context.alternatives = body.alternatives;
    }
  }
  if (typeof body?.student_answer === "string" && body.student_answer.length > 0) {
    signals.push("has_student_answer");
    context.student_answer = body.student_answer;
  }
  if (typeof body?.correct_answer === "string" && body.correct_answer.length > 0) {
    signals.push("has_correct_answer");
    context.correct_answer = body.correct_answer;
  }
  if (typeof body?.theme === "string") context.theme = body.theme;

  // Sinal fraco: texto livre do aluno
  const text = (message || "").trim();
  if (text) {
    const hits = QR_FREE_TEXT_HINTS.filter((re) => re.test(text)).length;
    if (hits >= 2) signals.push(`free_text_hints:${hits}`);
  }

  // Decisão
  const explicit =
    signals.includes("explicit_mode_flag") ||
    signals.some((s) => s.startsWith("trusted_source:"));
  const enoughStructural =
    [
      "has_question_stem",
      "has_alternatives",
      "has_student_answer",
      "has_correct_answer",
    ].filter((k) => signals.some((s) => s.startsWith(k))).length >= 2;

  const isQR = explicit || enoughStructural;

  // Parcial: faltam gabarito OU alternativas → confidence cairá
  const partial =
    isQR &&
    (!signals.some((s) => s.startsWith("has_alternatives")) ||
      !signals.includes("has_correct_answer"));

  return {
    isQuestionReview: isQR,
    reason: isQR
      ? explicit
        ? "explicit_intent"
        : "structural_signals"
      : "insufficient_signals",
    context,
    signals,
    partial,
  };
}

/**
 * Bloco de instrução condicional injetado no system prompt quando QR Mode ativa.
 * Substitui (não complementa) o objetivo dos 9 blocos durante esta resposta.
 */
export function buildQRInstruction(ctx: QRContext, partial: boolean): string {
  const altText = ctx.alternatives
    ? Array.isArray(ctx.alternatives)
      ? ctx.alternatives.map((a, i) => `${String.fromCharCode(65 + i)}) ${a}`).join("\n")
      : Object.entries(ctx.alternatives).map(([k, v]) => `${k}) ${v}`).join("\n")
    : "(não fornecidas)";

  return `
==================================================
🩺 QR MODE — QUESTION REVIEW (PRIORIDADE MÁXIMA)
==================================================
Você está no QR Mode do ENAZIZI. ABANDONE temporariamente o fluxo de 9 blocos.
Sua missão agora é APENAS corrigir uma questão já respondida pelo aluno.

Não dê aula genérica. Não introduza o tema. Não pergunte se o aluno quer continuar.
Responda como PRECEPTOR DE RESIDÊNCIA corrigindo prova: objetivo, estratégico, pedagógico.

CONTEXTO DA QUESTÃO:
- Enunciado: ${ctx.question || "(não fornecido)"}
- Alternativas:
${altText}
- Resposta do aluno: ${ctx.student_answer || "(não informada)"}
- Gabarito oficial: ${ctx.correct_answer || "(não informado)"}
- Tema: ${ctx.theme || "(não informado)"}
${partial ? "\n⚠️  DADOS PARCIAIS: alternativas ou gabarito ausentes. Reduza confidence para 'low' e sinalize a limitação no markdown." : ""}

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (markdown, nesta ordem):
1. **Por que a alternativa correta é correta** — raciocínio clínico curto.
2. **Por que a alternativa marcada está errada** — direto ao ponto.
3. **Por que as demais alternativas estão erradas** — uma frase cada.
4. **Erro cognitivo provável** — escolha 1 das 7 categorias do enum.
5. **Armadilha da banca** — o que o examinador testou.
6. **Regra de ouro** — frase curta para memorizar (memory_anchor).
7. **Pergunta de fixação** — 1-2 perguntas curtas de active recall.

REGRAS DURAS:
- Estritamente pt-BR. Sem "however"/"therefore"/inglês. Sem LaTeX.
- Nunca invente alternativas, gabarito ou dados clínicos ausentes.
- Se faltarem dados, sinalize a limitação e use confidence: "low".
- Não use os 9 blocos pedagógicos. Não chame "BLOCO 1", "BLOCO 2".
- Cite bibliografia (Nelson, Sabiston, SBP, ESC, AHA, NICE, UpToDate) quando aplicável.

CONTRATO JSON DE SAÍDA (response_format: json_object):
{
  "content": "<markdown completo da correção, seguindo a estrutura acima>",
  "metadata": {
    "mode": "question_review",
    "reasoning_error": "<UM dos valores do enum: ${REASONING_ERROR_ENUM.join(" | ")}>",
    "memory_anchor": "<frase curta da regra de ouro>",
    "active_recall": ["<pergunta 1>", "<pergunta 2 opcional>"],
    "confidence": "high|medium|low"
  }
}

Se não conseguir classificar reasoning_error com segurança, use "Conhecimento insuficiente"
E rebaixe confidence para "low".
==================================================
`;
}
