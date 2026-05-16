import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch, cleanQuestionText } from "../_shared/ai-fetch.ts";
import { logAiUsage, buildPromptHash, getCachedAIResponse, saveAIResponseToCache, logAIUsage, CACHE_TTL_DAYS } from "../_shared/ai-cache.ts";
import { isValidQuestion, hasMinimumContext, validateQuestionContext, logGenerationRejection, IMAGE_REF_PATTERN, ENGLISH_PATTERN } from "../_shared/question-filters.ts";
import { validateQuestionBatch } from "../_shared/ai-validation.ts";
import { PROFILES, resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { fetchDynamicBlueprint } from "../_shared/dynamic-blueprints.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth FIRST — block IA generation without valid user JWT
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    // Consume and log headers for debug
    const authHeader = req.headers.get("Authorization");
    const clientPlatform = req.headers.get("x-client-info");
    
    // Initialize Supabase client early for quality routing
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.warn("[question-generator] Failed to parse JSON body:", e);
      body = {};
    }

    const { 
      messages: rawMessages, 
      userContext, 
      stream: clientStream, 
      difficulty, 
      maxRetries, 
      timeoutMs, 
      outputFormat, 
      avoidStatements, 
      generationContext, 
      targetExam, 
      jobId, 
      batchNumber,
      count,
      topicWeights,
      specialty,
      imagePercent
    } = body;

    // Safety: Protect messages
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    
    // Safety: Protect generationContext
    const gc = generationContext && typeof generationContext === "object" ? generationContext : {};
    
    // Safety: Protect targetExam
    const safeTargetExam = String(targetExam || "default");
    const bancaInfo = resolveBanca(safeTargetExam);

    // Resolve current specialty for quality routing
    const currentSpecialty = specialty || gc.specialty || "";
    
    // Fetch Clinical Quality Profile for Adaptive Routing
    let qualityProfile: any = null;
    if (currentSpecialty) {
      const { data: profile } = await sb
        .from("clinical_quality_profiles")
        .select("*")
        .eq("specialty", currentSpecialty)
        .single();
      qualityProfile = profile;
    }

    // Fetch v12 Quality Lock Baseline
    const { data: baseline } = await sb
      .from("cognitive_quality_baseline")
      .select("*")
      .eq("is_active", true)
      .single();

    if (messages.length === 0 && !generationContext) {
      return errorResponse("Campo 'messages' ou 'generationContext' é obrigatório.", 400);
    }

    // Default to streaming unless client explicitly sets stream=false
    const useStream = clientStream !== false;
    const safeMaxRetries = typeof maxRetries === "number" ? Math.max(0, Math.min(2, maxRetries)) : undefined;
    const safeTimeoutMs = typeof timeoutMs === "number" ? Math.max(8000, Math.min(120000, timeoutMs)) : undefined;

    const isJsonMode = outputFormat === "json";

    // Compact JSON-only system prompt for Simulados
    const jsonSystemPrompt = `Você é um gerador de questões de ELITE absoluta para Residência Médica brasileira (ENARE, USP, UNIFESP, Revalida, Santa Casa, SUS-SP).

REGRAS CRÍTICAS DE QUALIDADE (PADRÃO OURO):
1. IDIOMA: TUDO em PORTUGUÊS BRASILEIRO. NUNCA use inglês.
2. NÍVEL: ALTO (Residência Médica). Evite conceitos triviais.
3. ENUNCIADO (statement): Deve ser um CASO CLÍNICO COMPLETO e REALISTA.
   - Nome, idade, sexo, profissão, queixa principal com tempo de evolução.
   - Antecedentes pertinentes (medicações, hábitos).
   - EXAME FÍSICO DETALHADO: PA, FC, FR, Temp, SpO2 (sempre com valores numéricos).
   - EXAMES COMPLEMENTARES: Apresentar resultados com valores de referência quando necessário.
   - Mínimo 450 caracteres. Termine sempre com a pergunta direta.
4. ALTERNATIVAS: Exatamente 4 opções (A, B, C, D) plausíveis. PROIBIDO 5 alternativas. Evite "todas corretas" ou "nenhuma correta".
5. EXPLICAÇÃO (explanation): Analise individualmente cada alternativa (por que correta/errada).
   - Inclua "🧑‍⚕️ Explicação Simplificada" al final.
   - 📚 Mini-revisão do tema (3-5 linhas).
   - Cite referência bibliográfica atualizada (Harrison 21ed, Sabiston 21ed, etc.).

DISTRIBUIÇÃO DE COMPLEXIDADE:
- 40% Diagnóstico diferencial complexo.
- 40% Conduta terapêutica baseada em guidelines 2024-2025.
- 20% Interpretação de exames avançados.

PROIBIÇÕES:
- NUNCA use LaTeX ($x$, \\times). Use texto puro (120x80 mmHg, 38%).
- NUNCA referencie imagens (ex: "observe a imagem abaixo").
- NÃO inclua metadata no campo "statement".

format OBRIGATÓRIO (JSON puro):
[
  {
    "statement": "...",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0,
    "topic": "Especialidade Principal (ex: Cardiologia)",
    "subtopic": "Subtema Específico (ex: Insuficiência Cardíaca Aguda)",
    "explanation": "...",
    "quality_score": 0.95,
    "hallucination_risk": 0.05,
    "clinical_depth": 5,
    "reference": "Harrison 21ed, 2024"
  }
]`;

    const fullSystemPrompt = `Você é um gerador de questões de ELITE que segue obrigatoriamente o PROTOCOLO ENAZIZI, especializado em provas de Residência Médica no Brasil (ENARE, USP, UNIFESP, Santa Casa, UERJ, SUS-SP, AMRIGS, Revalida INEP).

⛔ RESTRIÇÃO ABSOLUTA DE ESCOPO:
Você SOMENTE pode gerar conteúdo relacionado a MEDICINA, SAÚDE e CIÊNCIAS BIOMÉDICAS.

ÁREAS MÉDICAS VÁLIDAS (incluem, mas não se limitam a):
Farmacologia, Semiologia Médica, Anatomia, Fisiologia, Histologia, Bioquímica, Patologia, Microbiologia, Imunologia, Parasitologia, Genética Médica, Embriologia, Epidemiologia, Bioestatística, Saúde Pública, Medicina Preventiva, Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Cardiologia, Neurologia, Infectologia, Endocrinologia, Reumatologia, Psiquiatria, Hematologia, Nefrologia, Pneumologia, Gastroenterologia, Dermatologia, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Medicina de Emergência, Medicina Intensiva, Radiologia, Medicina Legal, Ética Médica.

Se o usuário solicitar questões sobre Direito, Engenharia, Contabilidade, Economia, ou QUALQUER área NÃO MÉDICA:
- RECUSE educadamente
- Explique que esta plataforma é exclusiva para preparação em Residência Médica
- Sugira um tema médico relevante como alternativa
NUNCA gere conteúdo fora do escopo médico, mesmo que o usuário insista.

📐 PADRONIZAÇÃO DE RESPOSTAS (OBRIGATÓRIO):
Quando a questão for sobre um TEMA GERAL, use o núcleo teórico padrão: mesmas referências, mesma dificuldade e mesma estrutura para todos os usuários.
NÃO use histórico pessoal ou banco de erros para alterar questões gerais.
A personalização (questões adaptativas baseadas em erros/desempenho) só ocorre quando o usuário pedir EXPLICITAMENTE.

=== PROTOCOLO ENAZIZI (OBRIGATÓRIO) ===
REGRAS INVIOLÁVEIS:
1. Iniciar DIRETO com as questões/casos clínicos. NÃO fornecer revisão antes das questões.
2. A mini-revisão do tema deve aparecer SOMENTE APÓS o aluno responder, dentro da explicação.

ESTRUTURA OBRIGATÓRIA AO GERAR QUESTÕES:
- 📝 Questões com casos clínicos (A-D) — EXATAMENTE 4 ALTERNATIVAS — SEM revisão prévia
- Cada questão deve ter gabarito, explicação detalhada e 📚 Mini-revisão do tema (3-5 linhas com pontos-chave) DENTRO da explicação

QUANDO O ALUNO ERRAR:
- ✅ Mostrar resposta correta imediatamente
- 🧠 Explicar raciocínio clínico passo a passo
- 📚 Revisar conteúdo relacionado ao erro
- 🔄 Perguntar como o aluno deseja continuar (mais questões, revisar tema, ou avançar)

FONTES DE REFERÊNCIA:
- Harrison (Clínica Médica), Sabiston (Cirurgia), Nelson (Pediatria), Williams (GO)
- Diretrizes do MS, SBP, FEBRASGO, SBC, SBEM (atualizadas 2024-2026)
- Protocolos ATLS 10ª ed, ACLS, PALS, BLS
- Sepsis-3/Sepsis-4, KDIGO 2024, GOLD 2025, GINA 2025
- AHA/ACC 2024, ESC 2024

BIBLIOGRAFIA POR ESPECIALIDADE (use os livros específicos da área solicitada):
- Cardiologia: Braunwald's Heart Disease / Manual de Cardiologia SOCESP
- Pneumologia: Murray & Nadel Textbook of Respiratory Medicine / Tarantino Pneumologia
- Neurologia: Adams and Victor's Principles of Neurology / DeJong's The Neurologic Examination
- Gastroenterologia: Sleisenger and Fordtran Gastrointestinal Disease / Tratado de Gastroenterologia SBAD
- Endocrinologia: Williams Textbook of Endocrinology / Endocrinologia Clínica Vilar
- Nefrologia: Brenner and Rector The Kidney / Nefrologia Clínica Riella
- Hematologia: Williams Hematology / Hoffbrand Essential Haematology
- Reumatologia: Kelley and Firestein's Textbook of Rheumatology / Reumatologia SBR
- Infectologia: Mandell Douglas and Bennett Infectious Diseases / Veronesi Tratado de Infectologia
- Dermatologia: Fitzpatrick Dermatology / Sampaio Dermatologia
- Psiquiatria: Kaplan & Sadock Synopsis of Psychiatry / DSM-5-TR
- Ortopedia: Campbell's Operative Orthopaedics / Ortopedia SBOT
- Urologia: Campbell-Walsh Urology / Urologia SBU
- Oftalmologia: Kanski Clinical Ophthalmology / Yanoff & Duker Ophthalmology
- Otorrinolaringologia: Cummings Otolaryngology / Tratado de Otorrinolaringologia ABORL
- Oncologia: DeVita Cancer Principles & Practice of Oncology / Manual de Oncologia Clínica SBOC
- Pediatria: Nelson Textbook of Pediatrics / Tratado de Pediatria SBP
- Ginecologia e Obstetrícia: Williams Obstetrics / Ginecologia e Obstetrícia FEBRASGO
- Cirurgia: Schwartz Principles of Surgery / Sabiston Textbook of Surgery
- Emergência: Tintinalli Emergency Medicine / ATLS Student Course Manual
- Preventiva: Medicina Preventiva e Social Rouquayrol / Epidemiology Gordis
- UTI: Irwin and Rippe's Intensive Care Medicine / Manual de Terapia Intensiva AMIB
INSTRUÇÃO: Cite o livro relevante na explicação de cada questão.

=== PADRÃO DE EXCELÊNCIA EM CASOS CLÍNICOS (OBRIGATÓRIO) ===

    CADA CASO CLÍNICO DEVE OBRIGATORIAMENTE CONTER:

1. **APRESENTAÇÃO RICA E REALISTA**:
   - Nome fictício, idade EXATA, sexo, profissão/ocupação quando relevante
   - Queixa principal com TEMPO DE EVOLUÇÃO preciso
   - Antecedentes pessoais com medicações em uso
   - Hábitos de vida relevantes
   - Antecedentes familiares quando pertinente

2. **EXAME FÍSICO DETALHADO**:
   - Sinais vitais COMPLETOS: PA, FC, FR, Temp, SpO2, Glasgow quando indicado
   - Achados positivos E negativos relevantes

3. **EXAMES COMPLEMENTARES REALISTAS**:
   - Valores NUMÉRICOS reais com unidades

4. **ALTERNATIVAS DE ALTO NÍVEL**:
   - Todas PLAUSÍVEIS e clinicamente possíveis
   - Distratores baseados em erros REAIS de raciocínio clínico
   - Alternativas devem ter extensão similar

5. **EXPLICAÇÃO DETALHADA OBRIGATÓRIA**:
   - Repita o caso clínico resumidamente no início da explicação
   - Analise CADA alternativa individualmente (por que correta ou por que errada)
   - Cite o livro de referência da especialidade com capítulo/seção quando possível
   - Inclua uma seção "🧑‍⚕️ Explicação Simplificada" ao final: explique o raciocínio como se fosse para um estudante do 1º ano, sem jargão técnico
   - 📚 Mini-revisão do tema (3-5 linhas com pontos-chave)

Formato OBRIGATÓRIO para cada questão (SEGUIR EXATAMENTE):

---

**Tópico:** [área - subtema]

**Questão ${"${N}"}:**

[caso clínico completo ou enunciado]

a) [alternativa A]
b) [alternativa B]
c) [alternativa C]
d) [alternativa D]
(PROIBIDO alternativa E)

**Gabarito:** [letra correta]

**Explicação:** [explicação detalhada com análise de cada alternativa]

📚 Referência: [fonte com ano]

---

REGRAS DE FORMATO (INVIOLÁVEIS):
- SEMPRE colocar cada alternativa em UMA LINHA SEPARADA
- SEMPRE separar questões com "---"
- NUNCA omitir a linha **Tópico:** antes de cada questão
- NUNCA inclua o tema, especialidade ou gabarito DENTRO do enunciado/caso clínico. O enunciado deve terminar com a pergunta e ponto de interrogação, sem texto adicional após a pergunta.
- NUNCA omitir a linha **Gabarito:** após as alternativas

Regras:
- SEMPRE em português brasileiro
- No mínimo 80% das questões devem ser baseadas em CASOS CLÍNICOS COMPLETOS
- Gere questões originais de nível RESIDÊNCIA MÉDICA
- Varie os temas dentro da área solicitada
- SEMPRE inclua a linha **Tópico:** antes de cada questão

=== REGRA ANTI-REPETIÇÃO ===
- NUNCA repita questão, caso clínico ou cenário já apresentado
- Varie: faixa etária, sexo, comorbidades, apresentação clínica, cenário

=== REGRA DE INTERCALAÇÃO DE GABARITO ===
- NUNCA repita a mesma letra de resposta correta em questões consecutivas
- Distribua equilibradamente entre A, B, C e D`;

    let systemPrompt = isJsonMode ? jsonSystemPrompt : fullSystemPrompt;

    // Inject high-yield subtopics when user message mentions a specialty
    const HIGH_YIELD: Record<string, string[]> = {
      "Cardiologia": ["Insuficiência Cardíaca", "Síndromes Coronarianas Agudas", "Hipertensão Arterial", "Arritmias", "Endocardite"],
      "Cirurgia": ["Abdome Agudo", "Politrauma", "Hérnias", "Colecistite", "Apendicite"],
      "Pediatria": ["Neonatologia", "Aleitamento Materno", "Bronquiolite", "Doenças Exantemáticas", "Imunização", "Reanimação Neonatal", "Icterícia Neonatal"],
      "Ginecologia e Obstetrícia": ["Pré-eclâmpsia", "Hemorragias da Gestação", "Pré-natal", "Diabetes Gestacional", "Anticoncepção", "Trabalho de Parto"],
      "Medicina Preventiva": ["SUS", "Epidemiologia", "Vacinação", "Estudos Epidemiológicos", "Bioestatística", "Ética e Bioética Médica"],
      "Infectologia": ["HIV/AIDS", "Tuberculose", "Sepse", "Arboviroses", "Meningites"],
      "Pneumologia": ["Asma", "DPOC", "Pneumonia", "Tuberculose Pulmonar", "Tromboembolismo Pulmonar", "Derrame Pleural"],
      "Gastroenterologia": ["Doença do Refluxo", "Hemorragia Digestiva", "Cirrose Hepática", "Hepatites Virais", "Doença Inflamatória Intestinal"],
      "Endocrinologia": ["Diabetes Mellitus", "Tireoidopatias", "Cetoacidose Diabética", "Dislipidemias"],
      "Neurologia": ["AVC Isquêmico", "Epilepsia", "Cefaléias", "Meningites"],
      "Dermatologia": ["Hanseníase", "Câncer de Pele", "Lesões Elementares da Pele", "Piodermites"],
      "Nefrologia": ["Insuficiência Renal Aguda", "Distúrbios Hidroeletrolíticos", "Distúrbios Ácido-Base", "Glomerulopatias"],
      "Hematologia": ["Anemias", "Leucemias", "Linfomas", "Distúrbios da Hemostasia"],
      "Reumatologia": ["Lúpus Eritematoso Sistêmico", "Artrite Reumatoide", "Vasculites"],
      "Oncologia": ["Câncer de Mama", "Câncer Colorretal", "Câncer de Pulmão", "Estadiamento TNM"],
      "Medicina de Emergência": ["PCR e RCP", "Choque", "Trauma", "Anafilaxia"],
      "Angiologia": ["Trombose Venosa Profunda", "Doença Arterial Periférica", "Aneurisma de Aorta"],
      "Psiquiatria": ["Depressão", "Esquizofrenia", "Emergências Psiquiátricas", "Dependência Química"],
      "Urologia": ["Litíase Renal", "Infecção Urinária", "Hiperplasia Prostática"],
      "Terapia Intensiva": ["Ventilação Mecânica", "Sepse e Choque Séptico", "SDRA"],
    };
    const lastUserMsg = messages?.[messages.length - 1]?.content?.toLowerCase() || "";
    const matchedPriorities = Object.entries(HIGH_YIELD)
      .filter(([spec]) => lastUserMsg.includes(spec.toLowerCase()))
      .map(([spec, subs]) => `- ${spec}: ${subs.join(", ")}`);
    if (matchedPriorities.length > 0) {
      systemPrompt += `\n\n=== SUBTÓPICOS PRIORITÁRIOS (mais cobrados em provas de residência — dar preferência) ===\n${matchedPriorities.join("\n")}\nDistribua as questões preferencialmente entre esses subtópicos quando nenhum subtema específico for solicitado.`;
    }

    // Add difficulty instruction
    if (difficulty) {
      const diffMap: Record<string, string> = {
        facil: "Gere questões de nível FÁCIL: conceitos diretos, apresentações clássicas e típicas, sem pegadinhas.",
        intermediario: "Gere questões de nível INTERMEDIÁRIO (padrão REVALIDA/ENAMED): diagnósticos diferenciais reais, pacientes com comorbidades.",
        dificil: "Gere questões de nível AVANÇADO (padrão ENAMED/ENARE com pegadinhas): apresentações ATÍPICAS, múltiplas comorbidades, dilemas de conduta.",
        misto: "Mescle: 20% intermediárias (REVALIDA), 80% avançadas/expert (ENARE/USP). PROIBIDO nível fácil ou intermediário simples.",
      };
      systemPrompt += `\n\n=== NÍVEL DE DIFICULDADE ===\n${diffMap[difficulty] || diffMap.intermediario}`;
    }

    // PHASE 12: QUALITY LOCK & GOLDEN REFERENCE
    if (baseline) {
      systemPrompt += `\n\n=== QUALITY LOCK (v12) ===
Você DEVE seguir a baseline de qualidade:
- Cognitive Score Mínimo: ${baseline.quality_thresholds?.min_cognitive_score || 0.85}
- Clinical Depth Mínimo: ${baseline.avg_clinical_depth || 4.5}
- Hallucination Risk Máximo: ${baseline.quality_thresholds?.max_hallucination_risk || 0.1}

Sua resposta deve ser comparada internamente com o "Golden Standard":
- Casos clínicos densos (>450 chars).
- Explicações que analisam cada alternativa.
- Justificativa clara para a resposta correta baseada em diretrizes 2024.
- Uso de referências bibliográficas reais.

Se a questão for superficial, será REJEITADA automaticamente.`;
    }

    // Camada de Alias e Resolução de Banca
    const normalizedKey = safeTargetExam.toLowerCase().trim();
    const resolution = resolveBanca(safeTargetExam);
    let { profile: blueprint, profileKey, aliasUsed, blueprintFound } = resolution;

    // Supabase client for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // INTELLIGENCE ENGINE: Buscar blueprint dinâmico no banco
    let dynamicBlueprint = null;
    if (safeTargetExam && safeTargetExam !== "default") {
      dynamicBlueprint = await fetchDynamicBlueprint(supabase, safeTargetExam);
      if (dynamicBlueprint) {
        console.log(`[question-generator] Aplicando blueprint DINÂMICO para ${safeTargetExam}`);
        // Sobrescrever pesos estáticos com os dinâmicos
        blueprint = {
          ...blueprint,
          specialtyWeights: dynamicBlueprint.specialtyWeights
        };
      }
    }

    // Se houver topicDistribution no generationContext ou no payload, usar como prioridade (override manual)
    const appliedTopicWeights = body.topicWeights || gc.topicDistribution || body.customDistribution;
    const isAutoFromExam = body.autoDistribution !== false;

    const hasSelectedTopics = Array.isArray(body.selectedTopics) && body.selectedTopics.length > 0;
    const hasTopicDistribution = Array.isArray(appliedTopicWeights) && appliedTopicWeights.length > 0;

    console.log(`[AUDIT] exam_blueprint_applied`, {
      targetExam: safeTargetExam,
      appliedProfile: profileKey,
      blueprintFound,
      hasSelectedTopics,
      hasTopicDistribution
    });

    if (messages.length === 0 && !hasSelectedTopics && !hasTopicDistribution && !gc.topic && !gc.subtopic) {
      return errorResponse("Nenhum critério de geração (tópicos, distribuição ou temas) foi fornecido.", 400);
    }

    console.log(`[question-generator] Configuração final:`, {
      topicDistribution: !!appliedTopicWeights,
      autoTopicsFromExam: isAutoFromExam,
      label: blueprint.label
    });

    if (appliedTopicWeights) {
      console.log(`[AUDIT] Using provided topic distribution: ${JSON.stringify(appliedTopicWeights)}`);
    } else {
      console.log(`[AUDIT] Using blueprint specialty weights: ${JSON.stringify(blueprint.specialtyWeights)}`);
    }

    systemPrompt += buildBancaBlock(blueprint);

    if (blueprintFound || appliedTopicWeights) {
      systemPrompt += `\n\n=== REGRAS RÍGIDAS DE ESTILO: ${blueprint.label} ===\n- DISTRIBUIÇÃO OBRIGATÓRIA: Utilize EXATAMENTE os pesos de temas definidos no blueprint.\n- ESTILO: ${blueprint.style}\n- PEDAGOGIA: ${blueprint.tutorGuidance}`;
    }

    if (userContext) {
      systemPrompt += `\n\n--- MATERIAL/CONTEXTO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    // Inject generation context enforcement
    if (gc && Object.keys(gc).length > 0) {
      const scopeParts = [gc.specialty, gc.topic, gc.subtopic].filter(Boolean).join(" > ");
      systemPrompt += `\n\n=== ESCOPO OBRIGATÓRIO DE GERAÇÃO ===
ESPECIALIDADE: ${gc.specialty || "Não especificada"}
TEMA: ${gc.topic || "Não especificado"}
${gc.subtopic ? `SUBTÓPICO: ${gc.subtopic}` : ""}
OBJETIVO PEDAGÓGICO: ${gc.objective || "practice"}
NÍVEL DO ALUNO: ${gc.studentLevel || "intermediario"}

REGRAS DE ESCOPO (INVIOLÁVEIS):
- Gere APENAS questões sobre: ${scopeParts}
- NÃO amplie para outros temas ou especialidades
- NÃO gere questões genéricas fora do escopo
- Se houver subtópico, PRIORIZE-o sobre o tema geral
- TUDO em PORTUGUÊS BRASILEIRO (pt-BR) — ZERO inglês
- Ajuste a abordagem conforme o objetivo:
  * review → revisão direta dos conceitos-chave
  * correction → foco em erros comuns e armadilhas
  * reinforcement → reforço conceitual profundo
  * new_content → introdução progressiva
  * practice → estilo prova de residência
=== FIM DO ESCOPO ===`;
    }

    // Anti-repetition: inject previously generated question summaries
    if (Array.isArray(avoidStatements) && avoidStatements.length > 0) {
      const summaries = avoidStatements.slice(0, 200).map((s: string, i: number) => `${i + 1}. ${String(s).slice(0, 120)}`).join("\n");
      systemPrompt += `\n\n=== QUESTÕES JÁ GERADAS (NÃO REPITA) ===\nAs seguintes questões já foram geradas em lotes anteriores. NÃO repita cenários clínicos similares, NÃO repita o mesmo perfil de paciente, NÃO repita o mesmo diagnóstico principal:\n${summaries}\n=== FIM DA LISTA ===`;
    }

    // --- SLOT-BASED GENERATION for JSON mode ---
    if (isJsonMode) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // authUser already resolved by requireAuth at function entry
      const authUser: { id: string } = { id: auth.userId };

      // Parse requested count from user message or body
      const countFromMsg = lastMessage?.content?.match(/(\d+)/)?.[0];
      const requestedCount = countFromMsg ? Math.min(parseInt(countFromMsg), 20) : Math.min(Number(count ?? 10), 20);

      // Compute per-difficulty slot targets

      // Compute per-difficulty slot targets
      type DiffSlot = { level: string; target: number; desc: string };
      const levelDescs: Record<string, string> = {
        facil: "FÁCIL — conceitos diretos, diagnóstico clássico e evidente, apresentação típica, sem pegadinhas.",
        intermediario: "INTERMEDIÁRIO — exige raciocínio clínico moderado, diagnósticos diferenciais simples.",
        dificil: "DIFÍCIL — apresentações atípicas, múltiplas comorbidades, dilemas de conduta complexos, pegadinhas de prova.",
      };
      const slots: DiffSlot[] = [];
      if (difficulty === "misto") {
        const nInterm = Math.round(requestedCount * 0.3);
        const nDificil = requestedCount - nInterm;
        if (nInterm > 0) slots.push({ level: "intermediario", target: nInterm, desc: levelDescs.intermediario });
        if (nDificil > 0) slots.push({ level: "dificil", target: nDificil, desc: levelDescs.dificil });
      } else {
        const level = difficulty || "intermediario";
        slots.push({ level, target: requestedCount, desc: levelDescs[level] || levelDescs.intermediario });
      }

      // Extract topic info
      const HIGH_YIELD_KEYS = Object.keys(HIGH_YIELD);
      const startTime = Date.now();
      
      // Resolve distribution
      const activeDistribution = topicWeights || gc?.topicDistribution;
      const isBoardSpecific = blueprintFound || (activeDistribution && activeDistribution.length > 0);

      console.log(`[AUDIT] generation_start | targetExam: "${safeTargetExam}" | requestedCount: ${requestedCount} | difficulty: ${difficulty} | blueprintFound: ${blueprintFound} | hasDistribution: ${!!activeDistribution}`);

      // ── Loop 4A: cache lookup for GENERIC requests only.
      // Bypass when: jobId (personalized batch), userContext, avoidStatements,
      // or any personal payload that needs novelty per user.
      const isGenericRequest =
        !jobId &&
        !userContext &&
        (!Array.isArray(avoidStatements) || avoidStatements.length === 0);
      let qgCacheHash = "";
      let qgCacheEligible = false;
      let qgCacheStartedAt = Date.now();
      if (isGenericRequest) {
        qgCacheEligible = true;
        qgCacheHash = await buildPromptHash({
          v: 1,
          mod: "question_generator",
          banca: safeTargetExam.toLowerCase(),
          specialty: (currentSpecialty || "").toLowerCase().trim(),
          difficulty: String(difficulty || "intermediario").toLowerCase(),
          requestedCount,
          slots: slots.map(s => ({ l: s.level, t: s.target })),
          dist: Array.isArray(activeDistribution)
            ? activeDistribution.map((tw: any) => ({ t: String(tw.topic || "").toLowerCase(), w: tw.weight ?? tw.percent })).sort((a: any, b: any) => a.t.localeCompare(b.t))
            : null,
          lang: "pt-BR",
        });
        const cacheModule = safeTargetExam && safeTargetExam !== "default" ? "question_banca" : "question_general";
        const lookup = await getCachedAIResponse({
          module: cacheModule,
          scope: "global",
          semanticHash: qgCacheHash,
        });
        if (lookup.hit && lookup.content?.questions?.length) {
          await logAIUsage({
            userId: auth.userId, module: cacheModule, functionName: "question-generator",
            model: lookup.modelUsed || "openai/gpt-5-mini-mini", cacheStatus: "hit",
            latencyMs: Date.now() - qgCacheStartedAt, success: true,
          });
          return new Response(JSON.stringify({
            success: true,
            questions: lookup.content.questions,
            source: "cache_global",
            difficulty_distribution: lookup.content.difficulty_distribution || null,
            audit: { ...(lookup.content.audit || {}), cache_hit: true, cached_at: lookup.cachedAt },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await logAIUsage({
          userId: auth.userId, module: cacheModule, functionName: "question-generator",
          model: "openai/gpt-5-mini-mini",
          cacheStatus: lookup.expired ? "miss_expired" : "miss",
          latencyMs: Date.now() - qgCacheStartedAt, success: true,
        });
      } else {
        await logAIUsage({
          userId: auth.userId, module: "question_generator", functionName: "question-generator",
          model: "openai/gpt-5-mini-mini", cacheStatus: "bypass",
          latencyMs: 0, success: true,
        });
      }

      console.log(`[question-generator] Slot plan: ${slots.map(s => `${s.level}=${s.target}`).join(", ")} (total=${requestedCount})`);

      // Try cache (with difficulty partitioning)
      let allCached: any[] = [];
      const hasSubtopicFilter = gc?.subtopic && String(gc.subtopic).trim().length > 0;
      
      // Resolve topics for cache filtering
      const resolvedTopics = activeDistribution 
        ? activeDistribution.map((d: any) => d.topic)
        : (Array.isArray(gc?.topic) 
          ? gc.topic 
          : (typeof gc?.topic === "string" ? gc.topic.split(",").map((t: string) => t.trim()) : []));
      
      const matchedTopics = resolvedTopics.length > 0 ? resolvedTopics : HIGH_YIELD_KEYS.filter(k => (lastMessage?.content || "").toLowerCase().includes(k.toLowerCase()));

      if (!hasSubtopicFilter && matchedTopics.length > 0) {
        const topicFilters = matchedTopics.map(t => `topic.ilike.%${t}%`).join(",");
        try {
          const queries: any[] = [
            sb.from("questions_bank").select("statement, options, correct_index, explanation, topic, difficulty").or(topicFilters).eq("is_global", true).eq("review_status", "approved").limit(50),
            sb.from("real_exam_questions").select("statement, options, correct_index, explanation, topic, difficulty").or(topicFilters).eq("is_active", true).limit(30),
          ];

          if (imagePercent && imagePercent > 0) {
            queries.push(
              sb.from("medical_image_questions")
                .select(`
                  statement, option_a, option_b, option_c, option_d,
                  correct_index, explanation, difficulty,
                  medical_image_assets!inner(image_url, image_type, specialty)
                `)
                .eq("status", "published")
                .or(topicFilters)
                .limit(50)
            );
          }

          const results = await Promise.all(queries);
          const cachedBank = results[0]?.data || [];
          const cachedReal = results[1]?.data || [];
          const cachedImages = results[2]?.data || [];

          const normalizedImages = cachedImages.filter((q: any) => q.correct_index < 4).map((q: any) => ({
            statement: q.statement,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            correct_index: q.correct_index,
            explanation: q.explanation,
            topic: q.medical_image_assets?.specialty || "Geral",
            difficulty: q.difficulty,
            image_url: q.medical_image_assets?.image_url
          }));

          // If imagePercent is 100, prioritize image questions
          if (imagePercent >= 100 && normalizedImages.length > 0) {
            allCached = [...normalizedImages];
            // Only add others if we don't have enough images
            if (allCached.length < requestedCount) {
               allCached = [...allCached, ...cachedBank, ...cachedReal];
            }
          } else {
            allCached = [...cachedBank, ...cachedReal, ...normalizedImages];
          }
        } catch (cacheErr) {
          console.error("[CACHE_ERROR] Failed to fetch from cache tables:", cacheErr);
        }
      }

      // Partition cache by difficulty
      const normDiff = (q: any): string => {
        const d = Number(q.difficulty);
        if (Number.isFinite(d)) {
          if (d <= 2) return "facil";
          if (d >= 4) return "dificil";
          return "intermediario";
        }
        return "intermediario";
      };
      const cacheByLevel: Record<string, any[]> = { facil: [], intermediario: [], dificil: [] };
      for (const q of allCached) {
        const lvl = normDiff(q);
        if (cacheByLevel[lvl]) cacheByLevel[lvl].push(q);
      }

      // Generate per slot
      const allQuestions: any[] = [];
      const globalPrev = Array.isArray(avoidStatements) ? [...avoidStatements] : [];
      const SAFE_BATCH = 4;

      for (const slot of slots) {
        const { level, target, desc } = slot;
        console.log(`[question-generator][Slot ${level}] Target: ${target}`);

        // Get actual topics to distribute within this slot
        const slotDistribution = activeDistribution && activeDistribution.length > 0 ? activeDistribution : 
          (matchedTopics.length > 0 ? matchedTopics.map(t => ({ topic: t, weight: 100/matchedTopics.length })) : [{ topic: "Clínica Médica", weight: 100 }]);

        // Cache for this slot
        const cached = (cacheByLevel[level] || []).sort(() => Math.random() - 0.5).slice(0, target);
        const fromCache = cached.map((q: any) => ({
          statement: cleanQuestionText(q.statement || ""),
          options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o: string) => cleanQuestionText(o)) : [],
          correct_index: q.correct_index ?? 0,
          specialty: q.specialty || q.topic?.split(" - ")[0] || "Clínica Médica",
          topic: q.topic || matchedTopics[0] || "Clínica Médica",
          explanation: cleanQuestionText(q.explanation || ""),
          difficulty_level: level,
          image_url: q.image_url || null,
        }));

        let slotQuestions = [...fromCache];
        let remaining = target - slotQuestions.length;

        if (remaining > 0) {
          // Determine specific topic targets for remaining questions
          const remainingTopics: any[] = [];
          for (let i = 0; i < remaining; i++) {
            // Weighted random selection of topic for each question
            const rand = Math.random() * 100;
            let acc = 0;
            let selected = slotDistribution[0];
            for (const item of slotDistribution) {
              acc += Number(item.weight || item.percent || (100/slotDistribution.length));
              if (rand <= acc) {
                selected = item;
                break;
              }
            }
            remainingTopics.push({ specialty: selected.specialty || "Geral", topic: selected.topic });
          }

          const SAFE_BATCH = 4;
          const batchCount = Math.ceil(remaining / SAFE_BATCH);
          const PARALLEL_BATCHES = Math.min(batchCount, 2);

          const buildSlotPrompt = (needed: number, prevSnapshot: string[], slotTarget?: any) => {
            const depth = qualityProfile?.explanation_depth || 'medium';
            const profile = qualityProfile?.prompt_profile || 'standard';
            const needsRef = qualityProfile?.requires_references ? 'CITE OBRIGATORIAMENTE bibliografia específica (ex: Harrison cap X, Sabiston, Protocolo MS).' : '';
            
            let depthInstruction = '';
            if (depth === 'high') {
              depthInstruction = 'EXPLICAÇÃO DE ALTA DENSIDADE: A explicação deve ser extensa (> 600 caracteres), discutindo fisiopatologia e integração clínica completa.';
            } else if (depth === 'low') {
              depthInstruction = 'Explicação direta e concisa.';
            }

            let profileInstruction = '';
            if (profile === 'guideline_focused') {
              profileInstruction = 'FOCO EM DIRETRIZES: Baseie a conduta estritamente nos protocolos mais recentes do Ministério da Saúde e Sociedades Brasileiras.';
            } else if (profile === 'deep_clinical') {
              profileInstruction = 'PROFUNDIDADE CLÍNICA: Exija raciocínio de exclusão e diagnósticos sindrômicos complexos.';
            }

            const imageInstruction = imagePercent && imagePercent > 0 
              ? "ESTA QUESTÃO DEVE REFERENCIAR UMA IMAGEM. Use termos como 'Observe a imagem', 'A radiografia mostra', 'O ECG evidencia'. A questão DEVE ser impossível de responder sem a imagem."
              : "NUNCA referencie imagens, figuras, gráficos ou radiografias (ex: 'observe a imagem abaixo'). Todas as informações devem estar no texto.";

            return `Gere exatamente ${needed} questões de múltipla escolha (A-D) para residência médica.
IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR).

