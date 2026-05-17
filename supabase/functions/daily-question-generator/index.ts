import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INVALID_CONTENT_REGEX = /(declara[cç][aã]o financeira|declara[cç][oõ]es de interesse|pagamento de qualquer esp[eé]cie|empresa farmac[eê]utica|ind[uú]stria farmac[eê]utica|honor[aá]rio|palestrante remunerado|conflito de interesse|relat[oó]rio de interesse)/i;

const SPECIALTIES = [
  "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
  "Gastroenterologia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cirurgia Geral", "Medicina Preventiva", "Nefrologia",
  "Infectologia", "Hematologia", "Reumatologia", "Dermatologia",
  "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia",
  "Otorrinolaringologia", "Emergência", "Semiologia", "Anatomia", "Farmacologia",
  "Oncologia", "Fisiologia", "Bioquímica", "Angiologia",
  "Histologia", "Embriologia", "Microbiologia", "Imunologia",
  "Parasitologia", "Genética Médica", "Patologia",
];

const TOPICS_BY_SPECIALTY: Record<string, string[]> = {
  "Cardiologia": ["Insuficiência Cardíaca", "IAM", "Arritmias", "Valvopatias", "Hipertensão Arterial", "Endocardite", "Pericardite", "Cardiopatias Congênitas", "Doença Coronariana", "Choque Cardiogênico", "Fibrilação Atrial", "Síndrome Coronariana Aguda", "Dissecção de Aorta", "Tromboembolismo Pulmonar", "Miocardiopatias", "Síndromes Coronarianas Agudas"],
  "Pneumologia": ["Pneumonia", "DPOC", "Asma", "TEP", "Tuberculose", "Derrame Pleural", "Pneumotórax", "Fibrose Pulmonar", "SDRA", "Câncer de Pulmão", "Bronquiectasia", "Sarcoidose", "Apneia do Sono", "Insuficiência Respiratória", "Pneumonia Nosocomial", "Micoses Pulmonares"],
  "Neurologia": ["AVC Isquêmico", "AVC Hemorrágico", "Epilepsia", "Meningite", "Esclerose Múltipla", "Parkinson", "Alzheimer", "Cefaleia", "Neuropatias", "Tumores Cerebrais", "Miastenia Gravis", "Guillain-Barré", "Hipertensão Intracraniana", "Trauma Cranioencefálico", "Neuropatia Diabética"],
  "Endocrinologia": ["Diabetes Mellitus Tipo 1", "Diabetes Mellitus Tipo 2", "Hipotireoidismo", "Hipertireoidismo", "Síndrome de Cushing", "Insuficiência Adrenal", "Feocromocitoma", "Hiperparatireoidismo", "Osteoporose", "Cetoacidose Diabética", "Estado Hiperosmolar", "Tireoidite de Hashimoto", "Doença de Graves", "Nódulos Tireoidianos", "Síndrome Hiperosmolar", "Dislipidemias"],
  "Gastroenterologia": ["Doença do Refluxo", "Úlcera Péptica", "Doença de Crohn", "Retocolite Ulcerativa", "Cirrose Hepática", "Hepatites Virais", "Pancreatite Aguda", "Pancreatite Crônica", "Colelitíase", "Colecistite", "Hemorragia Digestiva", "Doença Celíaca", "Síndrome do Intestino Irritável", "Câncer Colorretal", "Doença Diverticular", "Distúrbios Motores do Esôfago"],
  "Pediatria": ["Bronquiolite", "Desidratação", "IVAS", "Otite Média", "Imunização", "Crescimento e Desenvolvimento", "Alergia Alimentar", "Febre Reumática", "Meningite Neonatal", "Icterícia Neonatal", "Distúrbios do Crescimento", "Asma Infantil", "Pneumonia Infantil", "Convulsão Febril", "Reanimação Neonatal", "Infecções Congênitas (TORCH)", "Desidratação na Criança", "Febre sem Foco"],
  "Ginecologia e Obstetrícia": ["Pré-eclâmpsia", "Eclâmpsia", "Diabetes Gestacional", "Placenta Prévia", "DPP", "Gravidez Ectópica", "Endometriose", "SOP", "Mioma Uterino", "Câncer de Colo do Útero", "Câncer de Mama", "Infecções Vaginais", "Parto Normal vs Cesárea", "Hemorragia Pós-Parto", "Distócias", "Puerpério", "Anticoncepção", "ISTs na Ginecologia", "Trabalho de Parto Prematuro"],
  "Cirurgia Geral": ["Apendicite", "Colecistite Aguda", "Obstrução Intestinal", "Hérnia Inguinal", "Abdome Agudo", "Trauma Abdominal", "Pancreatite Cirúrgica", "Diverticulite", "Câncer Gástrico", "Politraumatismo", "Queimaduras", "Choque Hipovolêmico", "Feridas Cirúrgicas", "Complicações Pós-Operatórias", "Abdome Agudo Obstrutivo", "Doença Hemorroidária", "Isquemia Mesentérica"],
  "Medicina Preventiva": ["Epidemiologia", "Vigilância em Saúde", "SUS", "Atenção Primária", "Rastreamento", "Saúde da Família", "Indicadores de Saúde", "Bioestatística", "Estudos Epidemiológicos", "Vacinação do Adulto", "Promoção da Saúde", "Saneamento Básico", "Doenças de Notificação Compulsória", "Ética e Bioética Médica", "Determinantes Sociais de Saúde", "Níveis de Prevenção"],
  "Nefrologia": ["Insuficiência Renal Aguda", "Doença Renal Crônica", "Glomerulonefrites", "Síndrome Nefrótica", "Síndrome Nefrítica", "Distúrbios Hidroeletrolíticos", "Acidose e Alcalose", "Litíase Renal", "Infecção Urinária", "Transplante Renal", "Diálise", "Nefropatia Diabética"],
  "Infectologia": ["HIV/AIDS", "Dengue", "Malária", "Leishmaniose", "Tuberculose", "Hanseníase", "Hepatites Virais", "COVID-19", "Sepse", "Infecções Hospitalares", "Antibioticoterapia", "Febre Amarela", "Parasitoses Intestinais", "Arboviroses", "Resistência Antimicrobiana"],
  "Hematologia": ["Anemias", "Leucemias", "Linfomas", "Mieloma Múltiplo", "Coagulopatias", "Trombocitopenia", "Hemofilia", "CIVD", "Policitemia Vera", "Púrpura Trombocitopênica", "Anemia Falciforme", "Talassemias", "Hemotransfusão", "Distúrbios da Hemostasia"],
  "Reumatologia": ["Artrite Reumatoide", "Lúpus Eritematoso", "Espondilite Anquilosante", "Gota", "Esclerodermia", "Síndrome de Sjögren", "Vasculites", "Fibromialgia", "Artrite Psoriásica", "Polimiosite", "Febre Reumática"],
  "Dermatologia": ["Psoríase", "Dermatite Atópica", "Urticária", "Melanoma", "Carcinoma Basocelular", "Hanseníase", "Micoses Superficiais", "Herpes Zoster", "Acne", "Pênfigo", "Lúpus Cutâneo", "Lesões Elementares da Pele", "Piodermites", "Dermatoviroses", "Dermatozoonoses"],
  "Ortopedia": ["Fraturas", "Luxações", "Osteomielite", "Artrose", "Lombalgia", "Hérnia de Disco", "Síndrome do Túnel do Carpo", "Lesões de Menisco", "Tendinites", "Osteoporose Ortopédica"],
  "Urologia": ["Hiperplasia Prostática", "Câncer de Próstata", "Litíase Urinária", "Infecção Urinária", "Câncer de Bexiga", "Torção Testicular", "Varicocele", "Fimose", "Incontinência Urinária"],
  "Psiquiatria": ["Depressão", "Transtorno Bipolar", "Esquizofrenia", "Transtorno de Ansiedade", "TOC", "TEPT", "Transtornos Alimentares", "Dependência Química", "Demência", "Psicofarmacologia", "Emergências Psiquiátricas"],
  "Emergência": ["PCR e RCP", "Choque", "Intoxicações", "Anafilaxia", "Politrauma", "ATLS", "Queimaduras", "Afogamento", "Cetoacidose Diabética", "Crise Hipertensiva", "Choque Hipovolêmico"],
  "Oftalmologia": ["Glaucoma", "Catarata", "Descolamento de Retina", "Retinopatia Diabética", "Conjuntivite", "Uveíte", "Trauma Ocular"],
  "Otorrinolaringologia": ["Otite", "Sinusite", "Amigdalite", "Perda Auditiva", "Vertigem", "Epistaxe", "Câncer de Laringe"],
  "Semiologia": ["Anamnese", "Exame Físico Geral", "Semiologia Cardiovascular", "Semiologia Pulmonar", "Semiologia Abdominal", "Semiologia Neurológica", "Sinais Vitais"],
  "Anatomia": ["Anatomia do Tórax", "Anatomia Abdominal", "Anatomia do Pescoço", "Neuroanatomia", "Anatomia do Membro Superior", "Anatomia do Membro Inferior", "Anatomia Pélvica"],
  "Farmacologia": ["Farmacocinética (ADME)", "Farmacodinâmica e Receptores", "Antibioticoterapia", "Anti-hipertensivos", "Antiarrítmicos", "Anticoagulantes", "AINEs e Corticoides", "Psicofarmacologia"],
  "Oncologia": ["Câncer de Mama", "Câncer de Pulmão", "Câncer Colorretal", "Estadiamento TNM", "Síndromes Paraneoplásicas", "Marcadores Tumorais", "Quimioterapia", "Imunoterapia", "Cuidados Paliativos", "Emergências Oncológicas", "Câncer de Endométrio", "Câncer de Ovário"],
  "Fisiologia": ["Fisiologia Cardiovascular", "Fisiologia Respiratória", "Fisiologia Renal", "Fisiologia do Sistema Nervoso", "Fisiologia Endócrina", "Fisiologia Gastrointestinal", "Fisiologia Muscular", "Neurofisiologia", "Potencial de Ação e Transmissão Sináptica", "Equilíbrio Ácido-Base", "Regulação da Pressão Arterial", "Hemodinâmica", "Termorregulação", "Fisiologia do Exercício"],
  "Bioquímica": ["Metabolismo de Carboidratos", "Metabolismo de Lipídios", "Metabolismo de Aminoácidos", "Ciclo de Krebs", "Cadeia Transportadora de Elétrons", "Glicólise e Gliconeogênese", "Beta-Oxidação", "Síntese de Ácidos Graxos", "Biologia Molecular do DNA e RNA", "Enzimologia Clínica", "Vitaminas e Coenzimas", "Bioenergética", "Erros Inatos do Metabolismo", "Integração Metabólica"],
  "Angiologia": ["Doença Arterial Periférica", "Aneurisma de Aorta", "Trombose Venosa Profunda", "Insuficiência Venosa Crônica", "Varizes", "Isquemia Crítica de Membro", "Pé Diabético Vascular", "Linfedema", "Claudicação Intermitente", "Endarterectomia de Carótida", "Dissecção de Aorta", "Síndrome Compartimental", "Linfangite e Erisipela"],
  "Histologia": ["Tecido Epitelial", "Tecido Conjuntivo", "Tecido Muscular", "Tecido Nervoso", "Sangue e Hematopoese", "Sistema Tegumentar", "Histologia do Trato Gastrointestinal", "Histologia do Sistema Respiratório", "Histologia Renal", "Histologia do Sistema Reprodutor"],
  "Embriologia": ["Gametogênese", "Fecundação e Implantação", "Gastrulação", "Neurulação", "Organogênese", "Desenvolvimento Cardiovascular", "Desenvolvimento do Sistema Nervoso", "Placenta e Membranas Fetais", "Teratogênese", "Malformações Congênitas"],
  "Microbiologia": ["Bacteriologia Geral", "Cocos Gram-Positivos", "Bacilos Gram-Negativos", "Micobactérias", "Virologia Geral", "Vírus Respiratórios", "Retrovírus e HIV", "Micologia Médica", "Resistência Antimicrobiana", "Microbiota e Infecções Hospitalares"],
  "Imunologia": ["Imunidade Inata", "Imunidade Adaptativa", "Linfócitos T e B", "Imunoglobulinas", "Sistema Complemento", "Hipersensibilidades", "Autoimunidade", "Imunodeficiências", "Imunologia dos Transplantes", "Vacinas e Imunoterapia"],
  "Parasitologia": ["Protozoários Intestinais", "Protozoários Sanguíneos e Teciduais", "Helmintos Intestinais", "Esquistossomose", "Doença de Chagas", "Leishmanioses", "Malária", "Artrópodes Vetores", "Diagnóstico Parasitológico", "Epidemiologia das Parasitoses"],
  "Genética Médica": ["Herança Mendeliana", "Herança Ligada ao X", "Aberrações Cromossômicas", "Síndromes Genéticas", "Genética Molecular", "Aconselhamento Genético", "Erros Inatos do Metabolismo", "Citogenética", "Epigenética", "Genética do Câncer"],
  "Patologia": ["Lesão e Morte Celular", "Inflamação Aguda e Crônica", "Reparo Tecidual", "Distúrbios Hemodinâmicos", "Neoplasias Benignas e Malignas", "Patologia Ambiental", "Imunopatologia", "Patologia Cardiovascular", "Patologia Pulmonar", "Patologia do Trato GI"],
};

