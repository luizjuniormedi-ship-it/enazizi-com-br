import { describe, it, expect } from 'vitest';
import { 
  getCaseDifficulty, 
  calculateDQIInflation, 
  calculateTransferConfidence, 
  calculateEvidenceQuality 
} from './clinicalEvidenceHardening';

describe('Clinical Evidence Hardening (CEH)', () => {
  it('Case Difficulty: IAM should be < 1.0 (0.8)', () => {
    const result = getCaseDifficulty('Infarto Agudo do Miocárdio');
    expect(result).toBe(0.8);
  });

  it('Case Difficulty: Choque Séptico should be > 1.5 (1.6)', () => {
    expect(getCaseDifficulty('Paciente em Choque Séptico')).toBe(1.6);
  });

  it('DQI Inflation: Excessive exams should penalize DQI', () => {
    const penalty = calculateDQIInflation(20, 5);
    expect(penalty).toBe(20);
  });

  it('Transfer Confidence: Recent study should have high confidence', () => {
    const confidence = calculateTransferConfidence(2, 1, 3);
    expect(confidence).toBeGreaterThan(0.7);
  });

  it('Evidence Quality: Should calculate overall score correctly', () => {
    const score = calculateEvidenceQuality({
      dqiStability: 0.9,
      transferConfidence: 0.8,
      outcomeCorrelation: 0.85,
      attributionConfidence: 0.9,
      sampleSize: 50
    });
    expect(score).toBeGreaterThan(80);
  });
});
