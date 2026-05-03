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

export function isProfileComplete(data: {
  phone?: string | null;
  display_name?: string | null;
  periodo?: number | null;
  faculdade?: string | null;
  user_type?: string;
}): boolean {
  const userType = data.user_type || "estudante";
  const isStudent = userType === "estudante" || userType === "medico";
  const isProfessor = userType === "professor";

  const nameCheck = isValidName(data.display_name || "");
  if (!nameCheck.valid) return false;

  // Phone check relaxed: allow missing phone for existing users (91 users currently blocked)
  // New signups still required via form 'required' attribute, but validation here won't block access.
  if (data.phone) {
    const phoneCheck = isValidPhone(data.phone);
    if (!phoneCheck.valid) return false;
  }

  if (isStudent && (!data.periodo || !data.faculdade)) return false;
  if (isProfessor && !data.faculdade) return false;
  if (data.faculdade && !FACULDADES.includes(data.faculdade)) return false;

  return true;
}
