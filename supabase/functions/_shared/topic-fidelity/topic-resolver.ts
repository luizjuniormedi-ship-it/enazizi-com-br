/**
 * TOPIC FIDELITY RESOLVER — Sprint V1 / Fase 1 (read-only, observacional)
 *
 * Classifica a granularidade do tema pedido pelo aluno SEM bloquear nada.
 * Toda a lógica é pura, in-memory e síncrona — sem I/O nem dependência
 * de Deno.* ou Supabase, para poder rodar em Vitest (Node) e Edge (Deno).
 *
 * Granularidade:
 *   1 = Especialidade ampla (genérico — ex.: "Clínica Médica", "Cirurgia")
 *   2 = Sistema/área dentro da especialidade (ex.: "Cardiologia")  — ainda genérico
 *   3 = Tema clínico específico (ex.: "IAM", "TEP", "Pré-eclâmpsia") — GRANULAR
 */

// ─── Blocklist oficial (não-granular, nunca passa) ──────────────────────────
const GENERIC_SPECIALTIES = [
  "clinica medica", "clínica médica",
  "cirurgia", "cirurgia geral",
  "pediatria",
  "go", "ginecologia e obstetricia", "ginecologia e obstetrícia",
  "ginecologia", "obstetricia", "obstetrícia",
  "preventiva", "medicina preventiva", "medicina de familia", "medicina de família",
];

// ─── Sistemas/áreas (level 2 — ainda não específico o suficiente) ───────────
const GENERIC_SYSTEMS = [
  "cardiologia", "pneumologia", "neurologia", "nefrologia", "endocrinologia",
  "gastroenterologia", "hematologia", "reumatologia", "infectologia",
  "dermatologia", "psiquiatria", "geriatria", "oncologia",
  "trauma", "abdome agudo", "urgencia", "urgência",
];

// ─── Temas granulares conhecidos (level 3 — PASS) ───────────────────────────
const KNOWN_GRANULAR: Record<string, { specialty: string; system: string }> = {
  // Cardiologia
  "iam": { specialty: "Clínica Médica", system: "Cardiologia" },
  "infarto agudo do miocardio": { specialty: "Clínica Médica", system: "Cardiologia" },
  "ic": { specialty: "Clínica Médica", system: "Cardiologia" },
  "insuficiencia cardiaca": { specialty: "Clínica Médica", system: "Cardiologia" },
  "insuficiência cardíaca": { specialty: "Clínica Médica", system: "Cardiologia" },
  "fa": { specialty: "Clínica Médica", system: "Cardiologia" },
  "fibrilacao atrial": { specialty: "Clínica Médica", system: "Cardiologia" },
  "has": { specialty: "Clínica Médica", system: "Cardiologia" },
  "hipertensao arterial": { specialty: "Clínica Médica", system: "Cardiologia" },
  "sca": { specialty: "Clínica Médica", system: "Cardiologia" },
  "nstemi": { specialty: "Clínica Médica", system: "Cardiologia" },
  "stemi": { specialty: "Clínica Médica", system: "Cardiologia" },

  // Pneumologia
  "asma": { specialty: "Clínica Médica", system: "Pneumologia" },
  "dpoc": { specialty: "Clínica Médica", system: "Pneumologia" },
  "tep": { specialty: "Clínica Médica", system: "Pneumologia" },
  "tromboembolismo pulmonar": { specialty: "Clínica Médica", system: "Pneumologia" },
  "pneumonia": { specialty: "Clínica Médica", system: "Pneumologia" },
  "pac": { specialty: "Clínica Médica", system: "Pneumologia" },
  "tuberculose": { specialty: "Clínica Médica", system: "Infectologia" },

  // Infectologia
  "sepse": { specialty: "Clínica Médica", system: "Infectologia" },
  "hiv": { specialty: "Clínica Médica", system: "Infectologia" },
  "dengue": { specialty: "Clínica Médica", system: "Infectologia" },

  // Gastro
  "litiase biliar": { specialty: "Clínica Médica", system: "Gastroenterologia" },
  "litíase biliar": { specialty: "Clínica Médica", system: "Gastroenterologia" },
  "colelitiase": { specialty: "Clínica Médica", system: "Gastroenterologia" },
  "pancreatite": { specialty: "Clínica Médica", system: "Gastroenterologia" },
  "hepatite": { specialty: "Clínica Médica", system: "Gastroenterologia" },

  // Cirurgia
  "apendicite": { specialty: "Cirurgia", system: "Abdome Agudo" },
  "hernia inguinal": { specialty: "Cirurgia", system: "Hérnias" },
  "hérnia inguinal": { specialty: "Cirurgia", system: "Hérnias" },
  "colecistite": { specialty: "Cirurgia", system: "Abdome Agudo" },

  // GO
  "pre-eclampsia": { specialty: "GO", system: "Obstetrícia" },
  "pré-eclâmpsia": { specialty: "GO", system: "Obstetrícia" },
  "preeclampsia": { specialty: "GO", system: "Obstetrícia" },
  "eclampsia": { specialty: "GO", system: "Obstetrícia" },
  "eclâmpsia": { specialty: "GO", system: "Obstetrícia" },
  "hemorragia pos-parto": { specialty: "GO", system: "Obstetrícia" },
  "hemorragia pós-parto": { specialty: "GO", system: "Obstetrícia" },
  "hpp": { specialty: "GO", system: "Obstetrícia" },

  // Pediatria
  "bronquiolite": { specialty: "Pediatria", system: "Pneumologia Pediátrica" },
  "icterícia neonatal": { specialty: "Pediatria", system: "Neonatologia" },
  "ictericia neonatal": { specialty: "Pediatria", system: "Neonatologia" },
};