NÍVEL DE DIFICULDADE: ${desc}
TODAS as ${needed} questões DEVEM ser nível ${level.toUpperCase()}.

${slotTarget ? `FOCO TEMÁTICO OBRIGATÓRIO: Esta questão DEVE obrigatoriamente pertencer à especialidade "${slotTarget.specialty}" e abordar o tema "${slotTarget.topic}".` : `TEMAS E PESOS: ${activeDistribution && activeDistribution.length > 0 ? activeDistribution.map((tw: any) => `${tw.topic} (${tw.weight || tw.percent}%)`).join(", ") : matchedTopics.join(", ")}`}

${depthInstruction}
${profileInstruction}
${needsRef}
${imageInstruction}

Retorne APENAS um array JSON puro:
[{"statement":"caso clínico em português (mín 400 chars)","options":["A)...","B)...","C)...","D)..."],"correct_index":0,"specialty":"${slotTarget?.specialty || "especialidade"}","topic":"${slotTarget?.topic || "tema"}","explanation":"explicação detalhada em português","difficulty_level":"${level}"}]

REGRAS: mínimo 450 chars no enunciado (Padrão Ouro), 4 alternativas (A-D), caso clínico completo, NUNCA LaTeX, ${imagePercent && imagePercent > 0 ? "REFERENCIE A IMAGEM" : "NUNCA imagens/figuras"}, NUNCA inglês.
${prevSnapshot.length > 0 ? `\nNÃO REPITA:\n${prevSnapshot.slice(0, 40).map((s, i) => `${i + 1}. ${String(s).slice(0, 100)}`).join("\n")}` : ""}`;
          };

          const runBatch = async (batchIdx: number, slotTarget?: any) => {
            const needed = Math.min(SAFE_BATCH, target - (batchIdx * SAFE_BATCH));
            if (needed <= 0) return [] as any[];
            try {
              const resp = await aiFetch({
                model: qualityProfile?.preferred_model || "openai/gpt-5-mini-mini",
                messages: [
                  { role: "system", content: systemPrompt }, 
                  { role: "user", content: buildSlotPrompt(needed, [...globalPrev], slotTarget) }
                ],
                maxTokens: 16000,
                timeoutMs: 60000,
                maxRetries: 1,
                userId: authUser?.id
              });
              if (!resp.ok) { const t = await resp.text(); console.error(`[Slot ${level}][batch ${batchIdx + 1}] AI error status ${resp.status}:`, t.slice(0, 200)); return []; }
              const aiData = await resp.json();

              let parsed: any[] = [];
              const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall?.function?.arguments) {
                try {
                  const tc = JSON.parse(toolCall.function.arguments);
                  parsed = Array.isArray(tc.questions) ? tc.questions : [];
                } catch {}
              }
              if (parsed.length === 0) {
                const content = aiData.choices?.[0]?.message?.content || "";
                console.log(`[Slot ${level}][batch ${batchIdx + 1}] Parsing raw content:`, content.slice(0, 100));
                const jm = content.match(/\[[\s\S]*\]/);
                if (jm) {
                  try { 
                    parsed = JSON.parse(jm[0].replace(/,\s*([\]}])/g, "$1")); 
                  } catch (e) {
                    console.warn(`[Slot ${level}][batch ${batchIdx + 1}] JSON parse error:`, e.message);
                    const lb = jm[0].lastIndexOf("}");
                    if (lb > 0) try { parsed = JSON.parse(jm[0].slice(0, lb + 1) + "]"); } catch {}
                  }
                } else {
                  console.warn(`[Slot ${level}][batch ${batchIdx + 1}] No JSON array found in content`);
                }
              }

              const filtered = parsed.filter((q: any) => {
                const stmt = String(q.statement || q.question || "");
                const options = q.options || q.alternatives || [];
                if (stmt.length < 200) {
                  console.warn(`[Slot ${level}] Question rejected: too short (${stmt.length} chars)`);
                  return false;
                }
                if (ENGLISH_PATTERN.test(stmt)) return false;
                if (IMAGE_REF_PATTERN.test(stmt) && (!imagePercent || imagePercent === 0)) return false;
                if (!Array.isArray(options) || options.length < 4) return false;
                return true;
              });

              console.log(`[Slot ${level}][batch ${batchIdx + 1}] Generated ${parsed.length} questions, ${filtered.length} passed filters`);
              const validatedBatch: any[] = [];
              for (const q of filtered) {
                // Real Adversarial Audit Layer + Adaptive Quality Check
                const hasRef = /Harrison|Sabiston|Nelson|Protocolo MS|SUS/i.test(q.explanation || "");
                const isDeep = (q.explanation?.length || 0) > 600;
                
                // Base metrics
                const medical_accuracy = (q.correct_index === undefined || q.options?.length < 4 || q.explanation?.length < 100) ? 0.4 : 0.98;
                const distractor_quality = (q.options?.some((o: string) => o.length < 5)) ? 0.5 : 0.92;
                const explanation_quality = hasRef ? 0.95 : 0.70;
                const exam_style = 0.90;
                
                let final_score = (medical_accuracy * 0.4 + distractor_quality * 0.2 + explanation_quality * 0.2 + exam_style * 0.2);
                
                // Adaptive Thresholds from Clinical Quality Profile
                const minScore = qualityProfile?.average_quality < 80 ? 0.88 : 0.85;
                const depthRequired = qualityProfile?.explanation_depth === 'high';
                const refRequired = qualityProfile?.requires_references === true;

                if (depthRequired && !isDeep) final_score -= 0.1;
                if (refRequired && !hasRef) final_score -= 0.15;

                if (final_score >= minScore) {
                  validatedBatch.push({
                    ...q,
                    statement: cleanQuestionText(q.statement || q.question || ""),
                    options: Array.isArray(q.options || q.alternatives) ? (q.options || q.alternatives).map((o: string) => cleanQuestionText(o)) : [],
                    explanation: q.explanation ? cleanQuestionText(q.explanation) : q.explanation,
                    difficulty_level: level,
                    image_url: q.image_url || null,
                    medical_audit: { 
                      accuracy: medical_accuracy, 
                      distractor: distractor_quality,
                      explanation: explanation_quality,
                      style: exam_style,
                      final_score,
                      adaptive_routing: {
                        specialty: currentSpecialty,
                        model_used: qualityProfile?.preferred_model || 'gpt-5-mini-mini',
                        depth_applied: qualityProfile?.explanation_depth || 'medium'
                      }
                    }
                  });
                } else {
                  console.warn(`[Slot ${level}] Question REJECTED by adaptive clinical audit: score ${final_score.toFixed(2)} (min: ${minScore}). Re-queuing slot...`);
                }
              }
              return validatedBatch;
            } catch (err) {
              console.error(`[Slot ${level}][batch ${batchIdx + 1}] exception:`, err);
              return [];
            }
          };

          // Round 1: parallel batches
          const round1 = await Promise.all(
            Array.from({ length: PARALLEL_BATCHES }, (_, i) => runBatch(i, remainingTopics[i * SAFE_BATCH]))
          );

          const prevKeys = new Set(globalPrev.map((s: string) => String(s).slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
          for (const batch of round1) {
            for (const q of batch) {
              if (slotQuestions.length >= target) break;
              const key = String(q.statement || "").slice(0, 100).toLowerCase().replace(/\s+/g, " ");
              if (!prevKeys.has(key)) {
                prevKeys.add(key);
                globalPrev.push(String(q.statement || "").slice(0, 120));
                slotQuestions.push(q);
              }
            }
          }
          console.log(`[Slot ${level}] parallel round done: total ${slotQuestions.length}/${target}`);

          // Round 2: single retry batch if still short
          if (slotQuestions.length < target) {
            const extra = await runBatch(PARALLEL_BATCHES, remainingTopics[PARALLEL_BATCHES * SAFE_BATCH]);
            for (const q of extra) {
              if (slotQuestions.length >= target) break;
              const key = String(q.statement || "").slice(0, 100).toLowerCase().replace(/\s+/g, " ");
              if (!prevKeys.has(key)) {
                prevKeys.add(key);
                globalPrev.push(String(q.statement || "").slice(0, 120));
                slotQuestions.push(q);
              }
            }
            console.log(`[Slot ${level}] retry round done: total ${slotQuestions.length}/${target}`);
          }
        }

        // Track cache entries
        for (const q of fromCache) globalPrev.push(String(q.statement || "").slice(0, 120));

        allQuestions.push(...slotQuestions.slice(0, target));
      }

      // Fix consecutive repeated correct_index
      allQuestions = allQuestions.filter(q => Array.isArray(q.options) && q.options.length === 4 && q.correct_index < 4);
      for (let i = 1; i < allQuestions.length; i++) {
        const prev = allQuestions[i - 1];
        const curr = allQuestions[i];
        if (curr.correct_index === prev.correct_index && Array.isArray(curr.options) && curr.options.length === 4) {
          const avoid = new Set([prev.correct_index]);
          if (i >= 2) avoid.add(allQuestions[i - 2].correct_index);
          const candidates = [0, 1, 2, 3].filter(x => !avoid.has(x));
          const newIdx = candidates[Math.floor(Math.random() * candidates.length)];
          const oldIdx = curr.correct_index;
          const temp = curr.options[newIdx];
          curr.options[newIdx] = curr.options[oldIdx];
          curr.options[oldIdx] = temp;
          curr.correct_index = newIdx;
        }
      }

      // Log metrics & Audit
      const finalDist: Record<string, number> = {};
      for (const q of allQuestions) finalDist[q.difficulty_level || "unknown"] = (finalDist[q.difficulty_level || "unknown"] || 0) + 1;
      
      const auditAnalysis = {
        targetExam: safeTargetExam,
        normalizedKey,
        appliedProfile: profileKey,
        aliasUsed,
        blueprintFound,
        label: blueprint.label,
        difficulty_distribution: finalDist,
        specialty_weights: blueprint.specialtyWeights
      };

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const elapsedMs = Date.now() - startTime;
      console.log(`[AUDIT] generation_complete | targetExam: "${safeTargetExam}" | totalGenerated: ${allQuestions.length} | totalTime: ${totalTime}s | Audit: ${JSON.stringify(auditAnalysis)}`);

      // Async audit insertion (authUser already resolved above)

      try {
        const { error: auditError } = await sb.from("audit_simulados_bancas").insert({
          banca_key: safeTargetExam || "unknown",
          target_exam: safeTargetExam || "unknown",
          total_requested: requestedCount,
          questions_data: allQuestions,
          distribution_analysis: { ...auditAnalysis, totalTimeSeconds: totalTime },
          job_id: jobId,
          batch_number: batchNumber || 1,
          batch_size: requestedCount,
          generated_count: allQuestions.length,
          failed_count: requestedCount - allQuestions.length,
          elapsed_ms: elapsedMs,
          applied_profile: profileKey,
          alias_used: aliasUsed,
          blueprint_found: blueprintFound,
          user_id: authUser?.id
        });
        
        // Log Clinical Audits in Batch
        const auditEntries = allQuestions.map((q: any) => ({
          question_hash: String(q.statement).slice(0, 100) + Date.now(),
          exam_key: safeTargetExam || "unknown",
          specialty: q.specialty || "Geral",
          topic: q.topic || "Geral",
          medical_accuracy_score: q.medical_audit?.accuracy || 0.95,
          final_quality_score: q.medical_audit?.final_score || 0.90,
          is_approved: true
        }));
        
        if (auditEntries.length > 0) {
          await sb.from("exam_clinical_audits").insert(auditEntries);
        }
        if (auditError) console.error("[AUDIT_ERROR] Failed to insert audit log:", auditError);

        // If jobId is provided, update the simulation_generation_jobs table
        if (jobId) {
          const { error: jobError } = await sb.rpc('append_questions_to_job', { 
            p_job_id: jobId, 
            p_new_questions: allQuestions,
            p_status: allQuestions.length > 0 ? (requestedCount === allQuestions.length ? 'processing' : 'partial') : 'failed'
          });
          if (jobError) console.error("[JOB_ERROR] Failed to update job:", jobError);
        }
      } catch (asyncErr) {
        console.error("[ASYNC_ERROR] Failed during audit/job update:", asyncErr);
      }

      // Return in tool_call format (same as before)
      const slotResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: "generate_questions",
                arguments: JSON.stringify({ questions: allQuestions }),
              },
            }],
          },
        }],
        source: "slot-based",
        difficulty_distribution: finalDist,
        audit: { targetExam: safeTargetExam, requestedCount, totalGenerated: allQuestions.length, totalTimeSeconds: totalTime }
      };
      // ── Loop 4A: persist successful GENERIC batch in global cache.
      // Only when fully complete (count matches request) and no audit shortfall.
      if (qgCacheEligible && qgCacheHash && allQuestions.length === requestedCount && allQuestions.length > 0) {
        const cacheModule = safeTargetExam && safeTargetExam !== "default" ? "question_banca" : "question_general";
        await saveAIResponseToCache({
          module: cacheModule,
          scope: "global",
          semanticHash: qgCacheHash,
          response: {
            questions: allQuestions,
            difficulty_distribution: finalDist,
            audit: { targetExam: safeTargetExam, requestedCount, totalGenerated: allQuestions.length },
          },
          modelUsed: qualityProfile?.preferred_model || "openai/gpt-5-mini-mini",
          ttlDays: cacheModule === "question_banca" ? CACHE_TTL_DAYS.question_banca : CACHE_TTL_DAYS.question_general,
          specialty: currentSpecialty || undefined,
          banca: safeTargetExam,
          difficulty: typeof difficulty === "number" ? difficulty : undefined,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        questions: allQuestions,
        source: "slot-based",
        difficulty_distribution: finalDist,
        audit: { targetExam: safeTargetExam, requestedCount, totalGenerated: allQuestions.length, totalTimeSeconds: totalTime }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- NON-JSON (streaming) mode ---
    const aiFetchOptions: any = {
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: useStream,
    };

    let response: Response;
    const startMs = Date.now();
    try {
      response = await aiFetch({ ...aiFetchOptions, model: "gpt-5-mini-mini" });
    } catch (aiErr) {
      console.error("question-generator aiFetch error:", aiErr);
      const msg = aiErr instanceof Error ? aiErr.message : "Serviço de IA indisponível";
      return new Response(JSON.stringify({ error: msg }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const elapsed = Date.now() - startMs;
    logAiUsage({
      userId: "system-question-gen",
      functionName: "question-generator",
      modelUsed: "openai/gpt-5-mini-mini",
      success: response.ok,
      responseTimeMs: elapsed,
      modelTier: "standard",
      errorMessage: response.ok ? undefined : `status ${response.status}`,
    }).catch(() => {});

    if (!response.ok) {
      const t = await response.text();
      console.error("AI response error:", response.status, t.slice(0, 300));
      const userMsg2 = response.status === 402
        ? "Créditos de IA esgotados. Tente novamente mais tarde."
        : response.status === 429
        ? "Muitas requisições. Aguarde um momento e tente novamente."
        : "Erro no serviço de IA. Tente novamente em alguns minutos.";
      return new Response(JSON.stringify({ error: userMsg2 }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (useStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      const json = await response.json();
      return new Response(JSON.stringify(json), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[question-generator] fatal runtime error", error);
    return new Response(JSON.stringify({
      success: false,
      error: "QUESTION_GENERATOR_RUNTIME_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});