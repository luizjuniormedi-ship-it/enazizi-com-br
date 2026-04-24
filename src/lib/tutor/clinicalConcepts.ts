/**
 * Dicionário clínico expandido para a Memory Intelligence Layer do Tutor IA.
 *
 * Três utilitários:
 *   - extractClinicalKeywords(text):    sintomas/sinais clínicos detectados
 *   - extractMedicalAbbreviations(text): siglas médicas detectadas (originais)
 *   - expandClinicalConcepts(text):     texto expandido com sinônimos/expansões
 *
 * Tudo determinístico (regex + dicionário). Sem IA. Funciona no browser e no Deno.
 */

// ── Sintomas / sinais clínicos ──────────────────────────────────────────────
// Cada chave é o keyword normalizado que vai pro array `symptom_keywords`.
// Os valores são variações textuais (sem acento, lowercase) que ativam.
const SYMPTOM_DICTIONARY: Record<string, string[]> = {
  dispneia: ["dispneia", "falta de ar", "falta ar", "dispneico"],
  ortopneia: ["ortopneia", "deita falta ar"],
  dpn: ["dpn", "dispneia paroxistica noturna", "paroxistica noturna"],
  edema: ["edema", "inchaco", "inchaço", "edemaciado"],
  edema_mmii: ["edema mmii", "edema membros inferiores", "edema pernas"],
  edema_pulmonar: ["edema agudo pulmao", "edema pulmonar", "eap"],
  febre: ["febre", "febril", "hipertermia"],
  dor_toracica: ["dor toracica", "dor no peito", "precordialgia", "dor precordial"],
  sincope: ["sincope", "desmaio", "perda consciencia"],
  pre_sincope: ["pre sincope", "lipotimia", "tontura"],
  tosse: ["tosse", "tossindo"],
  hemoptise: ["hemoptise", "tosse com sangue"],
  hipoxemia: ["hipoxemia", "saturacao baixa", "sat baixa", "dessaturacao"],
  taquicardia: ["taquicardia", "fc elevada", "frequencia cardiaca alta"],
  bradicardia: ["bradicardia", "fc baixa"],
  hipotensao: ["hipotensao", "pa baixa", "pressao baixa", "choque"],
  hipertensao: ["hipertensao", "pa alta", "pressao alta", "crise hipertensiva"],
  b3: ["b3", "terceira bulha", "ritmo de galope"],
  estertores: ["estertores", "creptantes", "estertores crepitantes"],
  turgencia_jugular: ["turgencia jugular", "tj+", "tjp"],
  hepatomegalia: ["hepatomegalia", "figado aumentado"],
  cianose: ["cianose", "cianotico"],
  palidez: ["palidez", "palido", "descorado"],
  sudorese: ["sudorese", "diaforese", "sudoreico"],
  cefaleia: ["cefaleia", "dor de cabeca"],
  hemiparesia: ["hemiparesia", "fraqueza um lado", "deficit hemicorporal"],
  afasia: ["afasia", "perda fala", "dificuldade falar"],
  disartria: ["disartria", "fala arrastada"],
  convulsao: ["convulsao", "crise epileptica"],
  rebaixamento: ["rebaixamento", "alteracao consciencia", "torpor", "coma"],
  vomito: ["vomito", "emese", "vomitando"],
  diarreia: ["diarreia"],
  melena: ["melena", "fezes pretas"],
  hematemese: ["hematemese", "vomito com sangue"],
  hematuria: ["hematuria", "urina com sangue"],
  oliguria: ["oliguria", "diurese diminuida"],
  anuria: ["anuria"],
  icterícia: ["ictericia", "icterico", "amarelado"],
  sibilos: ["sibilos", "chiado", "sibilancia"],
  roncos: ["roncos"],
  hipercapnia: ["hipercapnia", "co2 alto", "pco2 alta"],
  acidose: ["acidose", "ph baixo"],
  alcalose: ["alcalose", "ph alto"],
  anemia: ["anemia", "hb baixa", "hemoglobina baixa"],
  ferritina_baixa: ["ferritina baixa", "deficiencia ferro"],
  fa: ["fibrilacao atrial", "fa de alta resposta"],
  fe_reduzida: ["feve reduzida", "fe reduzida", "fracao ejecao reduzida"],
};