// ─── Sugestões por sistema (quando aluno digita só "Cardiologia") ──────────
const SUGGESTIONS_BY_SYSTEM: Record<string, string[]> = {
  "cardiologia": ["IAM", "Insuficiência Cardíaca", "FA", "HAS", "STEMI vs NSTEMI"],
  "pneumologia": ["Asma", "DPOC", "TEP", "Pneumonia"],
  "infectologia": ["Sepse", "HIV", "Tuberculose", "Dengue"],
  "gastroenterologia": ["Litíase Biliar", "Pancreatite", "Hepatite"],
  "neurologia": ["AVC", "Cefaleia", "Epilepsia"],
  "clinica medica": ["Cardiologia → IAM", "Pneumologia → TEP", "Infectologia → Sepse"],
  "clínica médica": ["Cardiologia → IAM", "Pneumologia → TEP", "Infectologia → Sepse"],
  "cirurgia": ["Apendicite", "Colecistite", "Hérnia Inguinal", "Trauma Abdominal"],
  "pediatria": ["Bronquiolite", "Icterícia Neonatal", "Imunização"],
  "go": ["Pré-eclâmpsia", "Hemorragia Pós-Parto", "Trabalho de Parto"],
  "ginecologia": ["DIPA", "Sangramento Uterino Anormal"],
  "obstetricia": ["Pré-eclâmpsia", "Hemorragia Pós-Parto"],
  "obstetrícia": ["Pré-eclâmpsia", "Hemorragia Pós-Parto"],
};

