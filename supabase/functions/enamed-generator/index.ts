import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { insertFlashcardsWithFsrs, applyQualityGate } from "../_shared/flashcard-governance.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API = "https://api.openai.com/v1/chat/completions";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const ENAMED_THEMES = [
  { specialty: "Clínica Médica", topics: ["IAM e SCA", "Insuficiência Cardíaca", "DPOC e Asma", "Pneumonia Comunitária", "TEP", "AVC Isquêmico e Hemorrágico", "Diabetes Mellitus", "Cetoacidose Diabética", "Hipotireoidismo e Hipertireoidismo", "Sepse e Choque Séptico", "Insuficiência Renal Aguda", "Doença Renal Crônica", "Distúrbios Hidroeletrolíticos", "Cirrose e Hepatopatias", "Anemia Falciforme", "Lúpus Eritematoso Sistêmico", "Artrite Reumatoide", "Meningite Bacteriana", "HIV/AIDS", "Tuberculose Pulmonar e Extrapulmonar"] },
  { specialty: "Cirurgia", topics: ["Abdome Agudo", "Apendicite Aguda", "Colecistite e Colelitíase", "Obstrução Intestinal", "Trauma Abdominal (FAST/Lavado)", "Politrauma e ATLS", "Hérnia Inguinal", "Pancreatite Aguda", "Hemorragia Digestiva Alta e Baixa", "Queimaduras", "Choque Hipovolêmico", "Diverticulite", "Câncer Gástrico e Colorretal", "Trauma Torácico", "Nódulo Tireoidiano"] },
  { specialty: "Pediatria", topics: ["IVAS e Otite Média", "Bronquiolite", "Pneumonia na Infância", "Asma Infantil", "Desidratação e TRO", "Convulsão Febril", "Icterícia Neonatal", "Crescimento e Desenvolvimento", "Calendário Vacinal", "Febre Reumática", "Doenças Exantemáticas", "Infecção Urinária na Infância", "Meningite Neonatal", "Desnutrição e Raquitismo", "Aleitamento Materno"] },
  { specialty: "Ginecologia e Obstetrícia", topics: ["Pré-eclâmpsia e Eclâmpsia", "Diabetes Gestacional", "Placenta Prévia e DPP", "Gravidez Ectópica", "Hemorragias da 1ª e 2ª Metade", "Pré-natal de Alto Risco", "Trabalho de Parto", "Indicações de Cesárea", "Infecções na Gestação (TORCH)", "Câncer de Colo Uterino e Rastreamento", "Câncer de Mama", "Endometriose", "SOP", "Mioma Uterino", "Anticoncepção e Planejamento Familiar"] },
  { specialty: "Medicina Preventiva e Saúde Coletiva", topics: ["Princípios do SUS", "Atenção Primária e ESF", "Vigilância Epidemiológica", "Doenças de Notificação Compulsória", "Epidemiologia Descritiva e Analítica", "Estudos Epidemiológicos (Coorte, Caso-Controle)", "Indicadores de Saúde", "Bioestatística (Sensibilidade, Especificidade, VPP, VPN)", "Rastreamento Populacional", "Política Nacional de Humanização", "NASF e CAPS", "Determinantes Sociais da Saúde", "Saúde do Trabalhador", "Ética Médica e Bioética"] },
  { specialty: "Urgência e Emergência", topics: ["PCR e RCP (ACLS/BLS)", "Choque (Distributivo, Cardiogênico, Obstrutivo, Hipovolêmico)", "Anafilaxia", "Intoxicações Exógenas", "Queimaduras e Via Aérea Difícil", "Afogamento e Hipotermia", "Cetoacidose e Estado Hiperosmolar", "Crise Hipertensiva", "Edema Agudo de Pulmão", "Status Epilepticus", "Hemorragia Subaracnóidea", "Síndrome Coronariana Aguda no PS", "Arritmias Graves", "Pneumotórax Hipertensivo", "Tamponamento Cardíaco"] },
  { specialty: "Saúde Mental e Psiquiatria", topics: ["Depressão Maior e Risco Suicida", "Transtorno Bipolar", "Esquizofrenia e Surto Psicótico", "Transtornos de Ansiedade", "Delirium e Demência", "Dependência Química (Álcool, Cocaína, Opioides)", "Síndrome Neuroléptica Maligna", "Síndrome Serotoninérgica", "RAPS e CAPS", "Reforma Psiquiátrica Brasileira", "Psicofarmacologia Básica", "Transtornos Alimentares", "TEPT", "Emergências Psiquiátricas"] },
  { specialty: "Infectologia", topics: ["Dengue e Arboviroses", "Malária", "Leptospirose", "Doença de Chagas", "Leishmaniose Visceral e Tegumentar", "Febre Amarela", "Hepatites Virais (A, B, C)", "Sífilis Congênita e Adquirida", "Meningites Infecciosas", "Endocardite Infecciosa", "Infecções Oportunistas no HIV", "Tuberculose Multirresistente", "Sepse e Antibioticoterapia Empírica", "Esquistossomose", "Infecções Relacionadas à Assistência à Saúde (IRAS)"] },
  { specialty: "Cardiologia", topics: ["Hipertensão Arterial Sistêmica", "Fibrilação Atrial", "Insuficiência Cardíaca Crônica", "Valvopatias (Estenose Aórtica, Insuficiência Mitral)", "Miocardiopatias", "Doença Arterial Coronariana Crônica", "Pericardite e Tamponamento", "Dissecção de Aorta", "Endocardite", "Cardiopatias Congênitas", "Síncope", "Marca-passo e CDI", "Tromboembolismo Venoso", "Eletrocardiografia Avançada", "Estratificação de Risco Cardiovascular"] },
  { specialty: "Neurologia", topics: ["AVC Isquêmico (Trombólise e Trombectomia)", "AVC Hemorrágico", "Epilepsia e Estado de Mal", "Cefaleia (Migrânea, Cluster, Secundárias)", "Esclerose Múltipla", "Doença de Parkinson", "Miastenia Gravis", "Síndrome de Guillain-Barré", "Neuropatias Periféricas", "Tumores do SNC", "Hidrocefalia", "Meningite e Encefalite", "Trauma Cranioencefálico", "Coma e Morte Encefálica", "Distúrbios do Movimento"] },
  { specialty: "Ortopedia e Traumatologia", topics: ["Fraturas do Fêmur Proximal", "Fraturas do Rádio Distal", "Luxação Glenoumeral", "Síndrome do Túnel do Carpo", "Lombalgia e Hérnia Discal", "Artrose de Joelho e Quadril", "Fraturas Expostas (Gustilo-Anderson)", "Lesão de Ligamentos do Joelho (LCA/LCP)", "Osteomielite", "Tumor Ósseo", "Fratura de Coluna", "Pé Torto Congênito", "Displasia do Desenvolvimento do Quadril", "Síndrome Compartimental", "Fraturas em Crianças (Torus, Galho Verde)"] },
  { specialty: "Dermatologia", topics: ["Hanseníase", "Psoríase", "Dermatite Atópica", "Câncer de Pele (Melanoma, CBC, CEC)", "Infecções Fúngicas (Dermatofitoses, Candidíase)", "Farmacodermias (NET, Stevens-Johnson)", "Pênfigo Vulgar e Bolhoso", "Urticária e Angioedema", "Acne Vulgar", "Escabiose e Pediculose", "Lúpus Cutâneo", "Vitiligo", "Celulite e Erisipela", "Fasciíte Necrosante", "Leishmaniose Tegumentar"] },
  { specialty: "Angiologia e Cirurgia Vascular", topics: ["Doença Arterial Obstrutiva Periférica", "Aneurisma de Aorta Abdominal", "Trombose Venosa Profunda", "Tromboembolismo Pulmonar", "Insuficiência Venosa Crônica", "Varizes de Membros Inferiores", "Úlcera Venosa e Arterial", "Dissecção de Aorta", "Isquemia Aguda de Membros", "Pé Diabético e Amputações", "Síndrome Compartimental Vascular", "Linfedema", "Fístula Arteriovenosa", "Estenose de Carótida", "Vasculites (Buerger, Takayasu, Poliarterite Nodosa)"] },
];

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const buildBody = (model: string) => {
    const modelToUse = model.includes("openai/") ? model.split("/")[1] : model;
    const isNewModel = modelToUse.startsWith("o1") || modelToUse.startsWith("o3") || modelToUse.startsWith("gpt-5");
    const tokenParam = isNewModel ? "max_completion_tokens" : "max_tokens";
    return JSON.stringify({
      model: modelToUse,
      messages,
      [tokenParam]: 16384,
      temperature: 0.85,
    });
  };

  if (OPENAI_API_KEY) {
    try {
      const startMs = Date.now();
      const model = "gpt-4o-mini";
      const res = await fetch(OPENAI_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: buildBody(model),
      });
      if (res.ok) {
        const data = await res.json();
        logAiUsage({ userId: "system", functionName: "enamed-generator", modelUsed: model, success: true, responseTimeMs: Date.now() - startMs, cacheHit: false, modelTier: "pro" }).catch(() => {});
        return data.choices?.[0]?.message?.content || "";
      }
    } catch (e) {
      console.warn("Direct OpenAI failed:", e);
    }
  }

  if (LOVABLE_API_KEY) {
    const startMs = Date.now();
    const model = "openai/gpt-4o-mini";
    const res = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: buildBody(model),
    });
    if (res.ok) {
      const data = await res.json();
      logAiUsage({ userId: "system", functionName: "enamed-generator", modelUsed: model, success: true, responseTimeMs: Date.now() - startMs, cacheHit: false, modelTier: "pro" }).catch(() => {});
      return data.choices?.[0]?.message?.content || "";
    }
  }

  throw new Error("No AI API key available");
}