// ── Abreviações médicas (cada um é uma unidade lexical para overlap) ────────
// Reusa o conjunto de normalizeQuestion mas expande com mais entradas.
const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  ic: "insuficiencia cardiaca",
  icc: "insuficiencia cardiaca congestiva",
  icfer: "insuficiencia cardiaca fracao ejecao reduzida",
  icfep: "insuficiencia cardiaca fracao ejecao preservada",
  icfei: "insuficiencia cardiaca fracao ejecao intermediaria",
  feve: "fracao ejecao ventriculo esquerdo",
  iam: "infarto agudo miocardio",
  iamcsst: "infarto agudo miocardio com supradesnivelamento st",
  iamssst: "infarto agudo miocardio sem supradesnivelamento st",
  sca: "sindrome coronariana aguda",
  dac: "doenca arterial coronariana",
  tep: "tromboembolismo pulmonar",
  tvp: "trombose venosa profunda",
  avc: "acidente vascular cerebral",
  avci: "acidente vascular cerebral isquemico",
  avch: "acidente vascular cerebral hemorragico",
  ait: "ataque isquemico transitorio",
  dpoc: "doenca pulmonar obstrutiva cronica",
  sdra: "sindrome desconforto respiratorio agudo",
  hda: "hemorragia digestiva alta",
  hdb: "hemorragia digestiva baixa",
  has: "hipertensao arterial sistemica",
  dm: "diabetes mellitus",
  dm2: "diabetes mellitus tipo 2",
  dm1: "diabetes mellitus tipo 1",
  dlp: "dislipidemia",
  irc: "insuficiencia renal cronica",
  drc: "doenca renal cronica",
  ira: "insuficiencia renal aguda",
  lra: "lesao renal aguda",
  itu: "infeccao trato urinario",
  ivas: "infeccao vias aereas superiores",
  pcr: "parada cardiorrespiratoria",
  fa: "fibrilacao atrial",
  tsv: "taquicardia supraventricular",
  tv: "taquicardia ventricular",
  fv: "fibrilacao ventricular",
  bav: "bloqueio atrioventricular",
  b3: "terceira bulha",
  dpn: "dispneia paroxistica noturna",
  nyha: "new york heart association",
  eap: "edema agudo pulmao",
  bcp: "broncopneumonia",
  pac: "pneumonia adquirida comunidade",
  pavm: "pneumonia associada ventilacao mecanica",
  hsa: "hemorragia subaracnoidea",
  hic: "hipertensao intracraniana",
  meningite: "meningite",
  sepse: "sepse",
  nihss: "national institutes of health stroke scale escala avc",
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(s: string): string {
  return stripDiacritics((s || "").toLowerCase());
}

/** Detecta sintomas/sinais clínicos no texto (ordem do dicionário). */
export function extractClinicalKeywords(text: string): string[] {
  if (!text) return [];
  const norm = normalize(text);
  const found = new Set<string>();
  for (const [keyword, variants] of Object.entries(SYMPTOM_DICTIONARY)) {
    for (const v of variants) {
      if (norm.includes(v)) {
        found.add(keyword);
        break;
      }
    }
  }
  return [...found];
}

/** Detecta abreviações médicas (whole-word) no texto e devolve as siglas em lowercase. */
export function extractMedicalAbbreviations(text: string): string[] {
  if (!text) return [];
  const norm = normalize(text);
  const found = new Set<string>();
  const tokens = norm.match(/\b[a-z]{2,7}\b/g) ?? [];
  for (const t of tokens) {
    if (MEDICAL_ABBREVIATIONS[t]) {
      found.add(t);
    }
  }
  return [...found];
}

/**
 * Expande conceitos clínicos no texto: para cada abreviação encontrada,
 * acrescenta a forma expandida ao texto. Mantém a sigla original.
 */
export function expandClinicalConcepts(text: string): string {
  if (!text) return text;
  return text.replace(/\b([a-zA-ZÀ-ÿ]{2,7})\b/g, (match) => {
    const exp = MEDICAL_ABBREVIATIONS[normalize(match)];
    return exp ? `${match} ${exp}` : match;
  });
}

/** Util para classificar o tamanho da query (usado por threshold dinâmico). */
export function classifyQueryLength(text: string): "short" | "medium" | "long" {
  const t = (text || "").trim();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 4) return "short";
  if (wordCount <= 10) return "medium";
  return "long";
}

/** Threshold dinâmico baseado em tamanho da pergunta. */
export function dynamicSemanticThreshold(text: string): number {
  const len = classifyQueryLength(text);
  if (len === "short") return 0.45;
  if (len === "medium") return 0.55;
  return 0.65;
}

/** Threshold mínimo efetivo quando há overlaps clínicos. */
export const HYBRID_MIN_THRESHOLD = 0.35;