// ─── Tipos ─────────────────────────────────────────────────────────────────
export interface TopicFidelityResult {
  rawInput: string;
  normalized: string;
  level: 0 | 1 | 2 | 3;
  specialty: string | null;
  system: string | null;
  topic: string | null;
  subtopic: string | null;
  isGranular: boolean;
  isGeneric: boolean;
  suggestions: string[];
  confidence: number;
  matchedVia: "exact_granular" | "system_generic" | "specialty_generic" | "unknown" | "empty";
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics for matching
    .replace(/\s+/g, " ");
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

// ─── API principal ─────────────────────────────────────────────────────────
export function resolveTopicGranularity(input: string): TopicFidelityResult {
  const raw = String(input || "");
  const norm = normalize(raw);

  if (!norm) {
    return {
      rawInput: raw, normalized: "", level: 0,
      specialty: null, system: null, topic: null, subtopic: null,
      isGranular: false, isGeneric: false,
      suggestions: [], confidence: 0, matchedVia: "empty",
    };
  }

  // 1) Match exato em tema granular (level 3)
  if (KNOWN_GRANULAR[norm]) {
    const meta = KNOWN_GRANULAR[norm];
    return {
      rawInput: raw, normalized: norm, level: 3,
      specialty: meta.specialty, system: meta.system, topic: titleCase(raw.trim()), subtopic: null,
      isGranular: true, isGeneric: false,
      suggestions: [], confidence: 0.98, matchedVia: "exact_granular",
    };
  }

  // 1b) Padrão "Especialidade > Sistema > Tema" (separadores comuns)
  const parts = raw.split(/\s*(?:>|→|\/|\||-{2,})\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = normalize(parts[parts.length - 1]);
    if (KNOWN_GRANULAR[last]) {
      const meta = KNOWN_GRANULAR[last];
      return {
        rawInput: raw, normalized: norm, level: 3,
        specialty: meta.specialty, system: meta.system, topic: titleCase(parts[parts.length - 1]), subtopic: null,
        isGranular: true, isGeneric: false,
        suggestions: [], confidence: 0.95, matchedVia: "exact_granular",
      };
    }
    // ex.: "GO > Pré-eclâmpsia" — último segmento granular conhecido
    // já tratado acima; se chegou aqui o último não é granular conhecido → continua
  }

  // 2) Sistema (level 2 — genérico, oferece sugestões)
  if (GENERIC_SYSTEMS.includes(norm)) {
    return {
      rawInput: raw, normalized: norm, level: 2,
      specialty: null, system: titleCase(raw.trim()), topic: null, subtopic: null,
      isGranular: false, isGeneric: true,
      suggestions: SUGGESTIONS_BY_SYSTEM[norm] || [],
      confidence: 0.9, matchedVia: "system_generic",
    };
  }

  // 3) Especialidade ampla (level 1 — genérico forte)
  if (GENERIC_SPECIALTIES.includes(norm)) {
    return {
      rawInput: raw, normalized: norm, level: 1,
      specialty: titleCase(raw.trim()), system: null, topic: null, subtopic: null,
      isGranular: false, isGeneric: true,
      suggestions: SUGGESTIONS_BY_SYSTEM[norm] || [],
      confidence: 0.95, matchedVia: "specialty_generic",
    };
  }

  // 4) Desconhecido — tratamos como provavelmente granular (nome próprio de tema),
  //    confidence baixa, NÃO marca como generic.
  return {
    rawInput: raw, normalized: norm, level: 3,
    specialty: null, system: null, topic: titleCase(raw.trim()), subtopic: null,
    isGranular: true, isGeneric: false,
    suggestions: [], confidence: 0.5, matchedVia: "unknown",
  };
}

// ─── Logger padronizado (não persiste — apenas console.log) ────────────────
export function logTopicFidelity(source: string, r: TopicFidelityResult) {
  try {
    console.log(`[TOPIC_FIDELITY_START] source=${source} raw="${r.rawInput.slice(0, 80)}"`);
    if (r.matchedVia === "empty") {
      console.warn(`[TOPIC_FIDELITY_FAIL] source=${source} reason=empty_input`);
      return;
    }
    if (r.isGeneric) {
      console.warn(`[TOPIC_FIDELITY_GENERIC] source=${source} level=${r.level} matched=${r.matchedVia} system=${r.system || "-"} specialty=${r.specialty || "-"} confidence=${r.confidence}`);
      if (r.suggestions.length) {
        console.warn(`[TOPIC_FIDELITY_SUGGESTIONS] source=${source} list=${JSON.stringify(r.suggestions)}`);
      }
    } else {
      console.log(`[TOPIC_FIDELITY_GRANULAR] source=${source} level=${r.level} topic="${r.topic}" system=${r.system || "-"} specialty=${r.specialty || "-"} confidence=${r.confidence} matched=${r.matchedVia}`);
    }
  } catch { /* fire-and-forget */ }
}
