export interface TopicGuardResult {
  allowed: boolean;
  reason: string;
  matched_fields: string[];
  requested_topic: string;
  question_topic: string;
  question_subtopic: string;
  question_competency: string;
  score: number;
}

const normalizeTopicLabel = (value: unknown): string => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[.,;:!?()[\]{}"']/g, "")
  .replace(/\s+/g, " ");

const GENERIC_TOPIC_LABELS = new Set([
  "",
  "geral",
  "general",
  "clinica medica",
  "ciclo clinico",
  "internato",
]);

const SPECIALTY_VISIBLE_TOPIC_ALLOWLIST: Record<string, string[]> = {
  "angiologia": ["doenca arterial periferica", "trombose venosa profunda", "aneurisma de aorta", "varizes", "insuficiencia venosa", "linfangite e erisipela"],
  "cardiologia": ["iam", "iam com supra", "iam com supra de st", "iam sem supra", "infarto", "infarto agudo do miocardio", "insuficiencia cardiaca", "arritmias", "arritmias cardiacas", "valvopatias", "hipertensao arterial", "hipertensao arterial sistemica", "endocardite", "endocardite infecciosa", "pericardite", "tamponamento", "cardiopatias congenitas", "miocardiopatias", "crise hipertensiva", "doenca coronariana", "sindrome coronariana aguda", "sindromes coronarianas agudas", "sca"],
  "dermatologia": ["dermatoses infecciosas", "dermatoses autoimunes", "cancer de pele", "hanseniase", "psoriase", "dermatite atopica", "lesoes elementares da pele", "piodermites", "dermatoviroses", "dermatozoonoses"],
  "endocrinologia": ["diabetes mellitus", "cetoacidose diabetica", "tireoidopatias", "sindrome de cushing", "insuficiencia adrenal", "disturbios da paratireoide", "obesidade", "sindrome hiperosmolar", "dislipidemias"],
  "gastroenterologia": ["doenca do refluxo", "ulcera peptica", "doenca inflamatoria intestinal", "hepatites virais", "cirrose hepatica", "pancreatite", "doenca celiaca", "hemorragia digestiva", "disturbios motores do esofago", "dispepsia e gastrite", "doenca diverticular", "doenca de caroli"],
  "hematologia": ["anemias", "leucemias", "linfomas", "coagulopatias", "trombocitopenias", "hemoglobinopatias", "disturbios da hemostasia"],
  "infectologia": ["hiv", "aids", "tuberculose", "meningites", "sepse", "infeccoes oportunistas", "dengue", "leptospirose", "hepatites", "covid-19", "endocardite infecciosa", "arboviroses", "resistencia antimicrobiana"],
  "nefrologia": ["insuficiencia renal aguda", "doenca renal cronica", "glomerulopatias", "disturbios hidroeletroliticos", "disturbios acido-base", "sindrome nefrotica", "sindrome nefritica"],
  "neurologia": ["avc isquemico", "avc hemorragico", "epilepsia", "cefaleias", "esclerose multipla", "parkinson", "neuropatias perifericas", "meningites", "demencias", "neuropatia diabetica"],
  "oftalmologia": ["glaucoma", "catarata", "retinopatia diabetica", "descolamento de retina", "conjuntivites", "trauma ocular"],
  "oncologia": ["cancer de mama", "cancer de pulmao", "cancer colorretal", "cancer gastrico", "estadiamento tnm", "sindromes paraneoplasicas", "neutropenia febril", "cancer de endometrio", "cancer de ovario"],
  "ortopedia": ["fraturas", "luxacoes", "osteomielite", "artrose", "lombalgia", "trauma musculoesqueletico", "lesoes ligamentares"],
  "otorrinolaringologia": ["otite media", "sinusite", "faringite", "tonsilite", "vertigem", "perda auditiva"],
  "pneumologia": ["asma", "dpoc", "pneumonia", "tuberculose pulmonar", "tromboembolismo pulmonar", "tep", "derrame pleural", "cancer de pulmao", "sdra", "fibrose pulmonar", "propedeutica respiratoria", "micoses pulmonares", "pneumonia nosocomial"],
  "psiquiatria": ["depressao", "transtorno bipolar", "esquizofrenia", "transtornos de ansiedade", "toc", "tept", "dependencia quimica", "emergencias psiquiatricas"],
  "reumatologia": ["artrite reumatoide", "lupus eritematoso sistemico", "espondiloartrites", "gota", "vasculites", "esclerodermia", "fibromialgia"],
  "urologia": ["litiase renal", "hiperplasia prostatica", "cancer de prostata", "infeccao urinaria", "trauma urologico", "incontinencia urinaria"],
  "cirurgia": ["cirurgia geral", "abdome agudo", "apendicite", "colecistite", "hernias", "trauma abdominal", "trauma toracico", "pre e pos-operatorio", "queimaduras", "politrauma", "abdome agudo obstrutivo", "doenca hemorroidaria", "ulcera perfurada", "doenca diverticular", "isquemia mesenterica", "fistulas digestivas"],
  "ginecologia e obstetricia": ["ginecologia", "obstetricia", "pre-eclampsia", "eclampsia", "pre-natal", "trabalho de parto", "hemorragias da gestacao", "infeccoes na gestacao", "cancer de colo", "endometriose", "sop", "climaterio", "placenta previa", "dpp", "diabetes gestacional", "distocias", "cesariana", "trabalho de parto prematuro", "puerperio", "anticoncepcao", "ists na ginecologia"],
  "medicina de emergencia": ["emergencia", "urgencia e emergencia", "pcr e rcp", "choque", "intoxicacoes", "anafilaxia", "trauma", "emergencias hipertensivas", "cetoacidose diabetica", "status epileptico", "choque hipovolemico"],
  "medicina preventiva": ["epidemiologia", "vigilancia em saude", "sus", "atencao primaria", "vacinacao", "saude do trabalhador", "bioestatistica", "estudos epidemiologicos", "sistemas de informacao em saude", "indicadores de saude", "niveis de prevencao", "notificacao compulsoria", "etica e bioetica medica", "determinantes sociais de saude"],
  "pediatria": ["neonatologia", "aleitamento materno", "crescimento e desenvolvimento", "infeccoes na infancia", "asma infantil", "bronquiolite", "doencas exantematicas", "desnutricao", "imunizacao", "ivas", "pneumonia na crianca", "itu na crianca", "tuberculose na crianca", "piodermites na crianca", "reanimacao neonatal", "ictericia neonatal", "infeccoes congenitas torch", "desidratacao na crianca", "meningite na crianca", "febre sem foco", "convulsao febril"],
  "terapia intensiva": ["ventilacao mecanica", "sepse e choque septico", "disturbios hidroeletroliticos", "sedacao e analgesia", "monitorizacao hemodinamica", "sdra", "nutricao enteral e parenteral"],
};

function labelsAreCompatible(candidate: string, accepted: string[]): boolean {
  const normalized = normalizeTopicLabel(candidate);
  if (!normalized || GENERIC_TOPIC_LABELS.has(normalized)) return true;
  return accepted.some((label) =>
    normalized === label ||
    normalized.includes(label) ||
    label.includes(normalized)
  );
}

/**
 * Guards against a contaminated broad metadata field masking the visible topic.
 * Example rejected: requested Cardiology, curriculum_theme=Cardiology, topic=Doença de Caroli.
 */
export function isVisibleTopicCompatibleWithRequest(
  question: any,
  requestedTopic: string,
  requestedCompetency?: string,
): boolean {
  const requested = normalizeTopicLabel(requestedTopic);
  const requestedComp = normalizeTopicLabel(requestedCompetency);
  const allowlist = SPECIALTY_VISIBLE_TOPIC_ALLOWLIST[requested];
  if (!requested || !allowlist) return true;

  const accepted = Array.from(new Set([requested, requestedComp, ...allowlist].filter(Boolean)));
  const visibleSpecificTopics = [question?.topic, question?.subtopic]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .filter((value) => !GENERIC_TOPIC_LABELS.has(normalizeTopicLabel(value)));

  if (visibleSpecificTopics.length === 0) return true;
  return visibleSpecificTopics.some((candidate) => labelsAreCompatible(candidate, accepted));
}

/**
 * FINAL TOPIC GUARD
 * Mandatory validation for every question in a thematic simulation.
 */
export function validateFinalQuestionTopic(
  question: any,
  requestedTopic: string,
  requestedCompetency?: string,
  minScore = 90,
  allowedAliases: string[] = [] // HOTFIX 3: Explicit aliases allowed
): TopicGuardResult {
  const qTopic = normalizeTopicLabel(question.topic);
  const qSubtopic = normalizeTopicLabel(question.subtopic);
  const qTheme = normalizeTopicLabel(question.curriculum_theme);
  const qSubtheme = normalizeTopicLabel(question.curriculum_subtheme);
  const qCompetency = normalizeTopicLabel(question.curriculum_competency);
  
  const reqTopicLower = normalizeTopicLabel(requestedTopic);
  const reqCompLower = normalizeTopicLabel(requestedCompetency);

  const matchedFields: string[] = [];
  let score = 0;

  // 1. Exact Competency Match (Priority 1)
  if (reqCompLower && reqCompLower.length > 0 && [qCompetency, qSubtopic, qSubtheme].some(val => val === reqCompLower)) {
    matchedFields.push("curriculum_competency");
    score = 100;
  }

  // 2. Exact Topic/Theme Match (Priority 2)
  if (score < 100 && reqTopicLower.length > 0) {
    const isTopicMatch = [qTopic, qTheme].some(val => val === reqTopicLower) || 
                         allowedAliases.some(alias => [qTopic, qTheme].includes(normalizeTopicLabel(alias)));
    
    const isSubtopicMatch = [qSubtopic, qSubtheme].some(val => val === reqTopicLower) ||
                            allowedAliases.some(alias => [qSubtopic, qSubtheme].includes(normalizeTopicLabel(alias)));

    if (isTopicMatch) {
      matchedFields.push("topic");
      score = (reqCompLower && reqCompLower.length > 0) ? 70 : 100;
    } else if (isSubtopicMatch) {
      matchedFields.push("subtopic");
      score = (reqCompLower && reqCompLower.length > 0) ? 60 : 95;
    }
  }

  // 3. Partial/Alias Match
  if (score === 0) {
    if ([qTopic, qTheme, qSubtopic, qSubtheme, qCompetency].some(val => val.includes(reqTopicLower))) {
      matchedFields.push("partial_inclusion");
      score = 50; 
    }
  }

  const allowed = score >= minScore;

  return {
    allowed,
    reason: allowed ? "MATCH_CONFIRMED" : (score === 0 ? "TOPIC_MISMATCH" : "INSUFFICIENT_SPECIFICITY"),
    matched_fields: matchedFields,
    requested_topic: requestedTopic,
    question_topic: question.topic,
    question_subtopic: question.subtopic,
    question_competency: question.curriculum_competency,
    score
  };
}