// High-yield subtopics — prioritized in generation prompts
const HIGH_YIELD: Record<string, string[]> = {
  "Cardiologia": ["Insuficiência Cardíaca", "Síndromes Coronarianas Agudas", "Hipertensão Arterial", "Arritmias", "Endocardite"],
  "Cirurgia Geral": ["Abdome Agudo", "Politraumatismo", "Hérnia Inguinal", "Colecistite Aguda", "Apendicite"],
  "Pediatria": ["Bronquiolite", "Icterícia Neonatal", "Imunização", "Reanimação Neonatal", "Desidratação"],
  "Ginecologia e Obstetrícia": ["Pré-eclâmpsia", "Hemorragia Pós-Parto", "Diabetes Gestacional", "Anticoncepção", "Trabalho de Parto Prematuro"],
  "Medicina Preventiva": ["SUS", "Epidemiologia", "Bioestatística", "Estudos Epidemiológicos", "Ética e Bioética Médica"],
  "Infectologia": ["HIV/AIDS", "Tuberculose", "Sepse", "Arboviroses", "Meningite"],
  "Pneumologia": ["Asma", "DPOC", "Pneumonia", "Tuberculose", "Tromboembolismo Pulmonar", "Derrame Pleural"],
  "Gastroenterologia": ["Doença do Refluxo", "Hemorragia Digestiva", "Cirrose Hepática", "Hepatites Virais"],
  "Endocrinologia": ["Diabetes Mellitus Tipo 2", "Cetoacidose Diabética", "Hipotireoidismo", "Dislipidemias"],
  "Neurologia": ["AVC Isquêmico", "Epilepsia", "Cefaleia", "Meningite"],
  "Dermatologia": ["Hanseníase", "Melanoma", "Lesões Elementares da Pele", "Piodermites"],
  "Nefrologia": ["Insuficiência Renal Aguda", "Distúrbios Hidroeletrolíticos", "Acidose e Alcalose", "Glomerulonefrites"],
  "Emergência": ["PCR e RCP", "Choque", "Politrauma", "Anafilaxia"],
  "Oncologia": ["Câncer de Mama", "Câncer Colorretal", "Câncer de Pulmão", "Estadiamento TNM"],
  "Hematologia": ["Anemias", "Leucemias", "Linfomas", "Distúrbios da Hemostasia"],
  "Angiologia": ["Trombose Venosa Profunda", "Doença Arterial Periférica", "Aneurisma de Aorta"],
  "Psiquiatria": ["Depressão", "Esquizofrenia", "Emergências Psiquiátricas", "Dependência Química"],
  "Reumatologia": ["Lúpus Eritematoso", "Artrite Reumatoide", "Vasculites"],
  "Urologia": ["Litíase Urinária", "Infecção Urinária", "Hiperplasia Prostática"],
};

