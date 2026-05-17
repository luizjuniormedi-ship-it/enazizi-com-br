/**
 * ENAZIZI ENTERPRISE — Question Review Engine
 * Handles the logic for auditing, classifying, and enriching medical questions.
 */

import { AiModelName, ALLOWED_MODELS } from "./ai-model-registry.ts";
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
  flashcards: Array<{
    question: string;
    answer: string;
    explanation: string;
  }>;
  banca_style_detected: string;
  guideline_reference?: string;
}

export async function reviewAndEnrich(
  question: any,
  targetBanca: string | null,
  logger: StructuredLogger,
  supabaseAdmin: any
): Promise<ReviewResult> {
  const bancaProfile = getBancaProfile(targetBanca || question.board);
  
  const systemPrompt = `Você é um PRECEPTOR DE RESIDÊNCIA MÉDICA DE ELITE (ENARE, USP, UNICAMP).
Sua missão é executar o QUESTION_REVIEW_MODE ENTERPRISE.

OBJETIVO:
1. Auditar a qualidade técnica e pedagógica da questão.
2. Classificar como GOLD, SILVER, BASIC ou REJECTED.
3. Se abaixo de GOLD, executar ENRIQUECIMENTO COMPLETO para torná-la GOLD.
4. Garantir densidade clínica, raciocínio profundo e alternativas plausíveis (padrão banca real).

REGRAS DE OURO:
- GOLD: Caso clínico denso, sinais vitais, laboratório, diferenciais, guideline 2024/2025.
- SILVER: Boa qualidade, mas falta profundidade.
- BASIC: Superficial, genérica.
- REJECTED: Errada, incoerente ou IA rasa.

SAÍDA OBRIGATÓRIA (JSON):
{
  "quality_tier": "GOLD | SILVER | BASIC | REJECTED",
  "statement": "Enunciado enriquecido (se necessário)",
  "options": ["A", "B", "C", "D", "E"],
  "correct_index": 0,
  "explanation": "Explicação padrão preceptor (blocos: correta, erradas, guideline, diferencial, ponto de prova)",
  "scores": {
    "clinical_density_score": 0-100,
    "reasoning_score": 0-100,
    "distractor_quality_score": 0-100,
    "guideline_score": 0-100,
    "board_similarity_score": 0-100,
    "cognitive_complexity_score": 0-100,
    "realism_score": 0-100
  },
  "flashcards": [
    {"question": "...", "answer": "...", "explanation": "..."}
  ],
  "banca_style_detected": "Estilo detectado",
  "guideline_reference": "Fonte/Ano"
}`;

  const userPrompt = `QUESTÃO ORIGINAL:
Enunciado: ${question.statement}
Alternativas: ${JSON.stringify(question.options)}
Explicação Atual: ${question.explanation}
Banca Alvo: ${bancaProfile.label} (${bancaProfile.style})

Analise e transforme em PADRÃO OURO. Se a questão for irremediavelmente ruim, marque como REJECTED.`;

  const response = await callAi({
    model: ALLOWED_MODELS.reasoning,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 3000,
    temperature: 0.7
  }, logger, supabaseAdmin);

  const rawContent = response.choices?.[0]?.message?.content || "";
  const result = parseAiJson<ReviewResult>(rawContent);

  // Post-processing: ensure sanitization
  result.statement = sanitizeAiContent(result.statement);
  result.explanation = sanitizeAiContent(result.explanation);
  
  return result;
}
