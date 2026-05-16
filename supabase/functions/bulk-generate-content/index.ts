import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
// Lazy import pipeline engine to avoid top-level side effects if any
// import { createPipelineJob, updatePipelineJob, completePipelineJob, failPipelineJob } from "../_shared/pipeline-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INVALID_CONTENT_REGEX = /(declara[cç][aã]o financeira|declara[cç][oõ]es de interesse|pagamento de qualquer esp[eé]cie|empresa farmac[eê]utica|ind[uú]stria farmac[eê]utica|honor[aá]rio|palestrante remunerado|conflito de interesse|relat[oó]rio de interesse)/i;

const BASIC_SCIENCES = [
  "Anatomia", "Bioquímica", "Embriologia", "Farmacologia", "Fisiologia",
  "Genética Médica", "Histologia", "Imunologia", "Microbiologia",
  "Parasitologia", "Patologia", "Semiologia",
];

const TARGET_CLINICAL = 400;
const TARGET_BASIC = 250;

const SPECIALTIES = [
  "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
  "Gastroenterologia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cirurgia", "Medicina Preventiva", "Nefrologia",
  "Infectologia", "Hematologia", "Reumatologia", "Dermatologia",
  "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia",
  "Otorrinolaringologia", "Medicina de Emergência", "Semiologia", "Anatomia", "Farmacologia",
  "Oncologia", "Fisiologia", "Bioquímica", "Angiologia",
  "Histologia", "Embriologia", "Microbiologia", "Imunologia",
  "Parasitologia", "Genética Médica", "Patologia",
  "Terapia Intensiva",
];

