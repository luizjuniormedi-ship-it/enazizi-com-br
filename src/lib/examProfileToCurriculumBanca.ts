/**
 * Mapeador entre os perfis da UI (`EXAM_PROFILES`) e o valor de
 * `curriculum_weights.banca` no banco.
 *
 * IMPORTANTE: nem todo perfil tem cobertura no banco. Quando o retorno é
 * `null`, o consumidor deve cair para o fallback estático
 * (`realExamDistribution.ts`).
 *
 * Cobertura atual (auditada em 2026-04-22):
 *   ENARE   → 238 pesos  ✅
 *   USP-SP  → 238 pesos  ✅ (renomeado: UI usa "USP-SP", DB usa "USP")
 *   UNIFESP → 238 pesos  ✅
 *   SUS-SP  → 238 pesos  ✅
 *   UNICAMP →  69 pesos  ⚠️ parcial (mantido como dinâmico mesmo assim)
 *   REVALIDA → 0 pesos   ❌ → fallback estático
 *   GERAL    → 0 pesos   ❌ → fallback estático
 */
export type ProfileKey =
  | "ENARE"
  | "USP-SP"
  | "UNIFESP"
  | "SUS-SP"
  | "UNICAMP"
  | "REVALIDA"
  | "GERAL";

const PROFILE_TO_BANCA: Record<string, string | null> = {
  ENARE: "ENARE",
  "USP-SP": "USP",
  UNIFESP: "UNIFESP",
  "SUS-SP": "SUS-SP",
  UNICAMP: "UNICAMP",
  REVALIDA: null,
  GERAL: null,
};

/**
 * Devolve o valor de `curriculum_weights.banca` para um perfil da UI.
 * Retorna `null` se o perfil não tiver cobertura confiável no banco.
 */
export function profileToCurriculumBanca(profileKey: string): string | null {
  return PROFILE_TO_BANCA[profileKey] ?? null;
}

/**
 * Lista de specialties consideradas "Clínica Médica" para fins de
 * agrupamento visual. Quando o usuário escolhe um perfil dinâmico, essas
 * 9 specialties do banco aparecem agrupadas sob um nó virtual chamado
 * "Clínica Médica" — preservando os IDs/nomes reais para o gerador.
 *
 * Decisão de design: o banco trata Cardio/Pneumo/Endo/etc. como specialties
 * de primeiro nível. A UI agrupa virtualmente para manter consistência com
 * a UX atual (e com o EXAM_PROFILES estático). O gerador continua usando
 * os nomes reais de specialty/topic.
 */
export const CLINICA_MEDICA_SPECIALTIES = new Set<string>([
  "Cardiologia",
  "Pneumologia",
  "Gastroenterologia",
  "Endocrinologia",
  "Nefrologia",
  "Hematologia",
  "Reumatologia",
  "Neurologia",
  "Infectologia",
]);

export const CLINICA_MEDICA_VIRTUAL_NAME = "Clínica Médica";

export function isClinicaMedicaSpecialty(specialtyName: string): boolean {
  return CLINICA_MEDICA_SPECIALTIES.has(specialtyName);
}
