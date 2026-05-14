/**
 * Validates that content is medical in nature and not from other fields.
 * Used across all question/content generators for quality filtering.
 */
export const NON_MEDICAL_CONTENT_REGEX = /(direito|jur[ií]d|penal|constitucional|processo penal|inquérito|inqu[eé]rito|stf|stj|delegad|advogad|pol[ií]cia federal|c[oó]digo penal|a[cç][aã]o penal|inform[aá]tica|tecnologia da informa[cç][aã]o|engenharia|contabil|economia|administra[cç][aã]o|taxa de inscri|processo seletivo|per[ií]odo de inscri[cç][aã]o|edital de convoca|cronograma do processo|matr[ií]cula dos aprovados|homologa[cç][aã]o|classifica[cç][aã]o final|prazo de recurso|resultado preliminar|documenta[cç][aã]o exigida|valor da taxa|vagas reservadas|candidato inscrito|prova objetiva do processo)/i;

export const MEDICAL_CONTENT_REGEX = /(medicin|sa[uú]de|paciente|diagn[oó]st|tratament|sintom|doen[cç]|fisiopat|farmac|anatom|cl[íi]nic|cirurg|pediatr|ginec|obstetr|preventiva|resid[eê]ncia|enare|revalida|cardio|pneumo|neuro|go|sus|protocolo|diretriz)/i;

// Heurística para bloquear vazamento de conteúdo em inglês nas questões.
export const ENGLISH_QUESTION_REGEX = /\b(the|which|following|patient|diagnosis|treatment|management|most likely|except|all of the following|correct answer|best option)\b/i;

export function isMedicalContent(text: string): boolean {
  return MEDICAL_CONTENT_REGEX.test(text) && !NON_MEDICAL_CONTENT_REGEX.test(text);
}

export function isMedicalQuestion(q: { statement?: string; topic?: string; explanation?: string; options?: string[] }): boolean {
  const text = `${q.topic || ""} ${q.statement || ""} ${q.explanation || ""} ${(q.options || []).join(" ")}`;
  return MEDICAL_CONTENT_REGEX.test(text) && !NON_MEDICAL_CONTENT_REGEX.test(text);
}

export function isPortugueseMedicalQuestion(q: { statement?: string; topic?: string; explanation?: string; options?: string[] }): boolean {
  const text = `${q.topic || ""} ${q.statement || ""} ${q.explanation || ""} ${(q.options || []).join(" ")}`;
  return isMedicalQuestion(q) && !ENGLISH_QUESTION_REGEX.test(text);
}