const TOPICS_BY_SPECIALTY: Record<string, string[]> = {
  "Cardiologia": ["Insuficiência Cardíaca", "IAM", "Arritmias", "Valvopatias", "Hipertensão Arterial", "Endocardite", "Pericardite", "Cardiopatias Congênitas", "Doença Coronariana", "Choque Cardiogênico", "Fibrilação Atrial", "Síndrome Coronariana Aguda", "Dissecção de Aorta", "Tromboembolismo Pulmonar", "Miocardiopatias"],
  "Pneumologia": ["Pneumonia", "DPOC", "Asma", "TEP", "Tuberculose", "Derrame Pleural", "Pneumotórax", "Fibrose Pulmonar", "SDRA", "Câncer de Pulmão", "Bronquiectasia", "Sarcoidose", "Apneia do Sono", "Insuficiência Respiratória"],
  "Neurologia": ["AVC Isquêmico", "AVC Hemorrágico", "Epilepsia", "Meningite", "Esclerose Múltipla", "Parkinson", "Alzheimer", "Cefaleia", "Neuropatias", "Tumores Cerebrais", "Miastenia Gravis", "Guillain-Barré", "Hipertensão Intracraniana", "Trauma Cranioencefálico"],
  "Endocrinologia": ["Diabetes Mellitus Tipo 1", "Diabetes Mellitus Tipo 2", "Hipotireoidismo", "Hipertireoidismo", "Síndrome de Cushing", "Insuficiência Adrenal", "Feocromocitoma", "Hiperparatireoidismo", "Osteoporose", "Cetoacidose Diabética", "Estado Hiperosmolar", "Tireoidite de Hashimoto", "Doença de Graves", "Nódulos Tireoidianos"],
  "Gastroenterologia": ["Doença do Refluxo", "Úlcera Péptica", "Doença de Crohn", "Retocolite Ulcerativa", "Cirrose Hepática", "Hepatites Virais", "Pancreatite Aguda", "Pancreatite Crônica", "Colelitíase", "Colecistite", "Hemorragia Digestiva", "Doença Celíaca", "Síndrome do Intestino Irritável", "Câncer Colorretal"],
  "Pediatria": ["Bronquiolite", "Desidratação", "IVAS", "Otite Média", "Imunização", "Crescimento e Desenvolvimento", "Alergia Alimentar", "Febre Reumática", "Meningite Neonatal", "Icterícia Neonatal", "Distúrbios do Crescimento", "Asma Infantil", "Pneumonia Infantil", "Convulsão Febril"],
  "Ginecologia e Obstetrícia": ["Pré-eclâmpsia", "Eclâmpsia", "Diabetes Gestacional", "Placenta Prévia", "DPP", "Gravidez Ectópica", "Endometriose", "SOP", "Mioma Uterino", "Câncer de Colo do Útero", "Câncer de Mama", "Infecções Vaginais", "Parto Normal vs Cesárea", "Hemorragia Pós-Parto"],
  "Cirurgia": ["Apendicite", "Colecistite Aguda", "Obstrução Intestinal", "Hérnia Inguinal", "Abdome Agudo", "Trauma Abdominal", "Pancreatite Cirúrgica", "Diverticulite", "Câncer Gástrico", "Politraumatismo", "Queimaduras", "Choque Hipovolêmico", "Feridas Cirúrgicas", "Complicações Pós-Operatórias"],
  "Medicina Preventiva": ["Epidemiologia", "Vigilância em Saúde", "SUS", "Atenção Primária", "Rastreamento", "Saúde da Família", "Indicadores de Saúde", "Bioestatística", "Estudos Epidemiológicos", "Vacinação do Adulto", "Promoção da Saúde", "Saneamento Básico", "Doenças de Notificação Compulsória"],
  "Nefrologia": ["Insuficiência Renal Aguda", "Doença Renal Crônica", "Glomerulonefrites", "Síndrome Nefrótica", "Síndrome Nefrítica", "Distúrbios Hidroeletrolíticos", "Acidose e Alcalose", "Litíase Renal", "Infecção Urinária", "Transplante Renal", "Diálise", "Nefropatia Diabética"],
  "Infectologia": ["HIV/AIDS", "Dengue", "Malária", "Leishmaniose", "Tuberculose", "Hanseníase", "Hepatites Virais", "COVID-19", "Sepse", "Infecções Hospitalares", "Antibioticoterapia", "Febre Amarela", "Parasitoses Intestinais"],
  "Hematologia": ["Anemias", "Leucemias", "Linfomas", "Mieloma Múltiplo", "Coagulopatias", "Trombocitopenia", "Hemofilia", "CIVD", "Policitemia Vera", "Púrpura Trombocitopênica", "Anemia Falciforme", "Talassemias", "Hemotransfusão"],
  "Reumatologia": ["Artrite Reumatoide", "Lúpus Eritematoso", "Espondilite Anquilosante", "Gota", "Esclerodermia", "Síndrome de Sjögren", "Vasculites", "Fibromialgia", "Artrite Psoriásica", "Polimiosite", "Febre Reumática"],
  "Dermatologia": ["Psoríase", "Dermatite Atópica", "Urticária", "Melanoma", "Carcinoma Basocelular", "Hanseníase", "Micoses Superficiais", "Herpes Zoster", "Acne", "Pênfigo", "Lúpus Cutâneo"],
  "Ortopedia": ["Fraturas", "Luxações", "Osteomielite", "Artrose", "Lombalgia", "Hérnia de Disco", "Síndrome do Túnel do Carpo", "Lesões de Menisco", "Tendinites", "Osteoporose Ortopédica"],
  "Urologia": ["Hiperplasia Prostática", "Câncer de Próstata", "Litíase Urinária", "Infecção Urinária", "Câncer de Bexiga", "Torção Testicular", "Varicocele", "Fimose", "Incontinência Urinária"],
  "Psiquiatria": ["Depressão", "Transtorno Bipolar", "Esquizofrenia", "Transtorno de Ansiedade", "TOC", "TEPT", "Transtornos Alimentares", "Dependência Química", "Demência", "Psicofarmacologia"],
  "Medicina de Emergência": ["PCR e RCP", "Choque", "Intoxicações", "Anafilaxia", "Politrauma", "ATLS", "Queimaduras", "Afogamento", "Cetoacidose Diabética", "Crise Hipertensiva"],
  "Oftalmologia": ["Glaucoma", "Catarata", "Descolamento de Retina", "Retinopatia Diabética", "Conjuntivite", "Uveíte", "Trauma Ocular"],
  "Otorrinolaringologia": ["Otite", "Sinusite", "Amigdalite", "Perda Auditiva", "Vertigem", "Epistaxe", "Câncer de Laringe"],
  "Semiologia": ["Anamnese", "Exame Físico Geral", "Semiologia Cardiovascular", "Semiologia Pulmonar", "Semiologia Abdominal", "Semiologia Neurológica", "Sinais Vitais", "Propedêutica Armada", "Semiologia Osteoarticular", "Semiologia Vascular", "Semiologia do Pescoço", "Sinais Semiológicos Clássicos"],
  "Anatomia": ["Anatomia do Tórax", "Anatomia Abdominal", "Anatomia do Pescoço", "Neuroanatomia", "Anatomia do Membro Superior", "Anatomia do Membro Inferior", "Anatomia Pélvica", "Anatomia Vascular", "Anatomia Cardíaca", "Anatomia do Sistema Nervoso Periférico", "Anatomia Topográfica Cirúrgica"],
  "Farmacologia": ["Farmacocinética (ADME)", "Farmacodinâmica e Receptores", "Antibioticoterapia e Mecanismos de Resistência", "Anti-hipertensivos e Vasodilatadores", "Antiarrítmicos", "Anticoagulantes e Antiplaquetários", "AINEs e Corticoides", "Analgésicos e Opioides", "Psicofarmacologia", "Quimioterápicos e Imunossupressores", "Farmacologia do SNA", "Interações Medicamentosas", "Anti-diabéticos Orais e Insulinoterapia", "Broncodilatadores e Anti-asmáticos"],
  "Oncologia": ["Câncer de Mama", "Câncer de Pulmão", "Câncer Colorretal", "Câncer de Próstata", "Câncer Gástrico", "Câncer de Colo Uterino", "Câncer de Pâncreas", "Melanoma", "Câncer de Tireoide", "Estadiamento TNM", "Síndromes Paraneoplásicas", "Marcadores Tumorais", "Quimioterapia e Toxicidade", "Imunoterapia e Terapia-Alvo", "Radioterapia", "Cuidados Paliativos", "Emergências Oncológicas", "Rastreamento Oncológico", "Tumores do SNC", "Câncer de Bexiga e Rim"],
  "Angiologia": ["Doença Arterial Periférica", "Aneurisma de Aorta", "Trombose Venosa Profunda", "Insuficiência Venosa Crônica", "Varizes", "Isquemia Crítica de Membro", "Pé Diabético Vascular", "Linfedema", "Claudicação Intermitente", "Endarterectomia de Carótida", "Dissecção de Aorta", "Síndrome Compartimental"],
  "Fisiologia": ["Fisiologia Cardiovascular", "Fisiologia Respiratória", "Fisiologia Renal", "Fisiologia Endócrina", "Fisiologia do Sistema Nervoso", "Fisiologia Gastrointestinal", "Fisiologia Muscular", "Equilíbrio Ácido-Base", "Fisiologia da Hemostasia", "Fisiologia da Reprodução"],
  "Bioquímica": ["Metabolismo de Carboidratos", "Metabolismo de Lipídios", "Metabolismo de Proteínas", "Bioquímica do Ciclo de Krebs", "Fosforilação Oxidativa", "Vitaminas e Coenzimas", "Bioquímica Hormonal", "Erros Inatos do Metabolismo", "Bioquímica do Fígado", "Bioquímica Renal"],
  "Histologia": ["Tecido Epitelial", "Tecido Conjuntivo", "Tecido Muscular", "Tecido Nervoso", "Histologia do Sistema Cardiovascular", "Histologia do Sistema Respiratório", "Histologia do TGI", "Histologia Renal", "Histologia do Sistema Endócrino", "Histologia da Pele"],
  "Embriologia": ["Embriologia do Coração", "Embriologia do Sistema Nervoso", "Embriologia do TGI", "Embriologia do Sistema Urogenital", "Embriologia do Sistema Respiratório", "Anomalias Congênitas", "Embriologia da Face e Pescoço", "Placenta e Membranas", "Teratogênese"],
  "Microbiologia": ["Bacteriologia Geral", "Virologia", "Micologia Médica", "Parasitologia Médica", "Mecanismos de Resistência Bacteriana", "Microbiota Humana", "Diagnóstico Microbiológico", "Esterilização e Desinfecção", "Infecções Hospitalares", "Bactérias Gram-positivas e Gram-negativas"],
  "Imunologia": ["Imunidade Inata", "Imunidade Adaptativa", "Hipersensibilidades", "Autoimunidade", "Imunodeficiências", "Imunologia dos Transplantes", "Vacinologia", "Citocinas e Quimiocinas", "Sistema Complemento", "Imunologia Tumoral"],
  "Parasitologia": ["Malária", "Doença de Chagas", "Leishmaniose Visceral", "Leishmaniose Tegumentar", "Esquistossomose", "Ascaridíase", "Ancilostomíase", "Teníase e Cisticercose", "Toxoplasmose", "Giardíase e Amebíase"],
  "Genética Médica": ["Herança Mendeliana", "Herança Ligada ao X", "Doenças Cromossômicas", "Síndrome de Down", "Genética do Câncer", "Aconselhamento Genético", "Erros Inatos do Metabolismo", "Farmacogenômica", "Epigenética", "Diagnóstico Pré-natal"],
  "Patologia": ["Inflamação Aguda e Crônica", "Neoplasias", "Distúrbios Hemodinâmicos", "Lesão e Morte Celular", "Adaptações Celulares", "Reparo Tecidual", "Patologia Vascular", "Imunopatologia", "Patologia do Sistema Nervoso", "Patologia Hepática"],
  "Terapia Intensiva": ["Ventilação Mecânica", "Sepse e Choque Séptico", "Monitorização Hemodinâmica", "Distúrbios Hidroeletrolíticos em UTI", "Sedação e Analgesia", "Nutrição em Terapia Intensiva", "SDRA", "Insuficiência Renal Aguda em UTI", "Neurointensivismo", "Cuidados Pós-PCR"],
};

