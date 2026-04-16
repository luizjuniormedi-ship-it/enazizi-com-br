/**
 * Mnemonic form validation.
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateMnemonicForm(data: {
  tema: string;
  termos: string[];
  estilo: string;
  publico: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.tema.trim()) {
    errors.tema = "Informe o tema.";
  } else if (data.tema.trim().length < 2) {
    errors.tema = "Tema deve ter pelo menos 2 caracteres.";
  }

  // Termos agora é OPCIONAL — se vazio, IA extrai automaticamente.
  // Se o usuário fornecer termos, validamos o intervalo 3-7.
  const cleanTermos = data.termos.filter(t => t.trim().length > 0);
  if (cleanTermos.length > 0 && cleanTermos.length < 3) {
    errors.termos = "Se for informar termos, use ao menos 3 (ou deixe em branco para a IA extrair).";
  } else if (cleanTermos.length > 7) {
    errors.termos = "Máximo de 7 termos.";
  }

  if (!data.estilo.trim()) {
    errors.estilo = "Selecione um estilo.";
  }

  if (!data.publico.trim()) {
    errors.publico = "Selecione o público-alvo.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateFeedback(data: {
  rating_general: number;
  rating_medical: number;
  rating_pedagogical: number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  for (const [key, val] of Object.entries(data)) {
    if (val < 1 || val > 5) {
      errors[key] = "Nota deve ser entre 1 e 5.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
