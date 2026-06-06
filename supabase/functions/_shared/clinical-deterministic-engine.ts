
/**
 * DETERMINISTIC CLINICAL ENGINE (DCE) - ENAZIZI V6
 * Rules-based physiological progression for critical conditions.
 */

export type ClinicalCondition = 'Sepsis' | 'IAM' | 'Stroke' | 'Shock' | 'PCR' | 'Hyperkalemia' | 'CAD';

export interface PatientState {
  heartRate: number;
  sysBP: number;
  diaBP: number;
  temp: number;
  spO2: number;
  status: 'estavel' | 'instavel' | 'grave' | 'critico' | 'pcr' | 'obito';
}

export function calculatePhysiologicalResponse(
  condition: ClinicalCondition,
  currentState: PatientState,
  actions: string[]
): PatientState {
  const nextState = { ...currentState };
  const actionsStr = actions.join(' ').toLowerCase();

  switch (condition) {
    case 'Sepsis':
      // Lack of antibiotic or volume in sepsis leads to deterioration
      const hasAntibiotic = actionsStr.includes('antibiotico') || actionsStr.includes('ceftriaxone') || actionsStr.includes('piperacilina');
      const hasVolume = actionsStr.includes('soro') || actionsStr.includes('cristaloide') || actionsStr.includes('ringer');

      if (!hasAntibiotic || !hasVolume) {
        nextState.sysBP -= 10;
        nextState.heartRate += 15;
        if (nextState.sysBP < 90) nextState.status = 'instavel';
        if (nextState.sysBP < 70) nextState.status = 'grave';
      } else {
        nextState.sysBP += 5;
        nextState.heartRate -= 5;
        nextState.status = 'estavel';
      }
      break;

    case 'IAM':
      const hasAAS = actionsStr.includes('aas') || actionsStr.includes('aspirina');
      const hasNitrate = actionsStr.includes('nitrato') || actionsStr.includes('isordil');
      
      if (!hasAAS) {
        nextState.heartRate += 20;
        nextState.sysBP -= 5;
        nextState.status = 'grave';
      }
      break;

    case 'PCR':
      const hasMassage = actionsStr.includes('massagem') || actionsStr.includes('compressao') || actionsStr.includes('rcp');
      if (!hasMassage) {
        nextState.status = 'obito';
        nextState.sysBP = 0;
        nextState.heartRate = 0;
      }
      break;

    default:
      // Minor random fluctuation for other conditions if not specifically handled
      nextState.heartRate += (Math.random() - 0.5) * 5;
  }

  // Clamping
  nextState.heartRate = Math.max(0, Math.min(220, nextState.heartRate));
  nextState.sysBP = Math.max(0, Math.min(250, nextState.sysBP));
  
  return nextState;
}
