/**
 * Normalização determinística de perguntas para a memória pedagógica do Tutor IA.
 *
 * Objetivo: gerar uma chave comparável (`question_normalized`) que permita
 * encontrar perguntas semelhantes mesmo com pequenas variações de redação.
 *
 * Regras (ordem importa):
 *  1. lowercase
 *  2. remover acentos
 *  3. remover pontuação
 *  4. colapsar espaços
 *  5. remover stopwords genéricas (não-médicas)
 *  6. preservar termos clínicos importantes
 *
 * Exemplo:
 *   "Me explica insuficiência cardíaca com tratamento?"
 *   → "insuficiencia cardiaca tratamento"
 */

const STOPWORDS = new Set([
  // pronomes / verbos genéricos
  "me", "te", "se", "lhe", "nos", "vos",
  "explica", "explique", "explicar", "explicame", "explicame",
  "fale", "falar", "diga", "dizer", "conte", "contar",
  "mostre", "mostra", "mostrar",
  "ensina", "ensinar", "ensine",
  "quero", "queria", "gostaria", "preciso", "precisava",
  "saber", "entender", "aprender", "estudar",
  "voce", "vc", "tu", "eu",
  // artigos / preposições
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das",
  "em", "no", "na", "nos", "nas",
  "para", "pra", "pro", "por", "com", "sem",
  "ao", "aos", "à", "às",
  // conectores
  "que", "qual", "quais", "quando", "onde", "como", "porque", "pq",
  "e", "ou", "mas", "se", "ja", "ainda", "tambem", "tb",
  // genéricos
  "sobre", "tudo", "isso", "aquilo", "este", "esta", "esse", "essa",
  "favor", "por favor", "obrigado", "obrigada",
  "ola", "oi", "bom", "boa", "dia", "tarde", "noite",
]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stripPunctuation(s: string): string {
  // mantém letras, dígitos e espaços
  return s.replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeTutorQuestion(input: string): string {
  if (!input || typeof input !== "string") return "";

  const lowered = input.toLowerCase();
  const noAccents = stripDiacritics(lowered);
  const noPunct = stripPunctuation(noAccents);
  const collapsed = collapseSpaces(noPunct);

  const tokens = collapsed.split(" ").filter((t) => t.length > 0 && !STOPWORDS.has(t));

  return tokens.join(" ").slice(0, 300);
}

/**
 * Detecta se a pergunta contém contexto pessoal/sensível —
 * nesse caso a memória deve ser salva como `scope: 'user'` e nunca global.
 */
const PERSONAL_PATTERNS = [
  /\bmeu paciente\b/i,
  /\bminha paciente\b/i,
  /\bpaciente meu\b/i,
  /\batendi\b/i,
  /\bvi um caso\b/i,
  /\bcaso que (eu|peguei)\b/i,
  /\bnome do paciente\b/i,
  /\bcpf\b/i,
  /\bprontu[áa]rio\b/i,
];

export function hasPersonalContext(text: string): boolean {
  if (!text) return false;
  return PERSONAL_PATTERNS.some((rx) => rx.test(text));
}

/**
 * Heurística leve para detectar pedidos que NÃO devem reusar memória.
 */
const REGENERATE_PATTERNS = [
  /explique de outro jeito/i,
  /explica de outra forma/i,
  /mais profundo/i,
  /mais detalhad[ao]/i,
  /atualiza(r|do|cao)/i,
  /atualizad[ao]/i,
  /diretriz nova/i,
  /guideline novo/i,
  /vers[ãa]o nova/i,
];

export function shouldBypassMemory(text: string): boolean {
  if (!text) return false;
  return REGENERATE_PATTERNS.some((rx) => rx.test(text));
}
