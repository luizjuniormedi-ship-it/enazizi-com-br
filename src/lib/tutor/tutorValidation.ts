import { TutorBlock } from "@/types/tutor";

export interface ValidationResult {
  eligible: boolean;
  rejectionReason?: string;
  structureScore: number;
  cognitiveDensity: number;
  metrics: {
    isLong: boolean;
    hasTitle: boolean;
    hasStructure: boolean;
    isMedical: boolean;
    hasSummary: boolean;
  };
}

/**
 * Validates if a Tutor IA message is eligible for cinematographic video generation.
 */
export const validateTutorMessageForCME = (
  content: string, 
  blocks: TutorBlock[]
): ValidationResult => {
  const lowercaseContent = content.toLowerCase();
  const contentLength = content.length;
  
  // 1. Structural checks
  const hasTitle = content.includes('# ') || content.includes('## ');
  const hasStructure = content.includes('- ') || content.includes('1. ') || blocks.length > 0;
  const isLong = contentLength > 500; // Minimum content threshold
  const hasSummary = lowercaseContent.includes('resumo') || 
                    lowercaseContent.includes('objetivos') || 
                    blocks.some(b => b.type === 'summary');
  
  // 2. Medical Domain check (ENAZIZI scope)
  const medicalKeywords = [
    'médico', 'clínico', 'tratamento', 'diagnóstico', 'paciente', 
    'sintoma', 'medicina', 'anatomia', 'patologia', 'cirurgia',
    'prescrição', 'exame', 'fisiopatologia', 'prognóstico'
  ];
  const isMedical = medicalKeywords.some(keyword => lowercaseContent.includes(keyword));

  // 3. Cognitive Density calculation
  // density = (structured_elements / length) * 1000
  const listItemsCount = (content.match(/^[ \t]*[-*•1-9]\.? /gm) || []).length;
  const cognitiveDensity = ((listItemsCount + blocks.length * 2) / (contentLength || 1)) * 1000;
  
  // 4. Structure Score
  let structureScore = 0;
  if (hasTitle) structureScore += 20;
  if (hasStructure) structureScore += 30;
  if (isLong) structureScore += 20;
  if (hasSummary) structureScore += 30;

  // 5. Final eligibility logic
  const minStructureScore = 50;
  const minDensity = 1.0;
  
  let eligible = true;
  let rejectionReason = "";

  if (contentLength < 300) {
    eligible = false;
    rejectionReason = "Conteúdo muito curto para uma videoaula cinematográfica.";
  } else if (!isMedical) {
    eligible = false;
    rejectionReason = "Conteúdo fora do escopo médico educacional ENAZIZI.";
  } else if (structureScore < minStructureScore) {
    eligible = false;
    rejectionReason = "Estrutura didática insuficiente (títulos, listas ou resumo ausentes).";
  }

  return {
    eligible,
    rejectionReason,
    structureScore,
    cognitiveDensity,
    metrics: {
      isLong,
      hasTitle,
      hasStructure,
      isMedical,
      hasSummary
    }
  };
};
