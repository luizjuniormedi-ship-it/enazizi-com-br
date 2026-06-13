/**
 * Safe JSON extractor para respostas de LLM (especialmente Claude via eu-ai).
 * Tenta múltiplas estratégias antes de desistir.
 *
 * Ordem de tentativas:
 *   1. JSON.parse direto
 *   2. Extrair entre <json>...</json>
 *   3. Extrair de bloco markdown ```json ... ```
 *   4. Localizar primeiro `{` ... último `}` no texto
 *   5. Reparos comuns (vírgulas finais, control chars)
 *
 * Se nada funcionar → lança JsonExtractError (caller cascateia pro fallback).
 */

export class JsonExtractError extends Error {
  code = "JSON_EXTRACT_FAILED";
  constructor(public reason: string, public sample: string) {
    super(`JSON extraction failed: ${reason}`);
  }
}

function stripControlChars(s: string): string {
  // Remove control chars exceto \n \r \t (necessários dentro de strings JSON)
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function repairAndParse(s: string): unknown | null {
  let r = s
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .trim();
  r = stripControlChars(r);
  // fecha braces/brackets faltantes
  let braces = 0, brackets = 0;
  for (const ch of r) {
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }
  while (brackets-- > 0) r += "]";
  while (braces-- > 0) r += "}";
  return tryParse(r);
}

export function safeJsonExtract<T = Record<string, unknown>>(raw: string): T {
  if (!raw || typeof raw !== "string") {
    throw new JsonExtractError("empty or non-string input", String(raw).slice(0, 200));
  }

  // 1) parse direto
  const direct = tryParse(raw.trim());
  if (direct && typeof direct === "object") return direct as T;

  // 2) tags <json>...</json> (instrução enviada ao Claude)
  const tagMatch = raw.match(/<json>([\s\S]*?)<\/json>/i);
  if (tagMatch) {
    const inner = tagMatch[1].trim();
    const parsed = tryParse(inner) ?? repairAndParse(inner);
    if (parsed && typeof parsed === "object") return parsed as T;
  }

  // 3) bloco markdown ```json
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeMatch) {
    const inner = codeMatch[1].trim();
    const parsed = tryParse(inner) ?? repairAndParse(inner);
    if (parsed && typeof parsed === "object") return parsed as T;
  }

  // 4) heurística: primeira { ... última }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = raw.slice(firstBrace, lastBrace + 1);
    const parsed = tryParse(slice) ?? repairAndParse(slice);
    if (parsed && typeof parsed === "object") return parsed as T;
  }

  // 5) último recurso: reparar o raw todo
  const repaired = repairAndParse(raw);
  if (repaired && typeof repaired === "object") return repaired as T;

  throw new JsonExtractError("no valid JSON found via any strategy", raw.slice(0, 300));
}