const REAL_EXAM_SOURCES = [
  "REVALIDA INEP 2015", "REVALIDA INEP 2016", "REVALIDA INEP 2017",
  "REVALIDA INEP 2018", "REVALIDA INEP 2019", "REVALIDA INEP 2020",
  "REVALIDA INEP 2021", "REVALIDA INEP 2022", "REVALIDA INEP 2023",
  "REVALIDA INEP 2024", "REVALIDA INEP 2025",
  "ENAMED 2024", "ENAMED 2025",
  "ENARE 2020", "ENARE 2021", "ENARE 2022", "ENARE 2023", "ENARE 2024",
  "USP-SP Residência 2020", "USP-SP Residência 2021", "USP-SP Residência 2022",
  "USP-SP Residência 2023", "USP-SP Residência 2024",
  "UNICAMP Residência 2020", "UNICAMP Residência 2021", "UNICAMP Residência 2022",
  "UNICAMP Residência 2023", "UNICAMP Residência 2024",
  "SUS-SP 2020", "SUS-SP 2021", "SUS-SP 2022", "SUS-SP 2023", "SUS-SP 2024",
  "Santa Casa SP 2022", "Santa Casa SP 2023", "Santa Casa SP 2024",
  "AMRIGS 2022", "AMRIGS 2023", "AMRIGS 2024",
];

