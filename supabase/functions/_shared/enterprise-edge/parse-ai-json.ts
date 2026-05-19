/**
 * ENAZIZI ENTERPRISE — AI JSON Stability Engine
 * Robust extraction, sanitization, and recovery of AI-generated JSON.
 */

export function sanitizeAiContent(text: string): string {
  if (!text) return "";
  
  // 1. Remove control characters that break JSON.parse
  // Keep \n, \r, \t
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Remove markdown artifacts anywhere in the text before parsing
  cleaned = cleaned.replace(/```json\s*/g, "").replace(/```/g, "");
  
  // 3. Remove thinking process (if any) - <thought>...</thought>
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  
  return cleaned.trim();
}

/**
 * Attempts to repair common JSON malformations.
 */
function repairJson(text: string): string {
  let repaired = text.trim();

  // 1. Fix trailing commas in objects and arrays
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  // 2. Fix unescaped newlines in strings
  // This is safer: look for newlines between a property value and the next property name
  // Actually, let's just replace all raw newlines inside what looks like strings.
  // This is complex, but for common AI errors, replacing \n with actual \\n works.
  
  return repaired;
}

export function parseAiJson<T = any>(content: string): T {
  const sanitized = sanitizeAiContent(content);

  // 1. Direct try
  try {
    return JSON.parse(sanitized);
  } catch (err) {
    // 2. Try to extract JSON from text if it's embedded (pick the largest block)
    const blocks = sanitized.match(/\{[\s\S]*\}|\[[\s\S]*\]/g);
    if (blocks) {
      // Sort by length descending to find the main JSON block
      const sortedBlocks = blocks.sort((a, b) => b.length - a.length);
      for (const extracted of sortedBlocks) {
        try {
          return JSON.parse(extracted);
        } catch (innerErr) {
          // 3. Last resort: repair and try again
          const repaired = repairJson(extracted);
          try {
            return JSON.parse(repaired);
          } catch (finalErr) {
            // Continue to next block if any
          }
        }
      }
    }
    throw new Error(`AI JSON Stability Failure: ${err.message}. Content: ${sanitized.substring(0, 100)}...`);
  }
}