function getTarget(specialty: string): number {
  return BASIC_SCIENCES.includes(specialty) ? TARGET_BASIC : TARGET_CLINICAL;
}

function normalizeTopicToParent(generatedTopic: string, parentSpecialty: string): string {
  const normalized = String(generatedTopic || "").trim();
  if (SPECIALTIES.includes(normalized)) return normalized;
  if (normalized.toLowerCase().startsWith(parentSpecialty.toLowerCase())) return parentSpecialty;
  const subtopics = TOPICS_BY_SPECIALTY[parentSpecialty];
  if (subtopics && subtopics.some(s => normalized.toLowerCase().includes(s.toLowerCase()))) return parentSpecialty;
  return parentSpecialty;
}

function normalizeStatementKey(statement: string): string {
  return String(statement || "").toLowerCase().trim().slice(0, 80);
}

function extractBalancedSegment(input: string, startChar: "{" | "[", endChar: "}" | "]", startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < input.length; i++) {
    const char = input[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === startChar) depth++;
    if (char === endChar) { depth--; if (depth === 0) return input.slice(startIndex, i + 1); }
  }
  return null;
}

function repairJsonCandidate(input: string): string {
  return input.replace(/,\s*([}\]])/g, "$1").replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3').replace(/\r?\n/g, " ").replace(/\t/g, " ").trim();
}

