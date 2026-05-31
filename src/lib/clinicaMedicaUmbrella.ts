/**
 * Clínica Médica Umbrella — Registro de IDs
 * ------------------------------------------------------------
 * Fonte canônica de NOMES: `CLINICA_MEDICA_SPECIALTIES` em
 * `src/lib/examProfileToCurriculumBanca.ts`.
 *
 * Este arquivo mantém a versão por **specialty_id** (UUID), necessária
 * para queries diretas no banco (filtros `.in("specialty_id", ...)`).
 *
 * Snapshot atual (alinhado com a UI de Clínica Médica virtual):
 *   - Clínica Médica nativa
 *   - Cardiologia, Pneumologia, Gastroenterologia, Endocrinologia,
 *     Nefrologia, Hematologia, Reumatologia, Neurologia, Infectologia
 *
 * Backend equivalente: VIEW `public.vw_clinica_medica_umbrella`.
 *
 * Use `expandSpecialtyToUmbrella()` no motor de simulados/estudo quando
 * o aluno selecionar "Clínica Médica" — devolve a lista completa de
 * specialty_ids a consultar.
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
  "e6b57f08-6165-4fa3-8ea6-2574ce0078f1", // Neurologia
] as const;

/**
 * Expande uma especialidade para os IDs reais a consultar.
 * Se for "Clínica Médica", devolve a lista umbrella; caso contrário,
 * devolve o próprio ID recebido.
 */
export function expandSpecialtyToUmbrella(
  specialtyId: string | null | undefined,
  specialtyName?: string | null
): string[] {
  const n = specialtyName?.toLowerCase().trim();
  if (
    specialtyId === CLINICA_MEDICA_SPECIALTY_ID ||
    n === "clínica médica" ||
    n === "clinica medica" ||
    n === "medicina interna"
  ) {
    return [...CLINICA_MEDICA_UMBRELLA_IDS];
  }
  return specialtyId ? [specialtyId] : [];
}

export function isClinicaMedicaUmbrella(specialtyName?: string | null): boolean {
  const n = specialtyName?.toLowerCase().trim();
  return n === "clínica médica" || n === "clinica medica" || n === "medicina interna";
}