async function generateENAMEDContent(
  specialty: string,
  topics: string[],
  userId: string,
  supabaseAdmin: any,
  source: string,
): Promise<{ questions: number; flashcards: number; cases: number }> {
  const selectedTopics = topics.sort(() => Math.random() - 0.5).slice(0, 6);

  const prompt = `Você é um elaborador de questões de ELITE das provas ENAMED, REVALIDA INEP, USP, UNIFESP, UNICAMP e ENARE.

IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA gere questões, alternativas, explicações, flashcards ou casos clínicos em inglês. Inglês permitido APENAS em nomes de artigos/guidelines.

GERE EXATAMENTE:
- 10 questões de múltipla escolha no padrão ENAMED/REVALIDA
- 8 flashcards
- 5 casos clínicos estruturados

ESPECIALIDADE: ${specialty}
TEMAS OBRIGATÓRIOS: ${selectedTopics.join(", ")}

=== PADRÃO DE EXCELÊNCIA PARA QUESTÕES ===

CADA QUESTÃO DEVE OBRIGATORIAMENTE:

1. **CASO CLÍNICO COMPLETO** (mínimo 80% das questões):
   - Nome fictício, idade EXATA, sexo, profissão quando relevante
   - Queixa principal com TEMPO DE EVOLUÇÃO preciso
   - Antecedentes: comorbidades + medicações em uso (nome, dose)
   - Hábitos: tabagismo (maços/ano), etilismo, drogas
   - Sinais vitais COMPLETOS: PA, FC, FR, Temp, SpO2
   - Exame físico com achados POSITIVOS e NEGATIVOS relevantes
   - Exames laboratoriais com VALORES NUMÉRICOS reais e unidades
   - Laudos de imagem descritivos quando pertinente

2. **ALTERNATIVAS DE ALTO NÍVEL**:
   - EXATAMENTE 4 alternativas (A-D), apenas 1 correta — TODAS clinicamente plausíveis
   - Distratores baseados em diagnósticos diferenciais LEGÍTIMOS
   - Uma alternativa "quase correta" que testa nuance clínica
   - Extensão similar entre alternativas

3. **EXPLICAÇÃO COMPLETA**:
   - Raciocínio clínico passo a passo
   - Por que cada alternativa está certa ou errada
   - Conduta terapêutica atualizada (guidelines 2024-2026)
   - Referência a diretrizes brasileiras (MS, SBC, SBP, FEBRASGO, Sepsis-3)

4. **VARIAÇÃO OBRIGATÓRIA**:
   - Alternar faixas etárias, sexo, comorbidades, cenários (PS, UTI, UBS, SAMU)
   - Incluir apresentações ATÍPICAS (ex: IAM sem dor em diabético, apendicite no idoso)
   - Priorizar doenças tropicais/negligenciadas quando pertinente
    - 50% intermediário (padrão REVALIDA), 50% difícil/expert (padrão ENAMED/ENARE)
    - DIFICULDADE MÍNIMA: 3/5 — PROIBIDO nível fácil (1-2)
     - PROIBIDO: questões que referenciem imagens, figuras, fotos, radiografias ou gráficos externos
     - PROIBIDO: questões de definição pura ("O que é X?") ou enunciados < 450 caracteres (Padrão Ouro) sem caso clínico robusto

5. **ANAMNESE ÚNICA POR QUESTÃO (REGRA ABSOLUTA)**:
   - NUNCA repita nome, idade, sexo ou perfil de paciente entre questões
   - Cada questão DEVE ter um paciente COMPLETAMENTE DIFERENTE
   - Variar: nomes regionais brasileiros, idades de 0 a 95 anos, profissões diversas
   - Alternar cenários: PS, enfermaria, UTI, UBS, SAMU, ambulatório, domicílio
   - Variar comorbidades de base: DM, HAS, IRC, HIV, tabagismo, etilismo, gestante
   - Variar queixa principal e tempo de evolução (horas, dias, semanas, meses)
   - Incluir pacientes: idosos frágeis, gestantes, crianças, imunossuprimidos, trabalhadores rurais
   - PROIBIDO: dois pacientes com mesmo perfil demográfico no mesmo bloco

6. **REGRA DE REPETIÇÃO ESPAÇADA (PRIORIDADE MÁXIMA)**:
   - PODE repetir o mesmo tema/doença, desde que haja pelo menos 2 itens de INTERVALO entre eles
   - Quando repetir, OBRIGATORIAMENTE use ENFOQUE DIFERENTE (diagnóstico → tratamento → complicações)
   - NUNCA coloque dois itens do MESMO TEMA em posições CONSECUTIVAS
   - Distribua subtópicos: diagnóstico, tratamento, fisiopatologia, epidemiologia, complicações, prognóstico
   - VERIFICAÇÃO PRÉ-ENVIO:
     a) Algum tema aparece em posições CONSECUTIVAS? → Intercale com outro tema
     b) Algum perfil de paciente se repete? → Diversifique
     c) Os itens cobrem pelo menos 5 subtópicos DIFERENTES? → Se não, redistribua

=== PADRÃO DOS FLASHCARDS ===
- Pergunta direta sobre conceito-chave para residência
- Resposta concisa mas completa, citando conduta, critérios diagnósticos e fonte

=== PADRÃO DOS CASOS CLÍNICOS ESTRUTURADOS ===

Cada caso deve conter:
- Título descritivo do caso
- História clínica completa (identificação, QP, HDA, antecedentes, hábitos, medicações)
- Sinais vitais como objeto (PA, FC, FR, Temp, SpO2)
- Exame físico detalhado
- Exames laboratoriais com valores numéricos
- Exames de imagem quando pertinente
- Diagnóstico correto
- Diagnósticos diferenciais (lista)
- Conduta terapêutica
- Explicação do raciocínio clínico

FORMATO JSON PURO (sem markdown):
{
  "questions": [
    {"statement":"Caso clínico completo...","options":["A) ...","B) ...","C) ...","D) ..."],"correct_index":0,"explanation":"Raciocínio clínico...","topic":"${specialty}","difficulty":3}
  ],
  "flashcards": [
    {"question":"Pergunta?","answer":"Resposta completa.","topic":"${specialty}"}
  ],
  "clinical_cases": [
    {"title":"Título do caso","clinical_history":"História completa...","vitals":{"PA":"120/80","FC":"88","FR":"18","Temp":"36.5","SpO2":"97%"},"physical_exam":"Achados do exame físico...","lab_results":[{"exam":"Hemoglobina","value":"12.5 g/dL","reference":"12-16 g/dL"}],"imaging":"Descrição de imagem se aplicável","correct_diagnosis":"Diagnóstico correto","differential_diagnoses":["Diferencial 1","Diferencial 2"],"treatment":"Conduta terapêutica completa","explanation":"Raciocínio clínico detalhado","difficulty":3}
  ]
}`;

  try {
    const content = await callAI([
      { role: "system", content: "Responda EXCLUSIVAMENTE com JSON válido. Sem markdown, sem comentários." },
      { role: "user", content: prompt },
    ]);

    const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    let parsed: any = null;
    try { 
      parsed = JSON.parse(cleaned); 
    } catch (e) {
      const m = cleaned.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
    
    if (!parsed) return { questions: 0, flashcards: 0, cases: 0 };

    const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice)\b/i;
    const questions = (parsed.questions || []).filter((q: any) =>
      q.statement && Array.isArray(q.options) && q.options.length === 4 &&
      typeof q.correct_index === "number" &&
      String(q.statement).trim().length >= 150 &&
      !ENGLISH_PATTERN.test(q.statement)
    );

    let qCount = 0;
    if (questions.length > 0) {
      const rows = questions.map((q: any) => ({
        user_id: userId,
        statement: String(q.statement).trim(),
        options: q.options.map(String),
        correct_index: q.correct_index,
        explanation: String(q.explanation || "").trim(),
        topic: String(q.topic || specialty).trim(),
        difficulty: q.difficulty || 3,
        source,
        is_global: true,
        review_status: "pending",
        quality_tier: String(q.statement).trim().length >= 400 ? "exam_standard" : "basic",
      }));
      const { error } = await supabaseAdmin.from("questions_bank").insert(rows);
      if (!error) qCount = rows.length;
    }

    const flashcards = (parsed.flashcards || []).filter((f: any) => f.question && f.answer);
    let fCount = 0;
    if (flashcards.length > 0) {
      const normalizedCards = flashcards.map((f: any) => ({
        question: String(f.question).trim(),
        answer: String(f.answer).trim(),
        topic: String(f.topic || specialty).trim(),
      }));

      const { accepted } = applyQualityGate(normalizedCards);
      
      if (accepted.length > 0) {
        const fRows = accepted.map((f: any) => ({
          user_id: userId,
          question: f.question,
          answer: f.answer,
          topic: f.topic,
          is_global: true,
          generation_method: "enamed_generator_v2"
        }));
        
        const { flashcards: inserted } = await insertFlashcardsWithFsrs(supabaseAdmin, fRows, { 
          userId, 
          topic: specialty,
          discipline: specialty 
        });
        fCount = inserted.length;
      }
    }


    const clinicalCases = (parsed.clinical_cases || []).filter((c: any) => c.title && c.clinical_history && c.correct_diagnosis);
    let cCount = 0;
    if (clinicalCases.length > 0) {
      const cRows = clinicalCases.map((c: any) => ({
        user_id: userId,
        specialty,
        title: String(c.title).trim(),
        clinical_history: String(c.clinical_history).trim(),
        vitals: c.vitals || {},
        physical_exam: String(c.physical_exam || "").trim(),
        lab_results: Array.isArray(c.lab_results) ? c.lab_results : [],
        imaging: c.imaging ? String(c.imaging).trim() : null,
        correct_diagnosis: String(c.correct_diagnosis).trim(),
        differential_diagnoses: Array.isArray(c.differential_diagnoses) ? c.differential_diagnoses : [],
        treatment: c.treatment ? String(c.treatment).trim() : null,
        explanation: c.explanation ? String(c.explanation).trim() : null,
        difficulty: c.difficulty || 3,
        source,
        is_global: true,
      }));
      const { error } = await supabaseAdmin.from("clinical_cases").insert(cRows);
      if (!error) cCount = cRows.length;
    }

    return { questions: qCount, flashcards: fCount, cases: cCount };
  } catch (e) {
    console.error(`Error ${specialty}:`, e);
    return { questions: 0, flashcards: 0, cases: 0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    const userId = adminRole?.user_id || "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";

    const body = await req.json().catch(() => ({}));
    const rounds = body.rounds || 1;
    const source = body.source || "enamed-revalida-openai";
    const specialtyFilter = body.specialty || null;

    // Intelligent Equalization: Fetch current counts to prioritize missing areas
    const { data: allTopics } = await supabaseAdmin
      .from("questions_bank")
      .select("topic")
      .eq("is_global", true);
    
    const countsMap: Record<string, number> = {};
    allTopics?.forEach((item: any) => {
      const t = String(item.topic || "Geral").trim();
      countsMap[t] = (countsMap[t] || 0) + 1;
    });

    let themesToProcess = ENAMED_THEMES;
    if (specialtyFilter) {
      themesToProcess = ENAMED_THEMES.filter(t => 
        t.specialty.toLowerCase().includes(specialtyFilter.toLowerCase())
      );
    } else {
      themesToProcess = [...ENAMED_THEMES].sort((a, b) => {
        const countA = countsMap[a.specialty] || 0;
        const countB = countsMap[b.specialty] || 0;
        return countA - countB;
      });
      // Limit to 1 per execution to ensure we don't timeout
      themesToProcess = themesToProcess.slice(0, 1);

    }

    let totalQ = 0, totalF = 0, totalC = 0;
    const processed: string[] = [];

    for (let r = 0; r < rounds; r++) {
      for (const theme of themesToProcess) {
        console.log(`[R${r + 1}] Equalizing ${theme.specialty} (Current: ${countsMap[theme.specialty] || 0})...`);
        const result = await generateENAMEDContent(theme.specialty, theme.topics, userId, supabaseAdmin, source);
        totalQ += result.questions;
        totalF += result.flashcards;
        totalC += result.cases;
        processed.push(`${theme.specialty}: ${result.questions}Q, ${result.flashcards}F, ${result.cases}C`);
        countsMap[theme.specialty] = (countsMap[theme.specialty] || 0) + result.questions;
      }
    }

    const { count: qTotal } = await supabaseAdmin.from("questions_bank").select("*", { count: "exact", head: true }).eq("is_global", true);
    const { count: fTotal } = await supabaseAdmin.from("flashcards").select("*", { count: "exact", head: true }).eq("is_global", true);
    const { count: cTotal } = await supabaseAdmin.from("clinical_cases").select("*", { count: "exact", head: true }).eq("is_global", true);

    return new Response(JSON.stringify({
      message: `Equalização em andamento: ${totalQ} questões adicionadas em áreas prioritárias.`,
      questions_added: totalQ,
      flashcards_added: totalF,
      clinical_cases_added: totalC,
      total_questions: qTotal,
      total_flashcards: fTotal,
      total_clinical_cases: cTotal,
      prioritized_specialties: themesToProcess.map(t => t.specialty),
      details: processed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("enamed-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