function normalizeGeneratedPayload(parsed: unknown): { questions: any[]; flashcards: any[] } | null {
  if (Array.isArray(parsed)) return { questions: parsed, flashcards: [] };
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const questions = Array.isArray(record.questions) ? (record.questions as any[]) : [];
  const flashcards = Array.isArray(record.flashcards) ? (record.flashcards as any[]) : [];
  if (!questions.length && !flashcards.length) return null;
  return { questions, flashcards };
}

function extractArrayForKey(input: string, key: string): string | null {
  const match = new RegExp(`"?${key}"?\\s*:`, "i").exec(input);
  if (!match) return null;
  const arrayStart = input.indexOf("[", match.index + match[0].length);
  if (arrayStart === -1) return null;
  return extractBalancedSegment(input, "[", "]", arrayStart);
}

function parseGeneratedPayload(rawContent: string): { questions: any[]; flashcards: any[] } | null {
  let raw = sanitizeAiContent(rawContent).replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, "").trim();
  if (raw === sanitizeAiContent(rawContent).trim()) {
    raw = sanitizeAiContent(rawContent).replace(/```json\s*|```/gi, "").trim();
  }
  if (!raw) return null;

  const candidates: string[] = [];
  const pushCandidate = (candidate?: string | null) => { if (candidate && !candidates.includes(candidate)) candidates.push(candidate); };
  pushCandidate(raw);
  pushCandidate(repairJsonCandidate(raw));

  const firstObjectIndex = raw.indexOf("{");
  if (firstObjectIndex !== -1) {
    const objectSlice = extractBalancedSegment(raw, "{", "}", firstObjectIndex);
    pushCandidate(objectSlice);
    pushCandidate(objectSlice ? repairJsonCandidate(objectSlice) : null);
  }

  const questionsArray = extractArrayForKey(raw, "questions") || extractArrayForKey(repairJsonCandidate(raw), "questions");
  const flashcardsArray = extractArrayForKey(raw, "flashcards") || extractArrayForKey(repairJsonCandidate(raw), "flashcards");
  if (questionsArray || flashcardsArray) {
    const rebuiltPayload = `{"questions":${questionsArray ?? "[]"},"flashcards":${flashcardsArray ?? "[]"}}`;
    pushCandidate(rebuiltPayload);
    pushCandidate(repairJsonCandidate(rebuiltPayload));
  }

  for (const candidate of candidates) {
    try {
      const normalized = normalizeGeneratedPayload(JSON.parse(candidate));
      if (normalized) return normalized;
    } catch { continue; }
  }
  return null;
}

async function getExactGlobalCount(supabaseAdmin: any, specialty: string): Promise<number> {
  const { count } = await supabaseAdmin.from("questions_bank").select("id", { count: "exact", head: true }).eq("is_global", true).eq("topic", specialty);
  return count || 0;
}

