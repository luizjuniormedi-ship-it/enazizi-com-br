/**
 * ENAZIZI Edge Function Contract — Parser v1
 *
 * Símbolos estáveis para parsing de saída de IA.
 * Edge Functions DEVEM importar daqui, não de _shared/ai-fetch.ts.
 *
 * Defensive: contém shims inline caso o helper interno desapareça.
 */

export const CONTRACT_VERSION = "v1";

/**
 * Remove ruído comum de output de IA: markdown fences, control chars,
 * blocos <thought>, e trim.
 */
export function cleanQuestionText(input: unknown): string {
  if (input == null) return "";
  let s = typeof input === "string" ? input : String(input);
  // strip control chars except \n \r \t
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // strip markdown code fences
  s = s.replace(/```json\s*/gi, "").replace(/```/g, "");
  // strip <thought>...</thought>
  s = s.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  return s.trim();
}

/**
 * Parse robusto de JSON de IA com 3 estratégias:
 *  1) JSON.parse direto
 *  2) extrair maior bloco { ... } ou [ ... ]
 *  3) reparo simples (vírgulas trailing) + reparse
 *
 * Lança erro descritivo se nada funcionar.
 */
export function parseAiJson<T = unknown>(raw: string): T {
  const text = cleanQuestionText(raw);

  try {
    return JSON.parse(text) as T;
  } catch (_) {
    /* fallthrough */
  }

  const blocks = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/g);
  if (blocks) {
    const sorted = [...blocks].sort((a, b) => b.length - a.length);
    for (const block of sorted) {
      try {
        return JSON.parse(block) as T;
      } catch (_) {
        const repaired = block.replace(/,\s*([}\]])/g, "$1");
        try {
          return JSON.parse(repaired) as T;
        } catch (_) {
          /* try next */
        }
      }
    }
  }

  throw new Error(
    `parseAiJson: unable to parse AI output (length=${text.length}, preview="${text.slice(0, 80)}")`,
  );
}
