
/**
 * ENAZIZI — Forensic Board Analyzer v14
 * Compares generated questions against the Golden Dataset and evaluates fidelity.
 */

import { BancaProfile } from "./banca-profiles.ts";
import { detectAiPatterns, AiPatternResult } from "./detect-ai-patterns.ts";

export interface ForensicResult {
  fidelity_score: number; // 0-100
  structural_score: number;
  lexical_score: number;
  cognitive_score: number;
  pedagogical_score: number;
  ai_pattern: AiPatternResult;
  isValid: boolean;
  reasons: string[];
}

/**
 * Basic Jaccard Similarity for lexical fallback when embeddings are unavailable
 */
function jaccardSimilarity(s1: string, s2: string): number {
  const words1 = new Set(s1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(s2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

export async function analyzeQuestionForensic(
  question: any, 
  profile: BancaProfile, 
  supabaseAdmin: any,
  goldenSamples?: any[]
): Promise<ForensicResult> {
  const reasons: string[] = [];
  
  // 1. Fetch Golden Samples if not provided
  if (!goldenSamples || goldenSamples.length === 0) {
    const { data } = await supabaseAdmin
      .from("golden_exam_dataset")
      .select("*")
      .ilike("banca", `%${profile.label}%`)
      .limit(5);
    goldenSamples = data || [];
  }

  // 2. Structural Score (Lengths, Options Count)
  let structural_score = 100;
  const stmtLen = question.statement?.length || 0;
  const optLens = (question.options || []).map((o: string) => o.length);
  const avgOptLen = optLens.length ? optLens.reduce((a: number, b: number) => a + b, 0) / optLens.length : 0;

  if (goldenSamples.length > 0) {
    const avgGoldenStmt = goldenSamples.reduce((a, b) => a + (b.stmt_length || 0), 0) / goldenSamples.length;
    const avgGoldenOpt = goldenSamples.reduce((a, b) => a + (b.option_avg_length || 0), 0) / goldenSamples.length;
    
    const stmtRatio = Math.min(stmtLen, avgGoldenStmt) / Math.max(stmtLen, avgGoldenStmt);
    const optRatio = Math.min(avgOptLen, avgGoldenOpt) / Math.max(avgOptLen, avgGoldenOpt);
    
    structural_score = (stmtRatio * 0.7 + optRatio * 0.3) * 100;
  }
  
  if (question.options?.length !== (profile.optionsCount || 5)) {
    structural_score -= 30;
    reasons.push("Wrong options count");
  }

  // 3. Lexical Score (Medical Vocabulary density)
  let lexical_score = 80; // Baseline
  if (goldenSamples.length > 0) {
    const similarities = goldenSamples.map(s => jaccardSimilarity(question.statement, s.statement));
    lexical_score = Math.max(...similarities) * 150; // Boosted factor for Jaccard
  }
  lexical_score = Math.min(100, Math.max(0, lexical_score));

  // 4. Cognitive Score (Clinical markers)
  let cognitive_score = 0;
  const clinicalMarkers = ["paciente", "apresenta", "exame físico", "sinais vitais", "conduta", "diagnóstico", "hipótese"];
  const markersFound = clinicalMarkers.filter(m => question.statement.toLowerCase().includes(m)).length;
  cognitive_score = (markersFound / clinicalMarkers.length) * 100;
  if (cognitive_score < 40 && profile.difficulty >= 4) {
    reasons.push("Low clinical reasoning markers for high difficulty");
  }

  // 5. Pedagogical Score (Guidelines, Laboratory data)
  let pedagogical_score = 0;
  const labUnits = ["mg/dl", "meq/l", "g/dl", "leucócitos", "hemoglobina", "pa:"];
  const labFound = labUnits.some(u => question.statement.toLowerCase().includes(u));
  const guidelineFound = (question.explanation || "").toLowerCase().includes("diretriz") || (question.explanation || "").toLowerCase().includes("guideline");
  
  if (labFound) pedagogical_score += 50;
  if (guidelineFound) pedagogical_score += 50;
  
  // 6. AI Pattern Detection
  const ai_pattern = detectAiPatterns(question);
  
  // 7. Final Fidelity Score Calculation
  // Weights: Structural (30%), Lexical (20%), Cognitive (25%), Pedagogical (25%)
  let fidelity_score = (
    structural_score * 0.30 + 
    lexical_score * 0.20 + 
    cognitive_score * 0.25 + 
    pedagogical_score * 0.25
  );

  // Penalty for AI Patterns
  fidelity_score -= (ai_pattern.aiLikelihoodScore * 0.5);
  
  fidelity_score = Math.min(100, Math.max(0, fidelity_score));

  return {
    fidelity_score: Math.round(fidelity_score),
    structural_score: Math.round(structural_score),
    lexical_score: Math.round(lexical_score),
    cognitive_score: Math.round(cognitive_score),
    pedagogical_score: Math.round(pedagogical_score),
    ai_pattern,
    isValid: fidelity_score >= 85 || (goldenSamples.length === 0 && fidelity_score >= 70), // Relax if no golden data
    reasons: reasons.concat(ai_pattern.flags)
  };
}