async function buildDeficits(supabaseAdmin: any, specialties: string[]) {
  const counts = await Promise.all(specialties.map(async (specialty) => ({
    specialty, current: await getExactGlobalCount(supabaseAdmin, specialty), target: getTarget(specialty),
  })));
  return counts.map((item) => ({ ...item, deficit: Math.max(0, item.target - item.current) })).filter((item) => item.deficit > 0).sort((a, b) => b.deficit - a.deficit);
}

async function generateBatch(specialty: string, topics: string[], userId: string, supabaseAdmin: any, questionCount = 10): Promise<{ questions: number; flashcards: number }> {
  const selectedTopics = topics.sort(() => Math.random() - 0.5).slice(0, 4); // Reduzido de 5 para 4 temas para focar mais
  const fcCount = Math.max(1, Math.min(3, Math.round(questionCount * 0.4))); // Reduzido count de flashcards

  const prompt = `Gere ${questionCount} questões MCQ e ${fcCount} flashcards.
ESPECIALIDADE: ${specialty}
TEMAS: ${selectedTopics.join(", ")}

REGRAS:
- Nível residência médica (ENARE/USP)
- Casos clínicos realistas (anamnese+EF+exames)
- 5 alternativas (A-E), 1 correta
- Explicação detalhada
- difficulty: 2-5
- JSON OBRIGATÓRIO: {"questions":[{"statement":"...","options":["A) ...","B) ...","C) ...","D) ...","E) ..."],"correct_index":0,"explanation":"...","topic":"${specialty}","difficulty":3}],"flashcards":[{"question":"...","answer":"...","topic":"${specialty}"}]}`;

  try {
    const response = await aiFetch({
      model: ALLOWED_MODELS.generation,
      timeoutMs: 55000,
      maxRetries: 0,
      messages: [
        { role: "system", content: "Professor de medicina. Responda APENAS JSON puro em PT-BR. Sem markdown." },
        { role: "user", content: prompt },
      ],
    });

    if (!response.ok) { console.error(`AI error for ${specialty}:`, await response.text()); return { questions: 0, flashcards: 0 }; }

    const data = await response.json();
    const rawContent = String(data.choices?.[0]?.message?.content || "");
    let parsed = parseGeneratedPayload(rawContent);

    if (!parsed) {
      console.error(`JSON parse failed for ${specialty}, length: ${rawContent.length}`);
      try {
        console.log(`[${specialty}] Retrying with simplified prompt...`);
        const retryResponse = await aiFetch({
          model: ALLOWED_MODELS.generation,
          timeoutMs: 55000,
          maxRetries: 0,
          messages: [
            { role: "system", content: "Responda APENAS com JSON válido. Sem markdown, sem texto extra." },
            { role: "user", content: `Gere ${questionCount} questões sobre ${specialty} para residência médica em PT-BR.\n\nFormato:\n{"questions":[{"statement":"...","options":["A) ...","B) ...","C) ...","D) ...","E) ..."],"correct_index":0,"explanation":"...","topic":"${specialty}","difficulty":4}],"flashcards":[]}` },
          ],
        });
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          parsed = parseGeneratedPayload(String(retryData.choices?.[0]?.message?.content || ""));
        }
      } catch (retryErr) { console.error(`[${specialty}] Retry failed:`, retryErr); }
    }

    if (!parsed) { console.error(`[${specialty}] All parse strategies failed`); return { questions: 0, flashcards: 0 }; }

    const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo)\b/i;
    const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice)\b/i;
    const questions = (parsed.questions || []).filter((q: any) =>
      q.statement && Array.isArray(q.options) && q.options.length >= 4 && q.options.length <= 5 && typeof q.correct_index === "number" &&
      String(q.statement).trim().length >= 400 &&
      !INVALID_CONTENT_REGEX.test(q.statement) && !INVALID_CONTENT_REGEX.test(q.explanation || "") &&
      !ENGLISH_PATTERN.test(q.statement) && !IMAGE_REF_PATTERN.test(q.statement)
    );

    let qCount = 0;
    if (questions.length > 0) {
      const { data: existing } = await supabaseAdmin.from("questions_bank").select("statement").eq("is_global", true).eq("topic", specialty);
      const existingHashes = new Set((existing || []).map((e: any) => normalizeStatementKey(e.statement)));

      const rows = questions.map((q: any) => {
        const rawTopic = String(q.topic || specialty).trim();
        const normalizedTopic = normalizeTopicToParent(rawTopic, specialty);
        
        // Ensure options count is 4 or 5
        const opts = Array.isArray(q.options) ? q.options.map(String) : [];
        while (opts.length < 4) opts.push(`Alternativa ${String.fromCharCode(65 + opts.length)}`);
        if (opts.length > 5) opts.splice(5);

        return {
          user_id: userId, 
          statement: String(q.statement).trim(), 
          options: opts,
          correct_index: Math.max(0, Math.min(Number(q.correct_index) || 0, opts.length - 1)), 
          explanation: String(q.explanation || "").trim(),
          topic: normalizedTopic, 
          subtopic: rawTopic !== normalizedTopic ? rawTopic : null,
          difficulty: q.difficulty || (Math.random() < 0.5 ? 4 : 3),
          board: "AI-Generated",
          source: "bulk-ai-generated", 
          is_global: true, 
          review_status: "pending",
        };
      }).filter((r: any) => {
        const hash = normalizeStatementKey(r.statement);
        if (existingHashes.has(hash)) return false;
        existingHashes.add(hash);
        return true;
      });

      if (rows.length > 0) {
        const { error } = await supabaseAdmin.from("questions_bank").insert(rows);
        if (!error) qCount = rows.length;
        else console.error("Q insert error:", error);
      }
      console.log(`[${specialty}] ${questions.length} generated, ${questions.length - rows.length} deduped, ${qCount} inserted`);
    }

    const flashcards = (parsed.flashcards || []).filter((f: any) => f.question && f.answer && !INVALID_CONTENT_REGEX.test(f.question) && !INVALID_CONTENT_REGEX.test(f.answer));
    let fCount = 0;
    if (flashcards.length > 0) {
      const fRows = flashcards.map((f: any) => ({
        user_id: userId, question: String(f.question).trim(), answer: String(f.answer).trim(),
        topic: String(f.topic || specialty).trim(), is_global: true,
      }));
      const { error } = await supabaseAdmin.from("flashcards").insert(fRows);
      if (!error) fCount = fRows.length;
      else console.error("F insert error:", error);
    }

    return { questions: qCount, flashcards: fCount };
  } catch (e) {
    console.error(`Error generating for ${specialty}:`, e);
    return { questions: 0, flashcards: 0 };
  }
}

