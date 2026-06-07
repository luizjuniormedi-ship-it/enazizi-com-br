import { FACULDADES } from "@/constants/faculdades";

// Valid Brazilian DDD codes
const VALID_DDDS = new Set([
  11,12,13,14,15,16,17,18,19, // SP
  21,22,24, // RJ
  27,28, // ES
  31,32,33,34,35,37,38, // MG
  41,42,43,44,45,46, // PR
  47,48,49, // SC
  51,53,54,55, // RS
  61, // DF
  62,64, // GO
  63, // TO
  65,66, // MT
  67, // MS
  68, // AC
  69, // RO
  71,73,74,75,77, // BA
  79, // SE
  81,87, // PE
  82, // AL
  83, // PB
  84, // RN
  85,88, // CE
  86,89, // PI
  91,93,94, // PA
  92,97, // AM
  95, // RR
  96, // AP
  98,99, // MA
]);

export function isValidPhone(phone: string): { valid: boolean; message?: string } {
  const digits = phone.replace(/\D/g, "");
  
  if (digits.length < 10 || digits.length > 11) {
    return { valid: false, message: "Telefone deve ter 10 ou 11 dígitos" };
  }

  const ddd = parseInt(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) {
    return { valid: false, message: "DDD inválido" };
  }

  // Reject all same digits (e.g. 00000000000, 11111111111)
  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, message: "Número de telefone inválido" };
  }

  // Mobile numbers (11 digits) must start with 9 after DDD
  if (digits.length === 11 && digits[2] !== "9") {
    return { valid: false, message: "Celular deve começar com 9" };
  }

  return { valid: true };
}

export function isValidName(name: string): { valid: boolean; message?: string } {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, message: "Nome é obrigatório" };
  }

  const words = trimmed.split(/\s+/).filter(w => w.length >= 2);
  if (words.length < 2) {
    return { valid: false, message: "Informe nome e sobrenome" };
  }

  if (trimmed.length > 100) {
    return { valid: false, message: "Nome muito longo (máx. 100 caracteres)" };
  }

  return { valid: true };
}

/**
 * Gate Stage A — minimum required to enter the platform.
 *
 * Decisão de produto (post-mortem onboarding: 217/336 usuários travados,
 * 100% por falta de target_exams): reduzimos o gate de bloqueio para os 2
 * campos verdadeiramente essenciais — nome + tipo de usuário.
 *
 * Os demais campos (telefone, faculdade, período, banca) passam a ser
 * coletados de forma contextual dentro do app (Stage B), sem bloquear
 * o acesso inicial. CTAs no Dashboard pedirão cada campo quando virar
 * relevante (ex.: banca antes do primeiro simulado).
 */
export function isProfileComplete(data: {
  phone?: string | null;
  display_name?: string | null;
  periodo?: number | null;
  faculdade?: string | null;
  user_type?: string;
  target_exams?: string[] | null;
}): boolean {
  const nameCheck = isValidName(data.display_name || "");
  if (!nameCheck.valid) return false;

  const userType = data.user_type || "";
  if (!["estudante", "medico", "professor"].includes(userType)) return false;

  return true;
}

/**
 * Stage B helpers — usados por CTAs contextuais no app para saber
 * quais campos ainda faltam. Não bloqueiam acesso.
 */
export function isPhoneFilled(phone?: string | null): boolean {
  return isValidPhone(phone || "").valid;
}

export function isFaculdadeFilled(faculdade?: string | null): boolean {
  return !!faculdade && FACULDADES.includes(faculdade);
}

export function isTargetExamsFilled(target_exams?: string[] | null): boolean {
  return Array.isArray(target_exams) && target_exams.length > 0;
}
