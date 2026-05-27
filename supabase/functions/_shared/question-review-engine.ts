/**
 * ENAZIZI ENTERPRISE — Question Review Engine
 * Audita, classifica e enriquece questões médicas.
 * Plano Agressivo: força gpt-4o-mini, retorna campos adicionais (is_clinical_case, tri_difficulty_score, guideline_year).
 */

import { callAi } from "./enterprise-edge/ai-router.ts";
import { parseAiJson, sanitizeAiContent } from "./enterprise-edge/parse-ai-json.ts";
import { StructuredLogger } from "./enterprise-edge/structured-logger.ts";
import { getBancaProfile } from "./banca-profiles.ts";

export interface ReviewResult {
  quality_tier: "GOLD" | "SILVER" | "BASIC" | "REJECTED";
  statement: string;
  options: any[];
  correct_index: number;
  explanation: string;
  scores: {
    clinical_density_score: number;
    reasoning_score: number;
    distractor_quality_score: number;
    guideline_score: number;
    board_similarity_score: number;
    cognitive_complexity_score: number;
    realism_score: number;
  };
  flashcards: Array<{ question: string; answer: string; explanation: string }>;
  banca_style_detected: string;
  guideline_reference?: string;
  guideline_year?: number;
  is_clinical_case?: boolean;
  tri_difficulty_score?: number;
  tokens_in?: number;
  tokens_out?: number;
}

export async function reviewAndEnrich(
  question: any,
  targetBanca: string | null,
  logger: StructuredLogger,
  supabaseAdmin: any
): Promise<ReviewResult> {
  const bancaProfile = getBancaProfile(targetBanca || question.board);

  const systemPrompt = `Você é um PRECEPTOR DE RESIDÊNCIA MÉDICA DE ELITE (ENARE, USP, UNICAMP).
Execute o QUESTION_REVIEW_MODE ENTERPRISE.

OBJETIVO:
1. Auditar qualidade técnica e pedagógica.
2. Classificar como GOLD, SILVER, BASIC ou REJECTED.
3. Se abaixo de GOLD, ENRIQUECER para GOLD (caso clínico denso, sinais vitais, lab, diferenciais).
4. Citar SEMPRE guideline 2023/2024/2025 (Nelson, Sabiston, SBP, ESC, AHA, NICE, UpToDate).

REGRAS RÍGIDAS:
- Enunciado >= 400 caracteres (caso clínico).
- Explicação >= 200 caracteres com blocos: correta / erradas / guideline / diferencial / ponto de prova.
- 4 a 5 alternativas plausíveis.
- Estritamente pt-BR. SEM "however", "therefore", inglês ou LaTeX.
- is_clinical_case=true quando houver paciente, idade, queixa, exame, conduta.
- tri_difficulty_score: 1 (fácil) a 5 (muito difícil) seguindo modelo 3PL.

SAÍDA OBRIGATÓRIA (JSON puro, sem markdown):
{
  "quality_tier": "GOLD|SILVER|BASIC|REJECTED",
  "statement": "Enunciado enriquecido >= 400 chars",
  "options": ["A","B","C","D","E"],
  "correct_index": 0,
  "explanation": ">= 200 chars com bibliografia",
  "scores": {
    "clinical_density_score": 0-100,
    "reasoning_score": 0-100,
    "distractor_quality_score": 0-100,
    "guideline_score": 0-100,
    "board_similarity_score": 0-100,
    "cognitive_complexity_score": 0-100,
    "realism_score": 0-100
  },
  "flashcards": [{"question":"...","answer":"...","explanation":"..."}],
  "banca_style_detected": "...",
  "guideline_reference": "Fonte (ex: Nelson 22ª ed)",
  "guideline_year": 2024,
  "is_clinical_case": true,
  "tri_difficulty_score": 3
}`;

  const userPrompt = `QUESTÃO ORIGINAL:
Enunciado: ${question.statement}
Alternativas: ${JSON.stringify(question.options)}
Explicação Atual: ${question.explanation || "(vazia)"}
Banca Alvo: ${bancaProfile.label} (${bancaProfile.style})

Transforme em PADRÃO OURO. Se irremediavelmente ruim, marque REJECTED.`;

  const response = await callAi({
    taskType: "generation",
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 3500,
    temperature: 0.1,
    response_format: { type: "json_object" }
  }, logger, supabaseAdmin);

  const rawContent = response.choices?.[0]?.message?.content || "";
  const result = parseAiJson<ReviewResult>(rawContent);

  result.statement = sanitizeAiContent(result.statement);
  result.explanation = sanitizeAiContent(result.explanation);
  result.tokens_in = response.usage?.prompt_tokens || 0;
  result.tokens_out = response.usage?.completion_tokens || 0;

  return result;
}