async function importRealExamQuestions(specialty: string, supabaseAdmin: any, userId: string, limit: number): Promise<number> {
  const { data: realQs } = await supabaseAdmin.from("real_exam_questions").select("*").eq("topic", specialty).eq("is_active", true).limit(limit);
  if (!realQs || realQs.length === 0) return 0;

  const { data: existing } = await supabaseAdmin.from("questions_bank").select("statement").eq("topic", specialty).eq("is_global", true);
  const existingSet = new Set((existing || []).map((e: any) => normalizeStatementKey(e.statement)));
  const toInsert: any[] = [];

  for (const question of realQs) {
    const key = normalizeStatementKey(question.statement);
    if (!key || existingSet.has(key)) continue;
    existingSet.add(key);
    toInsert.push(question);
    if (toInsert.length >= limit) break;
  }

  if (toInsert.length === 0) return 0;
  const rows = toInsert.map((q: any) => ({
    user_id: userId, statement: q.statement, options: q.options, correct_index: q.correct_index,
    explanation: q.explanation || "", topic: specialty, subtopic: q.subtopic || null,
    difficulty: q.difficulty || 4, source: "real_exam_import", source_url: q.source_url,
    board: q.banca || q.board || "Importação",
    is_global: true, review_status: "pending",
  }));

  const { error } = await supabaseAdmin.from("questions_bank").insert(rows);
  if (error) { console.error("Real exam import error:", error); return 0; }
  return rows.length;
}

