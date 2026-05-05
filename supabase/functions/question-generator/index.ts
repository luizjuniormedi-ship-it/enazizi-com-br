import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch, cleanQuestionText } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { isValidQuestion, hasMinimumContext, validateQuestionContext, logGenerationRejection, IMAGE_REF_PATTERN, ENGLISH_PATTERN } from "../_shared/question-filters.ts";
import { validateQuestionBatch } from "../_shared/ai-validation.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages, userContext, stream: clientStream, difficulty, maxRetries, timeoutMs, outputFormat, avoidStatements, generationContext, targetExam } = body;

    // Input validation: messages must be an array
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Campo 'messages' é obrigatório e deve ser um array." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default to streaming unless client explicitly sets stream=false
    const useStream = clientStream !== false;
    const safeMaxRetries = typeof maxRetries === "number" ? Math.max(0, Math.min(2, maxRetries)) : undefined;
    const safeTimeoutMs = typeof timeoutMs === "number" ? Math.max(8000, Math.min(120000, timeoutMs)) : undefined;

    const isJsonMode = outputFormat === "json";

    // Compact JSON-only system prompt for Simulados
    const jsonSystemPrompt = `Você é um gerador de questões de ELITE para Residência Médica brasileira (ENARE, USP, UNIFESP, Revalida, Santa Casa, UERJ, SUS-SP).

IDIOMA OBRIGATÓRIO: TUDO deve ser escrito em PORTUGUÊS BRASILEIRO. NUNCA use inglês.

NÍVEL DE DIFICULDADE: RESIDÊNCIA MÉDICA (ALTO)
- As questões devem ter o nível das provas ENARE, USP-SP e UNIFESP (as mais difíceis do Brasil)
- Exigir raciocínio clínico avançado: diagnóstico diferencial complexo, interpretação de exames com valores limítrofes, condutas baseadas em guidelines atuais
- Distratores devem explorar armadilhas clássicas de provas de residência (ex: conduta em gestante vs não-gestante, contraindicações sutis, diagnósticos que se confundem)
- Incluir questões que exijam integração de múltiplos sistemas (ex: nefropatia diabética + HAS + cardiopatia)

REGRAS:
- Responda APENAS com um JSON array puro, sem markdown, sem texto extra, sem code blocks
- Cada questão DEVE ser um caso clínico COMPLEXO com: nome fictício, idade, sexo, profissão, queixa principal com tempo de evolução, antecedentes pessoais e medicações, exame físico com sinais vitais COMPLETOS (PA, FC, FR, Temp, SpO2), exames complementares com VALORES NUMÉRICOS e unidades
- Mínimo 400 caracteres no enunciado (padrão ENAMED) — questões curtas serão rejeitadas
- 5 alternativas plausíveis (a-e), todas clinicamente possíveis e com extensão similar
- Distratores baseados em erros REAIS de raciocínio clínico que candidatos cometem em provas
- Explicação detalhada analisando CADA alternativa individualmente (por que certa/errada)
- Distribua gabaritos entre as letras (não repita a mesma letra consecutivamente)
- Varie perfis de pacientes (idade, sexo, cenário: UBS, PS, enfermaria, UTI, ambulatório)
- NUNCA repita cenários clínicos similares
- NUNCA use formatação LaTeX (ex: $x$, \\times, \\%). Use texto puro: 148×90 mmHg, 38%, etc.
- NUNCA referencie imagens, figuras, gráficos ou radiografias (ex: "observe a imagem abaixo"). Todas as informações devem estar no texto.
- Cite referência bibliográfica específica (Harrison cap. X, Sabiston, Nelson, etc.)

COMPLEXIDADE EXIGIDA:
- 40% questões de diagnóstico diferencial (apresentação atípica ou sobreposta)
- 30% questões de conduta/tratamento (incluindo situações com contraindicações)
- 20% questões de interpretação de exames (ECG, gasometria, imagem, laboratório)
- 10% questões de prognóstico/complicações

PROIBIDO NO CAMPO "statement": NÃO inclua o tema, especialidade, subtema, gabarito ou qualquer metadata dentro do campo "statement". O statement deve conter APENAS o caso clínico e a pergunta final. O tema/especialidade vai SOMENTE no campo "topic".

FORMATO JSON OBRIGATÓRIO (array puro):
[
  {
    "statement": "Caso clínico complexo com dados completos terminando com a pergunta?",
    "options": ["alternativa a", "alternativa b", "alternativa c", "alternativa d", "alternativa e"],
    "correct_index": 0,
    "topic": "Especialidade - Subtema",
    "explanation": "Explicação detalhada analisando cada alternativa com referência bibliográfica..."
  }
]

Fontes: Harrison 21ª ed, Sabiston 21ª ed, Nelson 22ª ed, Williams 26ª ed, Braunwald 12ª ed, diretrizes MS/SBP/FEBRASGO/SBC 2024-2026, ATLS 10ª ed, Sepsis-3/4, KDIGO 2024, GOLD/GINA 2025, AHA/ACC/ESC 2024.`;

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
- 📝 Questões com casos clínicos (A-E) — SEM revisão prévia
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
e) [alternativa E]

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
- Distribua equilibradamente entre A, B, C, D e E`;

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
        facil: "Gere questões de nível FÁCIL: conceitos diretos, apresentações clássicas e típicas, sem pegadinhas. Foco em conhecimento básico e reconhecimento de padrões clínicos clássicos.",
        intermediario: "Gere questões de nível INTERMEDIÁRIO (padrão REVALIDA/ENAMED): diagnósticos diferenciais reais, pacientes com comorbidades.",
        dificil: "Gere questões de nível AVANÇADO (padrão ENAMED/ENARE com pegadinhas): apresentações ATÍPICAS, múltiplas comorbidades, dilemas de conduta.",
        misto: "Mescle: 50% intermediárias (REVALIDA), 50% avançadas/expert (ENAMED/ENARE). PROIBIDO nível fácil.",
      };
      systemPrompt += `\n\n=== NÍVEL DE DIFICULDADE ===\n${diffMap[difficulty] || diffMap.intermediario}`;
    }

    // Auditoria e Adaptação à Banca - REFORÇADA
    const normalizedKey = String(targetExam || "").toLowerCase().trim();
    const blueprint = getBancaProfile(normalizedKey);
    const blueprintFound = PROFILES[normalizedKey] !== undefined;

    console.log(`[AUDIT] targetExam: "${targetExam}" | key: "${normalizedKey}" | found: ${blueprintFound} | label: "${blueprint.label}"`);
    console.log(`[AUDIT] Weights: ${JSON.stringify(blueprint.specialtyWeights)}`);

    systemPrompt += buildBancaBlock(blueprint);

    if (blueprintFound) {
      systemPrompt += `\n\n=== REGRAS RÍGIDAS DE ESTILO: ${blueprint.label} ===\n- DISTRIBUIÇÃO OBRIGATÓRIA: Utilize EXATAMENTE os pesos de temas definidos no blueprint.\n- ESTILO: ${blueprint.style}\n- PEDAGOGIA: ${blueprint.tutorGuidance}`;
    }

    if (userContext) {
      systemPrompt += `\n\n--- MATERIAL/CONTEXTO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    // Inject generation context enforcement
    if (generationContext && typeof generationContext === "object") {
      const gc = generationContext;
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
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Parse requested count from user message
      const userMsg = messages?.[messages.length - 1]?.content || "";
      const countMatch = userMsg.match(/(?:gere|crie|faça|gerar)\s+(?:exatamente\s+)?(\d+)/i);
      const requestedCount = countMatch ? Math.min(parseInt(countMatch[1]), 50) : 10;

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

      console.log(`[question-generator] Slot plan: ${slots.map(s => `${s.level}=${s.target}`).join(", ")} (total=${requestedCount})`);

      // Extract topic info
      const HIGH_YIELD_KEYS = Object.keys(HIGH_YIELD);
      const matchedTopics = HIGH_YIELD_KEYS.filter(k => userMsg.toLowerCase().includes(k.toLowerCase()));
      const hasSubtopicFilter = generationContext?.subtopic && String(generationContext.subtopic).trim().length > 0;

      // Try cache (with difficulty partitioning)
      let allCached: any[] = [];
      if (!hasSubtopicFilter && matchedTopics.length > 0) {
        const topicFilters = matchedTopics.map(t => `topic.ilike.%${t}%`).join(",");
        const [{ data: cachedBank }, { data: cachedReal }] = await Promise.all([
          sb.from("questions_bank").select("statement, options, correct_index, explanation, topic, difficulty").or(topicFilters).eq("is_global", true).eq("review_status", "approved").limit(50),
          sb.from("real_exam_questions").select("statement, options, correct_index, explanation, topic, difficulty").or(topicFilters).eq("is_active", true).limit(30),
        ]);
        allCached = [...(cachedBank || []), ...(cachedReal || [])];

        // Dedup
        if (Array.isArray(avoidStatements) && avoidStatements.length > 0) {
          const prevKeys = new Set(avoidStatements.map((s: string) => String(s).slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
          allCached = allCached.filter((q: any) => !prevKeys.has(String(q.statement || "").slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
        }
        // Filter English + image refs
        allCached = allCached.filter((q: any) => {
          const stmt = String(q.statement || "");
          return !IMAGE_REF_PATTERN.test(stmt) && !ENGLISH_PATTERN.test(stmt);
        });
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
      const SAFE_BATCH = 8;

      for (const slot of slots) {
        const { level, target, desc } = slot;
        console.log(`[question-generator][Slot ${level}] Target: ${target}`);

        // Cache for this slot
        const cached = (cacheByLevel[level] || []).sort(() => Math.random() - 0.5).slice(0, target);
        const fromCache = cached.map((q: any) => ({
          statement: cleanQuestionText(q.statement || ""),
          options: Array.isArray(q.options) ? q.options.map((o: string) => cleanQuestionText(o)) : [],
          correct_index: q.correct_index ?? 0,
          topic: q.topic || matchedTopics[0] || "Clínica Médica",
          explanation: cleanQuestionText(q.explanation || ""),
          difficulty_level: level,
        }));

        let slotQuestions = [...fromCache];
        let remaining = target - slotQuestions.length;

        // AI generation for remaining
        if (remaining > 0) {
          const MAX_ATTEMPTS = Math.ceil(remaining * 2.0 / SAFE_BATCH) + 2;
          for (let attempt = 0; attempt < MAX_ATTEMPTS && slotQuestions.length < target; attempt++) {
            const needed = Math.min(SAFE_BATCH, target - slotQuestions.length);
            if (needed <= 0) break;

            const slotPrompt = `Gere exatamente ${needed} questões de múltipla escolha (A-E) para residência médica.

IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês em nenhum campo.

NÍVEL DE DIFICULDADE: ${desc}
TODAS as ${needed} questões DEVEM ser nível ${level.toUpperCase()}.

TEMAS: ${matchedTopics.length > 0 ? matchedTopics.join(", ") : (generationContext?.topic || "Clínica Médica")}

Retorne APENAS um array JSON puro:
[{"statement":"caso clínico em português (mín 400 chars)","options":["A)...","B)...","C)...","D)...","E)..."],"correct_index":0,"topic":"tema","explanation":"explicação detalhada em português","difficulty_level":"${level}"}]

REGRAS: mínimo 400 chars no enunciado, 5 alternativas, caso clínico completo, NUNCA LaTeX, NUNCA imagens/figuras, NUNCA inglês.
${globalPrev.length > 0 ? `\nNÃO REPITA:\n${globalPrev.slice(0, 40).map((s, i) => `${i + 1}. ${String(s).slice(0, 100)}`).join("\n")}` : ""}`;

            try {
              const resp = await aiFetch({
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: slotPrompt }],
                maxTokens: 32768,
                timeoutMs: 120000,
              });

              if (!resp.ok) { const t = await resp.text(); console.error(`[Slot ${level}] AI error:`, t.slice(0, 200)); continue; }
              const aiData = await resp.json();

              // Extract questions from tool call or content
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
                const jm = content.match(/\[[\s\S]*\]/);
                if (jm) {
                  try { parsed = JSON.parse(jm[0].replace(/,\s*([\]}])/g, "$1")); } catch {
                    const lb = jm[0].lastIndexOf("}");
                    if (lb > 0) try { parsed = JSON.parse(jm[0].slice(0, lb + 1) + "]"); } catch {}
                  }
                }
              }

              // Strict filter
              const valid = parsed.filter((q: any) => {
                const stmt = String(q.statement || "");
                if (stmt.length < 350) return false;
                if (ENGLISH_PATTERN.test(stmt)) { console.warn(`[Slot ${level}] Rejeitada: inglês`); return false; }
                if (IMAGE_REF_PATTERN.test(stmt)) { console.warn(`[Slot ${level}] Rejeitada: imagem`); return false; }
                if (!Array.isArray(q.options) || q.options.length < 4) return false;
                if (ENGLISH_PATTERN.test(q.options.join(" "))) { console.warn(`[Slot ${level}] Rejeitada: opções em inglês`); return false; }
                return true;
              }).map((q: any) => ({
                ...q,
                statement: cleanQuestionText(q.statement || ""),
                options: Array.isArray(q.options) ? q.options.map((o: string) => cleanQuestionText(o)) : q.options,
                explanation: q.explanation ? cleanQuestionText(q.explanation) : q.explanation,
                difficulty_level: level, // Force slot level
              }));

              // Dedup
              const prevKeys = new Set(globalPrev.map((s: string) => String(s).slice(0, 100).toLowerCase().replace(/\s+/g, " ")));
              for (const q of valid) {
                if (slotQuestions.length >= target) break;
                const key = String(q.statement || "").slice(0, 100).toLowerCase().replace(/\s+/g, " ");
                if (!prevKeys.has(key)) {
                  globalPrev.push(String(q.statement || "").slice(0, 120));
                  slotQuestions.push(q);
                }
              }
              console.log(`[Slot ${level}] batch ${attempt + 1}: total ${slotQuestions.length}/${target}`);
            } catch (err) {
              console.error(`[Slot ${level}] batch ${attempt + 1} exception:`, err);
            }
          }
        }

        // Track cache entries
        for (const q of fromCache) globalPrev.push(String(q.statement || "").slice(0, 120));

        allQuestions.push(...slotQuestions.slice(0, target));
      }

      // Fix consecutive repeated correct_index
      for (let i = 1; i < allQuestions.length; i++) {
        const prev = allQuestions[i - 1];
        const curr = allQuestions[i];
        if (curr.correct_index === prev.correct_index && Array.isArray(curr.options) && curr.options.length === 5) {
          const avoid = new Set([prev.correct_index]);
          if (i >= 2) avoid.add(allQuestions[i - 2].correct_index);
          const candidates = [0, 1, 2, 3, 4].filter(x => !avoid.has(x));
          const newIdx = candidates[Math.floor(Math.random() * candidates.length)];
          const oldIdx = curr.correct_index;
          const temp = curr.options[newIdx];
          curr.options[newIdx] = curr.options[oldIdx];
          curr.options[oldIdx] = temp;
          curr.correct_index = newIdx;
        }
      }

      // Log metrics
      const finalDist: Record<string, number> = {};
      for (const q of allQuestions) finalDist[q.difficulty_level || "unknown"] = (finalDist[q.difficulty_level || "unknown"] || 0) + 1;
      console.log(`[question-generator] RESULTADO: ${allQuestions.length}/${requestedCount} | Dist: ${JSON.stringify(finalDist)}`);

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
      };
      return new Response(JSON.stringify(slotResponse), {
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
      response = await aiFetch(aiFetchOptions);
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
      modelUsed: "openai/gpt-5-mini",
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
  } catch (e) {
    console.error("question-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});