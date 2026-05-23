/**
 * Client-side auto-retry safety net for mnemonic generation.
 *
 * The edge function already runs up to 3 internal validation attempts.
 * This wrapper adds a final client-side validation guardrail to prevent
 * any low-quality result from ever reaching the UI, plus 1 extra retry
 * with a stronger hint if validation fails on the client side.
 */
import { generateMnemonic } from "@/services/mnemonics";
import type { MnemonicResultData } from "@/types/mnemonics";

export type RetryMode = "normal" | "retry_stronger" | "retry_simplified";

export interface GenerateMnemonicInput {
  tema: string;
  termos: string[];
  estilo?: string;
  publico?: string;
}

export interface GenerateMnemonicOutput {
  success: boolean;
  data?: MnemonicResultData;
  error?: string;
  code?: string;
}

interface ValidationOptions {
  inputTerms: string[];
  requireScene?: boolean;
}

/**
 * Validates that a mnemonic result is coherent and useful enough to display.
 */
export function isValidMnemonicResult(
  data: any,
  options: ValidationOptions
): boolean {
  if (!data || typeof data !== "object") {
    console.warn("[MNEMONIC_VALIDATION] Data is not an object:", data);
    return false;
  }

  const frase = String(data.frase_mnemonica ?? "").trim();
  const explicacao = String(
    data.explicacao_associacao ?? data.explicacao_didatica ?? ""
  ).trim();
  const cena = String(data.cena_visual ?? "").trim();
  const score = Number(data.score_final ?? 0);

  if (frase.length < 6) {
    console.warn("[MNEMONIC_VALIDATION] Phrase too short:", frase.length);
    return false;
  }
  if (explicacao.length < 20) {
    console.warn("[MNEMONIC_VALIDATION] Explanation too short:", explicacao.length);
    return false;
  }
  if (score <= 0) {
    console.warn("[MNEMONIC_VALIDATION] Score is zero or missing:", score);
    return false;
  }
  if (options.requireScene && cena.length < 12) {
    console.warn("[MNEMONIC_VALIDATION] Scene too short:", cena.length);
    return false;
  }

  // Eco literal: frase é igual à junção dos termos
  // Quando rodamos em modo automático (termos vazios no input do usuário),
  // não há base para comparar eco-token, então pulamos esse check.
  if (options.inputTerms.length === 0) {
    return true;
  }

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

  const normalizedPhrase = normalize(frase).replace(/^lembre[:\s-]*/i, "").trim();
  const normalizedTerms = options.inputTerms.map(normalize);

  if (normalizedTerms.includes(normalizedPhrase)) {
    console.warn("[MNEMONIC_VALIDATION] Phrase is identical to one of the terms.");
    return false;
  }

  // Eco token: todos os tokens da frase já são termos
  const phraseTokens = normalizedPhrase.split(/\s+/).filter(Boolean);
  const termTokens = new Set(
    normalizedTerms.flatMap((t) => t.split(/\s+/).filter(Boolean))
  );
  const nonEchoTokens = phraseTokens.filter((tok) => !termTokens.has(tok));
  if (phraseTokens.length > 0 && nonEchoTokens.length === 0) {
    console.warn("[MNEMONIC_VALIDATION] Phrase only contains tokens from input terms.");
    return false;
  }

  return true;
}

/**
 * Single attempt — calls the edge function with optional retry hint.
 */
async function generateOnce(
  input: GenerateMnemonicInput,
  mode: RetryMode,
  lastBadResult?: any
): Promise<GenerateMnemonicOutput> {
  const previousIssues: string[] = [];
  if (lastBadResult) {
    const frase = String(lastBadResult.frase_mnemonica ?? "").trim();
    if (!frase) previousIssues.push("frase vazia");
    else if (frase.length < 6) previousIssues.push("frase curta demais");
    if (
      !String(
        lastBadResult.explicacao_associacao ?? lastBadResult.explicacao_didatica ?? ""
      ).trim()
    )
      previousIssues.push("explicação ausente");
    if (Number(lastBadResult.score_final ?? 0) <= 0)
      previousIssues.push("score inválido");
  }

  const retryHint =
    mode === "normal"
      ? ""
      : mode === "retry_stronger"
      ? `A versão anterior falhou. Problemas: ${
          previousIssues.join(", ") || "incoerente"
        }. Gere algo MAIS memorável, mais natural em PT-BR, sem repetir literalmente os termos.`
      : `As versões anteriores falharam. Simplifique: priorize uma frase curta, forte e coerente. NÃO invente frase confusa. NÃO repita os termos.`;

  // Use the service layer (handles mapping + edge-function error decoding)
  const res = await generateMnemonic({
    ...input,
    // pass retry hint via estilo suffix so it's preserved through the existing service
    estilo: input.estilo
      ? `${input.estilo}${retryHint ? ` | RETRY_HINT: ${retryHint}` : ""}`
      : retryHint
      ? `RETRY_HINT: ${retryHint}`
      : undefined,
  } as any);

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error || "Falha ao gerar mnemônico.",
      code: "GENERATION_FAILED",
    };
  }

  return { success: true, data: res.data };
}

/**
 * Generates a mnemonic with auto-retry until validation passes.
 * The edge function already retries internally up to 3x; this wrapper
 * adds a final client-side safety net + 1 extra "stronger" retry.
 */
export async function generateWithAutoRetry(
  input: GenerateMnemonicInput,
  onStatus?: (msg: string) => void
): Promise<GenerateMnemonicOutput> {
  const attempts: RetryMode[] = ["normal", "retry_stronger"];
  let lastBadResult: any = null;

  for (let i = 0; i < attempts.length; i++) {
    onStatus?.(
      i === 0
        ? "Gerando mnemônico..."
        : "Refinando o mnemônico para melhorar a qualidade..."
    );

    const result = await generateOnce(input, attempts[i], lastBadResult);

    if (!result.success || !result.data) {
      // Edge function failed entirely — return real error (no fake fallback)
      if (i === attempts.length - 1) return result;
      lastBadResult = result.data ?? null;
      continue;
    }

    if (
      isValidMnemonicResult(result.data, {
        inputTerms: input.termos,
        requireScene: true,
      })
    ) {
      return result;
    }

    lastBadResult = result.data;
  }

  return {
    success: false,
    error: "Não foi possível gerar um mnemônico válido. Tente novamente.",
    code: "AUTO_RETRY_FAILED",
  };
}