// ── Background processing functions ──
async function processEqualize(jobId: string, body: any, userId: string, supabaseAdmin: any) {
  try {
    const requestedSpecialties = typeof body.specialty === "string" && body.specialty.trim()
      ? [String(body.specialty).trim()] : SPECIALTIES;
    const requestedBatchSize = Math.max(1, Math.min(Number(body.batchSize) || 25, 30));
    const requestedMaxSpecialties = Math.max(1, Math.min(Number(body.maxSpecialties) || 5, 5));
    const requestedImportLimit = Math.max(1, Math.min(Number(body.importLimit) || 50, 100));

    const deficits = await buildDeficits(supabaseAdmin, requestedSpecialties);
    const toProcess = deficits.slice(0, body.specialty ? 1 : requestedMaxSpecialties);

    if (toProcess.length === 0) {
      await supabaseAdmin.from("bulk_generation_jobs").update({
        status: "completed", result: { message: "Todas as especialidades já atingiram o alvo!", results: [] }, updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    let totalQ = 0, totalF = 0, totalImported = 0;
    const results: any[] = [];

    for (const [index, item] of toProcess.entries()) {
      try {
        // Update progress
        await supabaseAdmin.from("bulk_generation_jobs").update({
          progress: { current: index + 1, total: toProcess.length, specialty: item.specialty },
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);

        const imported = await importRealExamQuestions(item.specialty, supabaseAdmin, userId, Math.min(item.deficit, requestedImportLimit));
        totalImported += imported;

        const remainingDeficit = Math.max(0, item.deficit - imported);
        let genQ = 0, genF = 0;

        if (remainingDeficit > 0) {
          const topics = TOPICS_BY_SPECIALTY[item.specialty] || [item.specialty];
          const batchSize = Math.min(requestedBatchSize, remainingDeficit);
          const result = await generateBatch(item.specialty, topics, userId, supabaseAdmin, batchSize);
          genQ = result.questions;
          genF = result.flashcards;
          totalQ += genQ;
          totalF += genF;
        }

        const remainingAfter = Math.max(0, item.deficit - imported - genQ);
        results.push({
          specialty: item.specialty, previous: item.current, target: item.target, deficit: item.deficit,
          imported, generated: genQ, flashcards: genF, remaining_after: remainingAfter,
          completed: remainingAfter === 0,
        });

        console.log(`[equalize] ${index + 1}/${toProcess.length} ${item.specialty}: imported=${imported}, generated=${genQ}, remaining=${remainingAfter}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro inesperado";
        results.push({
          specialty: item.specialty, previous: item.current, target: item.target, deficit: item.deficit,
          imported: 0, generated: 0, flashcards: 0, remaining_after: item.deficit, completed: false, error: message,
        });
        console.error(`[equalize] ${item.specialty} failed:`, error);
      }
    }

    // Log to daily_generation_log
    try {
      await supabaseAdmin.from("daily_generation_log").insert({
        run_date: new Date().toISOString().split("T")[0],
        questions_generated: totalImported + totalQ,
        specialties_processed: results.map((r: any) => r.specialty),
        status: results.some((r: any) => r.error) ? "partial" : "success",
      });
    } catch (logErr) { console.error("[equalize] Failed to write generation log:", logErr); }

    const processedNames = new Set(results.map((r) => r.specialty));
    const remainingDeficits = [
      ...results.filter((r) => r.remaining_after > 0).map((r) => ({ specialty: r.specialty, deficit: r.remaining_after })),
      ...deficits.filter((item) => !processedNames.has(item.specialty)).map((item) => ({ specialty: item.specialty, deficit: item.deficit })),
    ];

    await supabaseAdmin.from("bulk_generation_jobs").update({
      status: "completed",
      result: {
        message: `Equalização: ${totalImported} importadas, ${totalQ} geradas por IA, ${totalF} flashcards`,
        results, remaining_deficits: remainingDeficits,
        total_imported: totalImported, total_generated: totalQ, total_flashcards: totalF,
        total_specialties_in_run: toProcess.length, specialties_remaining: remainingDeficits.length,
        questions_remaining: remainingDeficits.reduce((sum, item) => sum + item.deficit, 0),
      },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (err) {
    console.error("[equalize] Fatal error:", err);
    await supabaseAdmin.from("bulk_generation_jobs").update({
      status: "failed", error: err instanceof Error ? err.message : String(err), updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

async function processNormalMode(jobId: string, body: any, userId: string, supabaseAdmin: any) {
  try {
    const batchCount = body.batches || 3;
    const targetQuestions = body.target || 5000;

    const { count: currentCount } = await supabaseAdmin.from("questions_bank").select("*", { count: "exact", head: true }).eq("is_global", true);
    const remaining = targetQuestions - (currentCount || 0);

    if (remaining <= 0) {
      await supabaseAdmin.from("bulk_generation_jobs").update({
        status: "completed", result: { message: `Já atingimos ${currentCount} questões globais!`, current_questions: currentCount, target: targetQuestions },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    const { data: topicCounts } = await supabaseAdmin.from("questions_bank").select("topic").eq("is_global", true);
    const countByTopic: Record<string, number> = {};
    (topicCounts || []).forEach((r: any) => { const t = r.topic || "Geral"; countByTopic[t] = (countByTopic[t] || 0) + 1; });

    const sorted = [...SPECIALTIES].sort((a, b) => (countByTopic[a] || 0) - (countByTopic[b] || 0));
    const selected = sorted.slice(0, batchCount);

    let totalQ = 0, totalF = 0;
    for (const [index, spec] of selected.entries()) {
      await supabaseAdmin.from("bulk_generation_jobs").update({
        progress: { current: index + 1, total: selected.length, specialty: spec }, updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      const topics = TOPICS_BY_SPECIALTY[spec] || [spec];
      const result = await generateBatch(spec, topics, userId, supabaseAdmin);
      totalQ += result.questions;
      totalF += result.flashcards;
      console.log(`${spec}: ${result.questions}Q, ${result.flashcards}F`);
    }

    const { count: newCount } = await supabaseAdmin.from("questions_bank").select("*", { count: "exact", head: true }).eq("is_global", true);
    const { count: flashcardCount } = await supabaseAdmin.from("flashcards").select("*", { count: "exact", head: true }).eq("is_global", true);

    const finalStatus = (totalQ + totalF > 0) ? "completed" : "failed";
    const finalError = (totalQ + totalF > 0) ? null : "Nenhuma questão ou flashcard foi gerado. O pipeline pode estar instável.";

    await supabaseAdmin.from("bulk_generation_jobs").update({
      status: finalStatus,
      error: finalError,
      result: {
        message: `Geradas ${totalQ} questões e ${totalF} flashcards`,
        questions_added: totalQ, flashcards_added: totalF, total_questions: newCount,
        total_flashcards: flashcardCount, specialties_processed: selected, target: targetQuestions,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (err) {
    console.error("[normal] Fatal error:", err);
    await supabaseAdmin.from("bulk_generation_jobs").update({
      status: "failed", error: err instanceof Error ? err.message : String(err), updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

// ── Check job status endpoint ──
function isStatusCheck(url: URL): string | null {
  const jobId = url.searchParams.get("job_id");
  return jobId;
}

// ── Main handler ──
Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    let userId: string;

    if (token === serviceRoleKey) {
      const { data: adminRole } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
      userId = adminRole?.user_id || "92736dea-6422-48ff-8330-de9f0d1094e9";
    } else {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Token inválido ou expirado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const uid = user.id;
      const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = uid;
    }

    // ── Status check ──
    const checkJobId = isStatusCheck(url);
    if (checkJobId && req.method === "GET") {
      const { data: job } = await supabaseAdmin.from("bulk_generation_jobs").select("*").eq("id", checkJobId).single();
      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(job), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Create job and process in background ──
    const body = await req.json().catch(() => ({}));
    const mode = body.equalize ? "equalize" : "normal";

    // Legacy job creation (maintaining UI compatibility)
    const { data: job, error: jobErr } = await supabaseAdmin.from("bulk_generation_jobs").insert({
      status: "processing", mode, specialty: body.specialty || null, user_id: userId, progress: { current: 0, total: 0 },
    }).select().single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Falha ao criar job" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // New Autonomous Recovery Engine job creation
    const pipelineJob = await createPipelineJob({
      type: 'bulk_generation',
      payload: body,
      user_id: userId,
      max_retries: 5
    });

    // Start background processing
    const waitUntil = typeof (context as any)?.waitUntil === 'function' 
      ? (context as any).waitUntil.bind(context) 
      : (promise: Promise<any>) => promise.catch(err => console.error("Background error (no waitUntil):", err));

    waitUntil(
      (async () => {
        try {
          if (mode === "equalize") {
            await processEqualize(job.id, body, userId, supabaseAdmin);
          } else {
            await processNormalMode(job.id, body, userId, supabaseAdmin);
          }
          await completePipelineJob(pipelineJob.id, { bulk_job_id: job.id });
        } catch (error) {
          console.error("[bulk-generate] Background error:", error);
          await supabaseAdmin.from("bulk_generation_jobs").update({
            status: "failed", error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString(),
          }).eq("id", job.id);
          
          const { canRetry } = await failPipelineJob(pipelineJob.id, error, "generation_phase");
          if (canRetry) {
             console.log(`[Pipeline] Job ${pipelineJob.id} flagged for automatic retry.`);
             // Here we could trigger a re-invocation or use a queue
          }
        }
      })()
    );

    // Return immediately with job ID
    return new Response(JSON.stringify({
      job_id: job.id, status: "processing", mode,
      message: "Geração iniciada em background. Use o job_id para acompanhar o progresso.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[bulk-generate-content] RUNTIME_ERROR", {
      message: e?.message,
      stack: e?.stack,
      name: e?.name
    });

    return new Response(JSON.stringify({ 
      error: "bulk_generate_content_failed",
      message: e?.message ?? "Unknown error" 
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
