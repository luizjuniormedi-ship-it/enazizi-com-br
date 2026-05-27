// ENAZIZI — PII Sanitizer (Hardening v25.1 / LGPD-SAFE)
// Sanitização defensiva de texto antes de promover memória global do Tutor.
// Remove identificadores diretos e contexto pessoal/clínico que possa vazar
// entre alunos via scope='global'.
//
// Foco: regex defensiva + heurística médica leve. Não substitui revisão humana,
// mas garante que texto literal sensível NUNCA chega a outros usuários.

export interface SanitizeResult {
  text: string;
  changed: boolean;
  hits: string[];
}

const PATTERNS: Array<{ name: string; re: RegExp; replacement: string }> = [
  // E-mails
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/gi, replacement: "[email]" },
  // Telefones BR (com/sem DDD, com/sem +55)
  { name: "phone", re: /(\+?55\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g, replacement: "[telefone]" },
  // CPF
  { name: "cpf", re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: "[cpf]" },
  // CNPJ
  { name: "cnpj", re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replacement: "[cnpj]" },
  // RG (heurístico)
  { name: "rg", re: /\bRG[:\s]*\d[\d.\-Xx]{5,}\b/gi, replacement: "[rg]" },
  // Datas completas dd/mm/aaaa (mantém o ano isolado em outros contextos)
  { name: "date", re: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, replacement: "[data]" },
  // Prontuário / matrícula
  { name: "prontuario", re: /\b(prontu[aá]rio|matr[ií]cula|registro)\s*(n[ºo]\.?|:)?\s*\d{3,}\b/gi, replacement: "[prontuario]" },
  // Leito
  { name: "leito", re: /\bleito\s*(n[ºo]\.?)?\s*\d+\b/gi, replacement: "leito [n]" },
  // Hospitais comuns BR (heurístico — siglas e palavras-chave)
  { name: "hospital_sigla", re: /\b(HC|HCFMUSP|HCor|InCor|HUPE|HUCFF|HFA|HSL|HIAE|INCA|FMUSP|UNIFESP|HSPM|HMSL|Sirio[\s-]?Liban[eê]s|Albert\s+Einstein|S[aã]o\s+Lucas|Santa\s+Casa)\b/g, replacement: "[hospital]" },
  { name: "hospital_kw", re: /\b(hospital|cl[ií]nica|UPA|UBS|UTI|pronto[\s-]?socorro|PS)\s+(do|da|de|dos|das)?\s*[A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+){0,3}/g, replacement: "[hospital]" },
  // Idade com nome ("João, 56 anos" / "paciente Maria de 72 anos")
  { name: "named_age", re: /\b([A-ZÀ-Ú][a-zà-ú]{2,})\s*,?\s*(de\s+)?\d{1,3}\s+anos\b/g, replacement: "paciente $2[idade] anos" },
  // CEP
  { name: "cep", re: /\b\d{5}-?\d{3}\b/g, replacement: "[cep]" },
];

// Nomes próprios em contextos clínicos (heurística defensiva)
// "paciente João", "Sr. Silva", "Sra. Maria", "Dr. Carlos"
const NAMED_PERSON = /\b(paciente|sr\.?|sra\.?|dr\.?|dra\.?|enfermeir[oa]|m[eé]dic[oa])\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?/g;

// Locais específicos ("em São Paulo no bairro X", "moro em ...")
const LOCATION_HINT = /\b(moro|resido|trabalho|atendo|interna[dr]?o?)\s+(em|no|na|nos|nas)\s+[A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+){0,2}/gi;

export function sanitizePII(input: string): SanitizeResult {
  if (!input || typeof input !== "string") return { text: input || "", changed: false, hits: [] };
  let text = input;
  const hits: string[] = [];

  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      hits.push(p.name);
      p.re.lastIndex = 0;
      text = text.replace(p.re, p.replacement);
    }
  }

  if (NAMED_PERSON.test(text)) {
    hits.push("named_person");
    NAMED_PERSON.lastIndex = 0;
    text = text.replace(NAMED_PERSON, (_, role) => `${role} [nome]`);
  }

  if (LOCATION_HINT.test(text)) {
    hits.push("location");
    LOCATION_HINT.lastIndex = 0;
    text = text.replace(LOCATION_HINT, (_m, verb, prep) => `${verb} ${prep} [local]`);
  }

  return { text, changed: hits.length > 0, hits };
}

/** True se o texto contém marcadores claros de PII que NUNCA devem ir para scope='global'. */
export function hasHardPII(input: string): boolean {
  if (!input) return false;
  return /[\w.+-]+@[\w-]+\.[\w.-]+/.test(input) // email
    || /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(input) // cpf
    || /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/.test(input) // cnpj
    || /(\+?55\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/.test(input); // phone
}
