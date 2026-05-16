/**
 * ENAZIZI ENTERPRISE — AI JSON Hardening
 * Robust extraction and sanitization of AI-generated content.
 */

export function parseAiJson<T = any>(content: string): T {
  // 1. Clean markdown artifacts
  let clean = content.replace(/```json/g, "").replace(/```/g, "").trim();

  // 2. Try direct parse
  try {
    return JSON.parse(clean);
  } catch (err) {
    // 3. Regex fallback for malformed but readable JSON
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        throw new Error(`Failed to parse AI JSON: ${innerErr.message}`);
      }
    }
    throw new Error(`No valid JSON found in AI response: ${err.message}`);
  }
}

export function sanitizeAiContent(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .trim();
}
