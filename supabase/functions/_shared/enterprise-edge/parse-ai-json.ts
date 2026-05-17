/**
 * ENAZIZI ENTERPRISE — AI JSON Stability Engine
 * Robust extraction, sanitization, and recovery of AI-generated JSON.
 */

export function sanitizeAiContent(text: string): string {
  if (!text) return "";
  
  // 1. Remove control characters that break JSON.parse
  // Keep \n, \r, \t
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Remove markdown artifacts if they wrap the entire text
  cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "");
  
  return cleaned.trim();
}

/**
 * Attempts to repair common JSON malformations.
 */
function repairJson(text: string): string {
  let repaired = text.trim();

  // 1. Fix trailing commas in objects and arrays
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  // 2. Fix unescaped newlines in strings (simplified)
  // This is risky, but often AI puts raw newlines inside JSON values
  // We only do it if the JSON is already broken.

  return repaired;
}

export function parseAiJson<T = any>(content: string): T {
  const sanitized = sanitizeAiContent(content);

  // 1. Direct try
  try {
    return JSON.parse(sanitized);
  } catch (err) {
    // 2. Try to extract JSON from text if it's embedded
    const jsonMatch = sanitized.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      const extracted = jsonMatch[0];
      try {
        return JSON.parse(extracted);
      } catch (innerErr) {
        // 3. Last resort: repair and try again
        const repaired = repairJson(extracted);
        try {
          return JSON.parse(repaired);
        } catch (finalErr) {
          throw new Error(`AI JSON Stability Failure: ${finalErr.message}`);
        }
      }
    }
    throw new Error(`No JSON found in content: ${err.message}`);
  }
}