function isDuplicate(statement: string, existingStatements: string[]): boolean {
  const prefix = statement.slice(0, 80).toLowerCase();
  return existingStatements.some(ex => ex.slice(0, 80).toLowerCase() === prefix);
}

const CLINICAL_CONTENT_MARKERS = [
  /\b\d{1,3}\s*(anos?|meses?|dias?)\b/i,
  /\b(masculino|feminino|homem|mulher|paciente|gestante|idoso|criança|lactente|neonato|recém-nascido)\b/i,
  /\b(PA|FC|FR|SpO2|temperatura|pressão arterial|frequência cardíaca|saturação)\b/i,
  /\b(exame físico|ao exame|ausculta|palpação|inspeção|percussão)\b/i,
  /\b(hemograma|glicemia|creatinina|ureia|PCR|VHS|TSH|T4|ECG|tomografia|ressonância|radiografia|ultrassonografia)\b/i,
  /\b(queixa|refere|relata|apresenta|evolui|procura|admitido|internado|dá entrada)\b/i,
];

function hasClinicalContent(text: string): boolean {
  let matches = 0;
  for (const marker of CLINICAL_CONTENT_MARKERS) {
    if (marker.test(text)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

async function searchRealQuestionsViaAI(
  specialty: string,
  topics: string[],
  existingStatements: string[],
  supabaseAdmin: any,
  userId: string,
): Promise<number> {
  const selectedSources = REAL_EXAM_SOURCES
    .sort(() => Math.random() - 0.5)
    .slice(0, 8);

  const selectedTopics = topics.sort(() => Math.random() - 0.5).slice(0, 4);

  const bibRef = (await import("../_shared/specialty-bibliography.ts")).getBibliographyForSpecialty(specialty);
  const bibBlock = bibRef ? `\nREFERÊNCIA BIBLIOGRÁFICA: ${bibRef}\n` : "";

  const highYield = HIGH_YIELD[specialty];
  const priorityBlock = highYield ? `\nSUBTÓPICOS PRIORITÁRIOS (dar preferência — mais cobrados em provas de residência): ${highYield.join(", ")}\n` : "";

  const prompt = `Você é um professor de medicina especialista em criar questões no ESTILO e NÍVEL de provas oficiais de residência médica brasileira.

ESPECIALIDADE: ${specialty}
TEMAS PRIORITÁRIOS: ${selectedTopics.join(", ")}
${priorityBlock}${bibBlock}
BANCAS DE REFERÊNCIA (use como padrão de dificuldade e estilo): ${selectedSources.join(", ")}

INSTRUÇÕES CRÍTICAS:
1. Gere questões NO ESTILO e NÍVEL das bancas listadas acima — NÃO tente reproduzir questões específicas
2. O campo "exam_style_ref" deve indicar qual banca/estilo você usou como referência (ex: "Estilo REVALIDA INEP")
3. OBRIGATÓRIO: CADA questão DEVE ter um CASO CLÍNICO COMPLETO com:
   - Paciente com idade, sexo e contexto (profissão, antecedentes)
   - Anamnese com queixa principal e história da doença atual
   - Exame físico com achados positivos E negativos relevantes
   - Sinais vitais completos (PA, FC, FR, Temp, SpO2)
   - Pelo menos um exame complementar com valores numéricos e unidades
1. MÍNIMO 450 caracteres no enunciado (Padrão Ouro)
2. 4 alternativas (A, B, C, D), apenas 1 correta — TODAS clinicamente plausíveis
6. Explicação detalhada com raciocínio clínico passo a passo
7. Dificuldade MÍNIMA: 3/5 (padrão REVALIDA). Distribua: 50% nível 3, 50% nível 4-5
8. PROIBIDO: questões puramente conceituais ("O que é X?", "Defina Y", "Qual a função de Z?")
9. PROIBIDO: questões que referenciem imagens, figuras, fotos, radiografias ou gráficos externos
10. PROIBIDO: enunciados sem dados de paciente real

⛔ CONTEÚDO PROIBIDO: NUNCA gere sobre declarações financeiras, conflitos de interesse, relações com indústria farmacêutica.

Gere EXATAMENTE 6 questões de ${specialty}.

FORMATO JSON OBRIGATÓRIO (sem markdown):
{
  "questions": [
    {
      "statement": "Caso clínico completo com ≥400 caracteres (padrão ENAMED)...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "Raciocínio clínico passo a passo...",
      "topic": "${specialty}",
      "difficulty": 3,
      "exam_style_ref": "Estilo REVALIDA INEP"
    }
  ]
}`;

  try {
    const startMs = Date.now();
    const response = await aiFetch({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um professor de medicina que cria questões de altíssima qualidade no estilo de provas reais de residência médica brasileira. Responda APENAS com JSON válido, sem markdown. Cada questão DEVE ter caso clínico completo.\n\nIDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA gere questões, alternativas ou explicações em inglês." },
        { role: "user", content: prompt },
      ],
      timeoutMs: 55000,
      maxRetries: 0,
    });
    const elapsed = Date.now() - startMs;

    if (!response.ok) {
      console.error(`Exam-style AI error for ${specialty}:`, await response.text());
      logAiUsage({ userId: "system", functionName: "daily-question-generator-exam", modelUsed: "google/gemini-2.5-flash", success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});
      return 0;
    }
    logAiUsage({ userId: "system", functionName: "daily-question-generator-exam", modelUsed: "google/gemini-2.5-flash", success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});

    const data = await response.json();
    const rawContent = sanitizeAiContent(data.choices?.[0]?.message?.content || "");
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { return 0; }
      }
    }

    if (!parsed?.questions) return 0;

    const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female)\b/i;
    const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
    const questions = parsed.questions.filter((q: any) =>
      q.statement && Array.isArray(q.options) && q.options.length >= 4 && q.options.length <= 4 &&
      typeof q.correct_index === "number" &&
      String(q.statement).trim().length >= 400 &&
      (q.difficulty || 3) >= 3 &&
      hasClinicalContent(String(q.statement)) &&
      !INVALID_CONTENT_REGEX.test(q.statement) &&
      !INVALID_CONTENT_REGEX.test(q.explanation || "") &&
      !isDuplicate(q.statement, existingStatements) &&
      !ENGLISH_PATTERN.test(q.statement) &&
      !IMAGE_REF_PATTERN.test(q.statement)
    );

    if (questions.length === 0) return 0;

    const rows = questions.map((q: any) => ({
      user_id: userId,
      statement: String(q.statement).trim(),
      options: q.options.map(String),
      correct_index: q.correct_index,
      explanation: `[Ref. estilo: ${String(q.exam_style_ref || specialty).trim()}]\n\n${String(q.explanation || "").trim()}`,
      topic: specialty,
      difficulty: q.difficulty || 3,
      source: "ai-exam-style",
      is_global: true,
      review_status: "pending",
    }));

    const { error } = await supabaseAdmin.from("questions_bank").insert(rows);
    if (error) {
      console.error("Insert exam-style questions error:", error);
      return 0;
    }

    rows.forEach((r: any) => existingStatements.push(r.statement));

    return rows.length;
  } catch (e) {
    console.error(`Error generating exam-style questions for ${specialty}:`, e);
    return 0;
  }
}

