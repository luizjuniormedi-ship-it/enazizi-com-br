import { describe, it, expect } from 'vitest';
import { normalizeMedicalTerm, termMatches } from './tutorVideoRecommendationService';

describe('TutorVideoRecommendationService', () => {
  describe('normalizeMedicalTerm', () => {
    it('should normalize pericardite and its synonyms', () => {
      const terms = normalizeMedicalTerm('Pericardite');
      expect(terms).toContain('pericardite');
      expect(terms).toContain('pericardio');
      expect(terms).toContain('tamponamento cardiaco');
    });

    it('should normalize FA correctly', () => {
      const terms = normalizeMedicalTerm('FA');
      expect(terms).toContain('fa');
      expect(terms).toContain('fibrilacao atrial');
    });

    it('should handle complex strings', () => {
      const terms = normalizeMedicalTerm('Insuficiência Renal Aguda (IRA)');
      expect(terms).toContain('ira');
      expect(terms).toContain('insuficiencia renal aguda');
    });
  });

  describe('termMatches', () => {
    it('should match short terms only with word boundaries', () => {
      // FA should match "Paciente com FA" but not "Falência"
      expect(termMatches('Paciente com FA', 'fa')).toBe(true);
      expect(termMatches('Houve falencia renal', 'fa')).toBe(false);
      expect(termMatches('Fibrilação Atrial', 'fa')).toBe(false); // termMatches is literal match, FA doesn't match Fibrilação unless we normalize
    });

    it('should match normalized long terms', () => {
      expect(termMatches('Pericardite Aguda', 'pericardite')).toBe(true);
      expect(termMatches('Pneumonia Bacteriana', 'pneumonia')).toBe(true);
    });

    it('should handle accents', () => {
      expect(termMatches('Fibrilação Atrial', 'fibrilacao')).toBe(true);
    });
  });
});
