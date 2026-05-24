
/**
 * ENAZIZI — AI Pattern Detector
 * Detects cliches, robotic language, and artificial symmetry in generated medical questions.
 */

export interface AiPatternResult {
  aiLikelihoodScore: number; // 0-100
  flags: string[];
}

const AI_CLICHES = [
  "é importante notar", "em resumo", "em conclusão", "além disso",
  "como resultado", "portanto", "vale ressaltar", "conforme mencionado",
  "de acordo com a literatura", "é fundamental", "importante destacar",
  "certamente", "obviamente", "claramente", "interessante notar"
];

const FORBIDDEN_AI_MARKERS = [
  "como uma inteligência artificial", "de acordo com o chatgpt", "não tenho sentimentos"
];

export function detectAiPatterns(question: any): AiPatternResult {
  let score = 0;
  const flags: string[] = [];
  const content = (question.statement + " " + (question.explanation || "")).toLowerCase();

  // 1. Cliche detection
  let clicheCount = 0;
  for (const cliche of AI_CLICHES) {
    if (content.includes(cliche)) {
      clicheCount++;
      if (clicheCount > 2) {
        score += 10;
        flags.push(`AI_CLICHE_DETECTED: "${cliche}"`);
      }
    }
  }

  // 2. Forbidden markers
  for (const marker of FORBIDDEN_AI_MARKERS) {
    if (content.includes(marker)) {
      score += 50;
      flags.push(`FORBIDDEN_MARKER: "${marker}"`);
    }
  }

  // 3. Option Symmetry (too similar in length)
  if (question.options && question.options.length > 1) {
    const lens = question.options.map((o: string) => o.length);
    const avg = lens.reduce((a: number, b: number) => a + b, 0) / lens.length;
    const dev = lens.map((l: number) => Math.abs(l - avg)).reduce((a: number, b: number) => a + b, 0) / lens.length;
    
    // If deviation is very low relative to length, it's suspiciously symmetric
    if (avg > 20 && dev < avg * 0.1) {
      score += 20;
      flags.push("SUSPICIOUS_OPTION_SYMMETRY");
    }
  }

  // 4. Excessive list symmetry in statement
  const listMatches = question.statement.match(/\d\.\s/g);
  if (listMatches && listMatches.length > 4) {
    score += 10;
    flags.push("HEAVY_LIST_STRUCTURE");
  }

  // 5. Short explanation for complex topics
  if (question.explanation && question.explanation.length < 150) {
    score += 15;
    flags.push("SHALLOW_EXPLANATION");
  }

  return {
    aiLikelihoodScore: Math.min(100, score),
    flags
  };
}
