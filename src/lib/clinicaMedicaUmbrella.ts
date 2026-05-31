/**
 * Clínica Médica Umbrella
 * ------------------------------------------------------------
 * Em bancas de residência (REVALIDA, ENARE, ENAMED, etc.) o bloco
 * "Clínica Médica" é um GUARDA-CHUVA que engloba várias subespecialidades.
 * Quando o aluno pedir "Clínica Médica" no motor de simulados/estudo,
 * use `CLINICA_MEDICA_UMBRELLA_IDS` ao invés do specialty_id literal.
 *
 * Origem (snapshot 2026-05-31):
 *   - Nativa "Clínica Médica":   103 questões aprovadas
 *   - Sub-especialidades agregadas: 2.690 questões aprovadas
 *   - TOTAL umbrella:             ~2.793 questões disponíveis
 *
 * Backend equivalente: VIEW `public.vw_clinica_medica_umbrella`
 * (filtra automaticamente review_status='approved').
 *
 * NÃO inclui: Pediatria, GO, Cirurgia, Preventiva, Psiquiatria, Anestesia,
 * Radiologia — esses blocos são cobrados separadamente nas bancas.
 */

export const CLINICA_MEDICA_SPECIALTY_ID = "c6323be9-8b39-4e72-b267-2f19e0980abb";

export const CLINICA_MEDICA_UMBRELLA_IDS: readonly string[] = [
  "c6323be9-8b39-4e72-b267-2f19e0980abb", // Clínica Médica (nativa)
  "038fc7d1-5a03-441a-8ae3-933204803cce", // Cardiologia
  "4235da65-61b9-4fbd-9ff0-344cf986f311", // Endocrinologia
  "64565205-940f-4c4b-9614-af7fed8a3818", // Gastroenterologia
  "c87f3381-d1de-4289-a8e4-565ac0d950a1", // Pneumologia
  "f9242f6f-df6f-40d7-a04e-8bbffb215645", // Hematologia
  "d20d5adf-20f9-4789-8a86-0e07109c9192", // Reumatologia
  "0b755bbe-9dde-475f-a2ef-5733d8d97c99", // Infectologia
  "b47c8eb7-94ee-4b63-bf35-d5b6494b8866", // Nefrologia
  "c835d457-412d-4d22-a7ea-ca33cc5bca1a", // Oncologia
  "ee8bf227-3be0-43ad-bd3e-e855c71b1d5b", // Medicina de Emergência
] as const;

export const CLINICA_MEDICA_UMBRELLA_NAMES: readonly string[] = [
  "Clínica Médica",
  "Cardiologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Pneumologia",
  "Hematologia",
  "Reumatologia",
  "Infectologia",
  "Nefrologia",
  "Oncologia",
  "Medicina de Emergência",
] as const;

/**
 * Expande uma especialidade para o conjunto de IDs reais a consultar.
 * Se for "Clínica Médica", devolve a lista umbrella; caso contrário,
 * devolve apenas o ID recebido.
 */
export function expandSpecialtyToUmbrella(
  specialtyId: string | null | undefined,
  specialtyName?: string | null
): string[] {
  if (
    specialtyId === CLINICA_MEDICA_SPECIALTY_ID ||
    specialtyName?.toLowerCase().trim() === "clínica médica" ||
    specialtyName?.toLowerCase().trim() === "clinica medica"
  ) {
    return [...CLINICA_MEDICA_UMBRELLA_IDS];
  }
  return specialtyId ? [specialtyId] : [];
}

export function isClinicaMedicaUmbrella(specialtyName?: string | null): boolean {
  const n = specialtyName?.toLowerCase().trim();
  return n === "clínica médica" || n === "clinica medica" || n === "medicina interna";
}