async function generateForSpecialty(
  specialty: string,
  topics: string[],
  userId: string,
  supabaseAdmin: any,
  existingStatements: string[],
  targetCount: number = 10,
): Promise<number> {
  const selectedTopics = topics.sort(() => Math.random() - 0.5).slice(0, 5);

  let antiRepetitionBlock = "";
  if (existingStatements.length > 0) {
    antiRepetitionBlock = `\n\n⛔ NÃO REPITA cenários similares a: ${existingStatements.slice(0, 10).map((s, i) => `${i + 1}. ${s.slice(0, 60)}`).join("; ")}`;
  }

  const bibRef = (await import("../_shared/specialty-bibliography.ts")).getBibliographyForSpecialty(specialty);
  const bibBlock = bibRef ? `\nBIBLIOGRAFIA DE REFERÊNCIA OBRIGATÓRIA para ${specialty}: ${bibRef}\nUse estes livros como base para o conteúdo e cite-os nas explicações.\n` : "";

  const highYield = HIGH_YIELD[specialty];
  const priorityBlock2 = highYield ? `\nSUBTÓPICOS PRIORITÁRIOS (distribuir questões preferencialmente entre estes): ${highYield.join(", ")}\n` : "";

  const prompt = `Gere EXATAMENTE ${targetCount} questões de múltipla escolha de ${specialty} para Residência Médica.

TEMAS: ${selectedTopics.join(", ")}
${priorityBlock2}${bibBlock}

CALIBRAÇÃO OBRIGATÓRIA REVALIDA/ENAMED:
- PROIBIDO: questões de definição pura ("O que é X?", "Defina Y", "Qual o conceito de Z")
- PROIBIDO: enunciados com menos de 400 caracteres (padrão ENAMED)
- OBRIGATÓRIO: caso clínico com ≥3 dados clínicos relevantes (sinais vitais, exames, achados semiológicos)
- OBRIGATÓRIO: ≥2 etapas de raciocínio clínico (ex: diagnóstico → conduta, ou achado → interpretação → tratamento)
- OBRIGATÓRIO: pelo menos 2 distratores plausíveis baseados em diagnósticos diferenciais REAIS
- DIFICULDADE MÍNIMA: 3/5 (intermediário = padrão REVALIDA)

REGRAS:
- Nível de prova de residência médica real (REVALIDA INEP, ENAMED, ENARE, USP, UNICAMP)
- Casos clínicos realistas com anamnese completa (nome, idade, sexo, profissão), exame físico com achados positivos e negativos, sinais vitais completos (PA, FC, FR, Temp, SpO2), exames complementares com valores numéricos e unidades
- EXATAMENTE 4 alternativas (A, B, C, D), apenas 1 correta — todas clinicamente PLAUSÍVEIS
- PROIBIDO: questões que referenciem imagens, figuras, fotos ou gráficos externos
- Distribuição de dificuldade: 50% intermediário (padrão REVALIDA), 50% difícil (padrão ENAMED/ENARE com pegadinhas e apresentações atípicas)
- NUNCA repita perfil de paciente (nome, idade, sexo, cenário)
- Distribua subtópicos: diagnóstico, tratamento, fisiopatologia, epidemiologia, complicações
- Inclua apresentações ATÍPICAS de doenças comuns (ex: IAM sem dor em diabético, apendicite no idoso)
${antiRepetitionBlock}

⛔ CONTEÚDO PROIBIDO: NUNCA gere sobre declarações financeiras, conflitos de interesse, relações com indústria farmacêutica.

FORMATO JSON OBRIGATÓRIO (sem markdown):
{
  "questions": [
    {
      "statement": "Caso clínico completo com ≥400 caracteres (padrão ENAMED)...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "explanation": "Raciocínio clínico passo a passo...",
      "topic": "${specialty}",
      "difficulty": 3
    }
  ]
}`;

  try {
    const startMs = Date.now();
    const response = await aiFetch({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um professor de medicina especialista em criar questões de residência médica. Responda APENAS com JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ],
      timeoutMs: 55000,
      maxRetries: 0,
    });
    const elapsed = Date.now() - startMs;

    if (!response.ok) {
      console.error(`AI error for ${specialty}:`, await response.text());
      logAiUsage({ userId: "system", functionName: "daily-question-generator", modelUsed: "google/gemini-2.5-flash", success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});
      return 0;
    }
    logAiUsage({ userId: "system", functionName: "daily-question-generator", modelUsed: "google/gemini-2.5-flash", success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});

    const data = await response.json();
    const rawContent = sanitizeAiContent(data.choices?.[0]?.message?.content || "");
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { return 0; }
      }
    }

    if (!parsed?.questions) return 0;

    const IMAGE_REF_PATTERN2 = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
    const questions = parsed.questions.filter((q: any) =>
      q.statement && Array.isArray(q.options) && q.options.length >= 4 && q.options.length <= 5 &&
      typeof q.correct_index === "number" &&
      String(q.statement).trim().length >= 400 &&
      (q.difficulty || 3) >= 3 &&
      !INVALID_CONTENT_REGEX.test(q.statement) &&
      !INVALID_CONTENT_REGEX.test(q.explanation || "") &&
      !IMAGE_REF_PATTERN2.test(q.statement)
    );

    if (questions.length === 0) return 0;

    const rows = questions.map((q: any) => ({
      user_id: userId,
      statement: String(q.statement).trim(),
      options: q.options.map(String),
      correct_index: q.correct_index,
      explanation: String(q.explanation || "").trim(),
      topic: specialty,
      difficulty: q.difficulty || 3,
      source: "daily-auto",
      is_global: true,
      review_status: "pending",
    }));

    const { error } = await supabaseAdmin.from("questions_bank").insert(rows);
    if (error) {
      console.error("Insert error:", error);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.error(`Error generating for ${specialty}:`, e);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get admin user_id for ownership
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    const userId = adminRole?.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "No admin user found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Weighted cycle prioritization: Internato 3x, Clínico 2x, Básico 1x
    const INTERNATO = ["Cirurgia Geral", "Ginecologia e Obstetrícia", "Emergência", "Medicina Preventiva", "Pediatria", "Terapia Intensiva"];
    const CICLO_CLINICO = ["Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia", "Gastroenterologia", "Nefrologia", "Infectologia", "Hematologia", "Reumatologia", "Dermatologia", "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia", "Otorrinolaringologia", "Angiologia", "Oncologia"];
    function getCycleWeight(spec: string): number {
      if (INTERNATO.includes(spec)) return 3;
      if (CICLO_CLINICO.includes(spec)) return 2;
      return 1; // Ciclo Básico
    }

    // Pick 3 specialties using weighted score (count / weight)
    const countPromises = SPECIALTIES.map(async (spec) => {
      const { count } = await supabaseAdmin
        .from("questions_bank")
        .select("id", { count: "exact", head: true })
        .eq("is_global", true)
        .eq("topic", spec);
      const weight = getCycleWeight(spec);
      return { spec, count: count || 0, weight, score: (count || 0) / weight };
    });
    const countResults = await Promise.all(countPromises);
    countResults.sort((a, b) => a.score - b.score);

    // Ensure at least 1 Internato and 1 Clínico in selection
    const selected: string[] = [];
    const internatoPool = countResults.filter(c => INTERNATO.includes(c.spec));
    const clinicoPool = countResults.filter(c => CICLO_CLINICO.includes(c.spec));
    if (internatoPool.length > 0) selected.push(internatoPool[0].spec);
    if (clinicoPool.length > 0) selected.push(clinicoPool[0].spec);
    // Fill remaining slot(s) from top of sorted list (excluding already selected)
    for (const c of countResults) {
      if (selected.length >= 3) break;
      if (!selected.includes(c.spec)) selected.push(c.spec);
    }

    console.log(`Daily generation starting for: ${selected.join(", ")} (weighted scores: ${countResults.slice(0, 8).map(c => `${c.spec}:${c.count}/${c.weight}=${c.score.toFixed(0)}`).join(", ")})`);

    const results: Record<string, { real: number; generated: number }> = {};
    let totalGenerated = 0;

    for (const spec of selected) {
      // Fetch last 15 statements for anti-repetition
      const { data: existing } = await supabaseAdmin
        .from("questions_bank")
        .select("statement")
        .eq("topic", spec)
        .eq("is_global", true)
        .order("created_at", { ascending: false })
        .limit(15);

      const existingStatements = (existing || []).map((r: any) => r.statement);
      const topics = TOPICS_BY_SPECIALTY[spec] || [spec];

      // Phase 0: Try web scraping for real questions (if Firecrawl is configured)
      let webScrapeCount = 0;
      const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (FIRECRAWL_KEY) {
        try {
          const scrapeResp = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-real-questions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({ specialty: spec }),
            }
          );
          if (scrapeResp.ok) {
            const scrapeData = await scrapeResp.json();
            webScrapeCount = scrapeData.questions_inserted || 0;
            console.log(`${spec}: ${webScrapeCount} web-scraped real questions`);
          }
        } catch (e) {
          console.warn(`Web scraping failed for ${spec}, continuing with AI:`, e);
        }
      }

      // Phase 1: Search AI exam-style questions (target: 6 minus web-scraped)
      const examTarget = Math.max(0, 6 - webScrapeCount);
      let realCount = 0;
      if (examTarget > 0) {
        realCount = await searchRealQuestionsViaAI(spec, topics, existingStatements, supabaseAdmin, userId);
        console.log(`${spec}: ${realCount} exam-style questions generated`);
      }

      // Phase 2: Generate complementary questions to reach 15 total
      const totalSoFar = webScrapeCount + realCount;
      const remaining = Math.max(0, 15 - totalSoFar);
      let genCount = 0;
      if (remaining > 0) {
        genCount = await generateForSpecialty(spec, topics, userId, supabaseAdmin, existingStatements, remaining);
        console.log(`${spec}: ${genCount} generated questions added`);
      }

      results[spec] = { real: webScrapeCount + realCount, generated: genCount };
      totalGenerated += webScrapeCount + realCount + genCount;
    }

    // Log the run
    await supabaseAdmin.from("daily_generation_log").insert({
      run_date: new Date().toISOString().split("T")[0],
      specialties_processed: results,
      questions_generated: totalGenerated,
      status: totalGenerated > 0 ? "success" : "failed",
    });

    return new Response(JSON.stringify({
      message: `Geração diária concluída: ${totalGenerated} questões (reais + geradas)`,
      results,
      total_generated: totalGenerated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("daily-question-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
