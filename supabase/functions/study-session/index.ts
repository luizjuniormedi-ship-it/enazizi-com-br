import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getLessonPrompt,
  getCompactLessonPrompt,
  getRecallPrompt,
  getQuestionPrompt,
  getDiscussionPrompt,
  getScoringPrompt,
  getReinforcementPrompt,
  getFeynmanPrompt,
  getSessionMemoryBlock,
} from "../_shared/enazizi-prompt.ts";
import { aiFetch, getModelForTier } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { extractUserId } from "../_shared/ai-phase2-helpers.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Standard JSON response helper */
const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function getLevelPrompt(performanceData: unknown): string {
  const data = performanceData as any;
  if (!data || !data.totalQuestions || data.totalQuestions < 5) return "";
  const accuracy = data.totalQuestions > 0 ? (data.correctAnswers / data.totalQuestions) * 100 : 0;
  if (accuracy < 30) {
    return `
NÍVEL DO ALUNO: INICIANTE (taxa de acerto: ${Math.round(accuracy)}%)
- Use linguagem mais SIMPLES e acessível
- Inclua mais EXEMPLOS práticos e analogias do dia a dia
- Reduza profundidade molecular (foque nos conceitos-chave)
- Explique termos técnicos quando usá-los
- Seja mais ENCORAJADOR e motivacional`;
  }
  if (accuracy < 70) {
    return `
NÍVEL DO ALUNO: INTERMEDIÁRIO (taxa de acerto: ${Math.round(accuracy)}%)
- Equilíbrio entre teoria e prática
- Pode usar terminologia técnica com explicações pontuais
- Inclua correlações clínicas mais complexas
- Comece a introduzir pegadinhas de prova`;
  }
  return `
NÍVEL DO ALUNO: AVANÇADO (taxa de acerto: ${Math.round(accuracy)}%)
- Foque em PEGADINHAS, diagnósticos diferenciais RAROS e casos ATÍPICOS
- Use terminologia técnica sem simplificação
- Apresente discussões de conduta controversas
- Inclua detalhes moleculares e referências avançadas
- Desafie com casos de alta complexidade`;
}

function getWeakTopicsPrompt(performanceData: unknown): string {
  const data = performanceData as any;
  if (!data?.weakTopics?.length) return "";
  return `
TEMAS FRACOS DO ALUNO (reforço automático obrigatório):
${data.weakTopics.map((t: string) => `- ❌ ${t}`).join("\n")}

REGRA DE REFORÇO POR ERRO:
- Nos próximos 3-5 blocos, RETOME esses temas fracos com ENFOQUE DIFERENTE do que já foi abordado
- NUNCA ignore os temas fracos — eles devem ser intercalados com o conteúdo novo
- Ao retomar: use ângulo diferente (se errou diagnóstico → foque em conduta; se errou conduta → foque em complicações)`;
}

const STRUCTURED_SIGNAL_BLOCK = `
==================================================
SINAL ESTRUTURADO OBRIGATÓRIO (NÃO REMOVER)
==================================================
SEMPRE QUE você corrigir uma resposta objetiva do aluno (letra A–E) ou
avaliar acerto/erro de uma questão de verificação, ANEXE no FINAL da
mensagem (após todo o feedback humano) o seguinte bloco — exatamente neste
formato, em UMA ÚNICA linha de JSON, entre os marcadores HTML comments:

<!--SIGNAL-->
{"wasCorrect":true,"correctLetter":"B","detectedAnswer":"A","errorCategory":"conceitual","subtopic":"","topic":"","confidence":0.9,"feedbackShort":"","feedbackDetailed":"","shouldReinforce":true,"recommendedNextStep":"review"}
<!--/SIGNAL-->

REGRAS DO BLOCO:
- "wasCorrect" boolean (obrigatório)
- "correctLetter" letra A–E da alternativa correta
- "detectedAnswer" letra A–E que o aluno respondeu
- "errorCategory" um de: conceitual | memorizacao | interpretacao | atencao | desconhecido
- "subtopic" subtema clínico específico (ex: "tratamento da pneumonia comunitária")
- "topic" tema geral
- "confidence" sua confiança na classificação (0.0 a 1.0). Se não tiver certeza, use < 0.5 e errorCategory "desconhecido".
- "feedbackShort" 1 frase resumindo a correção
- "shouldReinforce" true se vale acionar reforço
- "recommendedNextStep" um de: review | tutor | mnemonic | image_quiz | continue

CRÍTICO:
- O bloco SIGNAL deve aparecer SOMENTE quando há correção objetiva (não em explicações teóricas).
- O texto humano acima do bloco continua livre, didático e formatado normalmente.
- O bloco DEVE ser válido JSON em uma linha. NUNCA quebre linhas dentro dele.
- NUNCA mostre o bloco como código visível para o aluno — ele é HTML comment.
`;

function getPhasePrompt(phase: string, topic: string, performanceData: unknown, studyMode?: string): string {
  const levelPrompt = getLevelPrompt(performanceData);
  const weakTopicsPrompt = getWeakTopicsPrompt(performanceData);

  switch (phase) {
    case "performance":
      return `${getDiscussionPrompt()}
FASE ATUAL: STATE 0 — PAINEL DE DESEMPENHO

Dados do aluno:
${JSON.stringify(performanceData || {}, null, 2)}

Mostre o painel organizado:
## 📊 Painel ENAZIZI
- Questões respondidas, Taxa de acerto, Pontuação discursiva
- Raciocínio clínico, Conduta terapêutica
- Nível estimado, Estimativa de preparo para residência
## 🧠 Domínio por Especialidade
## ⚠️ Temas Fracos
## 📈 Recomendação
Se não houver dados, informe e sugira começar.`;

    case "lesson": {
      if (studyMode === "compact") {
        return `${getCompactLessonPrompt()}
${levelPrompt}
FASE ATUAL: EXPLICAÇÃO RÁPIDA (MODO COMPACTO)
Tema: "${topic || "solicitado pelo aluno"}"

FORMATO OBRIGATÓRIO (300-400 palavras MÁXIMO em UMA única mensagem):

1. **🎯 O que é** (2-3 frases, estilo Feynman — como se explicasse para um leigo inteligente)
2. **⚡ Ponto-chave para prova** (o detalhe que mais cai em residência)
3. **🏥 Aplicação clínica** (caso rápido de 3 linhas mostrando quando pensar nisso)
4. **❓ Teste rápido** (1 pergunta objetiva para o aluno responder)

REGRAS:
- NÃO faça introduções longas
- NÃO use subtítulos excessivos
- Vá DIRETO ao ponto
- Linguagem clara e objetiva
- Após a resposta do aluno à pergunta: corrija brevemente e pergunte se quer aprofundar ou ir para questões`;
      }

      if (studyMode === "review") {
        return `${getRecallPrompt()}
${levelPrompt}
${weakTopicsPrompt}
FASE ATUAL: REVISÃO PARA PROVA
Tema: "${topic || "solicitado pelo aluno"}"

FORMATO OBRIGATÓRIO (uma mensagem estruturada):

## 🧠 Revisão Rápida — ${topic}

### 🎯 Top 5 pontos cobrados em residência
(lista numerada dos conceitos mais cobrados)

### ⚠️ Pegadinhas clássicas
(3-4 pegadinhas com explicação de por que o aluno erra)

### 🔀 Diagnóstico diferencial rápido
(tabela comparativa: diagnóstico vs achado-chave que diferencia)

### 💊 Conduta resumida
(tratamento de 1ª linha com dose, via, quando NÃO usar)

### ❓ Questão-teste
(1 questão objetiva A-E focada nas pegadinhas acima)

REGRAS:
- Foque no que CAI EM PROVA, não no que é bonito
- Priorize diagnósticos diferenciais e pegadinhas
- Máximo 500 palavras`;
      }

      if (studyMode === "correction") {
        return `${getReinforcementPrompt()}
${levelPrompt}
${weakTopicsPrompt}
FASE ATUAL: CORREÇÃO DE ERROS
Tema: "${topic || "solicitado pelo aluno"}"

FORMATO OBRIGATÓRIO:

## ❌ Correção Focada — ${topic}

Analise os TEMAS FRACOS do aluno listados acima e:

1. **Identifique o erro mais comum** nesse tema (conceito mal compreendido)
2. **Explique o conceito correto** de forma clara (3-4 frases)
3. **Mostre o raciocínio errado vs correto** lado a lado
4. **Dê um exemplo clínico** onde esse erro levaria a conduta errada
5. **Questão de reforço** (1 MCQ A-E focada exatamente no ponto de erro)

REGRAS:
- NÃO repita conteúdo genérico — foque APENAS nos erros
- Se o aluno não tem erros registrados nesse tema, simule os erros mais comuns de alunos de residência
- Após resposta: corrija e ofereça mais uma questão de reforço`;
      }

      return `${getLessonPrompt()}
${levelPrompt}
${weakTopicsPrompt}
FASE ATUAL: BLOCOS TÉCNICOS (STATES 2-6)
Tema: "${topic || "solicitado pelo aluno"}"

⚡ FLASH REVIEW (AQUECIMENTO OBRIGATÓRIO):
ANTES de iniciar o bloco técnico, SE houver temas fracos listados acima (weakTopics), apresentar 2-3 perguntas RÁPIDAS de aquecimento sobre esses temas:
- Formato: "⚡ AQUECIMENTO RÁPIDO — Antes de começarmos, vamos revisar:"
- Pergunta 1: sobre o tema fraco mais recente (resposta em 1 linha)
- Pergunta 2: sobre outro tema fraco (resposta em 1 linha)
- Após as respostas do aluno: corrigir brevemente (✅/❌ + 1 frase) e SEGUIR para o bloco técnico
- Se NÃO houver temas fracos: pular o aquecimento e ir direto ao bloco

ENSINE seguindo RIGOROSAMENTE o MARCADOR DE BLOCO.
NUNCA faça perguntas nesta fase até o final do bloco (active recall).
ENTREGUE o conteúdo em 4 MENSAGENS conforme a SEQUÊNCIA DE ENTREGA do prompt principal.

REQUISITOS OBRIGATÓRIOS DO BLOCO DE ENSINO:

1. FISIOPATOLOGIA DETALHADA (OBRIGATÓRIO):
- Incluir mediadores moleculares específicos (IL-6, TNF-α, bradicinina, angiotensina II, etc.)
- Receptores e transportadores envolvidos
- Cascata completa: Gatilho → Mediador → Via → Órgão-alvo → Resultado clínico
- Correlação DIRETA fisiopatologia ↔ sintoma (explicar POR QUE cada sintoma ocorre)
- Citar Guyton/Robbins/Harrison obrigatoriamente

2. EVENTOS ADVERSOS E SEGURANÇA (OBRIGATÓRIO quando houver conduta medicamentosa):
- Efeitos adversos COMUNS (>10%) vs GRAVES/RAROS (<1%)
- Mecanismo do efeito adverso (POR QUE ocorre)
- Interações medicamentosas (CYP450, eletrólitos, sinergismo tóxico)
- Contraindicações absolutas e relativas
- Sinais de alerta para suspensão
- Monitorização laboratorial necessária

REGRA DE REPETIÇÃO ESPAÇADA (PRIORIDADE MÁXIMA):
- PODE repetir o mesmo tema/conceito, desde que haja pelo menos 2 blocos de INTERVALO
- Quando repetir, OBRIGATORIAMENTE use um ENFOQUE DIFERENTE (diagnóstico → tratamento → complicações)
- NUNCA repita o mesmo conceito em blocos CONSECUTIVOS
- QUANDO O ALUNO ERRAR: retome o tema com enfoque diferente nos próximos 3-5 blocos para REFORÇO AUTOMÁTICO
- Varie exemplos clínicos: NUNCA repita perfil de paciente (idade/sexo/cenário) em exemplos diferentes

LIMITE: máximo 500-700 palavras por mensagem. Divida em 4 mensagens conforme sequência.

Ao final da Mensagem 4: inclua a primeira pergunta de Active Recall (❓ Pergunta 1/5).`;
    }

    case "active-recall":
      return `${getRecallPrompt()}
${weakTopicsPrompt}
FASE ATUAL: ACTIVE RECALL (STATES 3/5)
Tema: "${topic}"

FORMATO SEQUENCIAL OBRIGATÓRIO — UMA PERGUNTA POR VEZ:
- Apresente apenas UMA pergunta curta de recuperação ativa por mensagem
- Indique o número da pergunta: "❓ Pergunta X/5"
- Aguarde a resposta do aluno
- Após a resposta: corrija imediatamente (✅ ou ❌) + explicação breve
- Em seguida, apresente a PRÓXIMA pergunta
- Total: 5 perguntas no active recall completo
- Ao final da 5ª pergunta: apresente RESUMO de acertos/erros + sugestão de próximo passo

REGRA: NUNCA apresente múltiplas perguntas de uma vez. SEMPRE 1 por mensagem.

VARIAÇÃO OBRIGATÓRIA DE FORMATOS (distribuir entre as 5 perguntas):
📝 Formato 1 — PERGUNTA ABERTA: "Qual o mecanismo de...?"
✅❌ Formato 2 — VERDADEIRO OU FALSO com justificativa: "V ou F: [afirmação]. Justifique."
📋 Formato 3 — COMPLETE A LACUNA: "O tratamento de primeira linha para ___ é ___"
🔗 Formato 4 — ASSOCIAÇÃO DE COLUNAS: "Associe: (1) Medicamento A → (a) Mecanismo X"
❓ Formato 5 — PERGUNTA DIRETA: "Cite 3 diagnósticos diferenciais de..."

REGRA: usar pelo menos 3 formatos DIFERENTES nas 5 perguntas. NUNCA 5 perguntas do mesmo formato.

REGRA DE REFORÇO POR ERRO:
- Se o aluno errar uma pergunta, adicione uma pergunta EXTRA sobre o mesmo conceito com ângulo diferente
- Ex: errou mecanismo? → pergunte sobre a consequência clínica
- Ex: errou conduta? → pergunte sobre o diagnóstico diferencial

Foque em: mecanismos, diagnósticos, condutas, pontos de prova.
Se o aluno errar: ❌ + resposta correta + raciocínio + ponto de prova + pergunta de reforço na sequência.

Distribuição: fisiopatologia, diagnóstico, tratamento, complicações, semiologia.
Varie os enfoques: NUNCA duas perguntas consecutivas do mesmo conceito.`;

    case "questions":
      return `${getQuestionPrompt()}
${weakTopicsPrompt}
FASE ATUAL: QUESTÃO OBJETIVA (STATE 7)
Tema: "${topic}"

Crie UM caso clínico COMPLETO E DETALHADO com questão de múltipla escolha (A-E).
Nível residência médica/Revalida. Apenas UMA questão. NÃO revele a resposta.

O CASO DEVE OBRIGATORIAMENTE CONTER:
- Paciente com nome fictício, idade exata, sexo, profissão
- Queixa principal com tempo de evolução preciso
- Antecedentes pessoais e medicações em uso (nome e dose)
- Sinais vitais COMPLETOS: PA, FC, FR, Temp, SpO2
- Exame físico DETALHADO com achados positivos E negativos relevantes
- Exames complementares com VALORES NUMÉRICOS reais quando indicado
- Alternativas TODAS plausíveis (nenhuma absurda), com distratores baseados em diagnósticos diferenciais legítimos
- Priorize apresentações ATÍPICAS ou casos que exijam raciocínio em múltiplas etapas

ANAMNESE ÚNICA (REGRA ABSOLUTA):
- NUNCA repita perfil de paciente já usado em questões anteriores da sessão
- Variar: nomes regionais brasileiros, idades de 0 a 95 anos, profissões diversas
- Alternar cenários: PS, enfermaria, UTI, UBS, SAMU, ambulatório, domicílio
- Variar comorbidades: DM, HAS, IRC, HIV, tabagismo, etilismo, gestante, imunossuprimido
- PROIBIDO: repetir perfil demográfico de paciente já apresentado

Diga: "Qual sua resposta? (A, B, C, D ou E)"`;

    case "discussion":
      return `${getDiscussionPrompt()}
FASE ATUAL: DISCUSSÃO DA QUESTÃO (STATE 8)
Tema: "${topic}"

Analise com TODOS estes elementos: alternativa correta, explicação simples, explicação técnica,
raciocínio clínico, diagnóstico diferencial, análise de CADA alternativa, ponto clássico de prova.
Se errou: informar incorreto → corrigir → revisar.
Perguntar: 1) continuar, 2) outra questão, 3) revisar conteúdo.`;

    case "discursive":
      return `${getQuestionPrompt()}
${weakTopicsPrompt}
FASE ATUAL: CASO CLÍNICO DISCURSIVO (STATE 9)
Tema: "${topic}"

Apresente caso clínico COMPLETO e de ALTO NÍVEL com:
- Paciente com nome, idade, sexo, profissão e contexto social
- História detalhada com tempo de evolução, fatores de melhora/piora
- Antecedentes pessoais com comorbidades e medicações (nome, dose)
- Sinais vitais completos + exame físico detalhado (achados positivos E negativos)
- Exames laboratoriais com valores numéricos reais e unidades
- Exames de imagem descritos quando pertinente

O caso deve ter complexidade suficiente para exigir raciocínio clínico em etapas.
Inclua pelo menos uma "armadilha" diagnóstica (apresentação atípica ou comorbidade que confunde).

ANAMNESE ÚNICA — REGRA ABSOLUTA:
- NUNCA repita perfil de paciente de casos anteriores da sessão
- Variar: nomes regionais brasileiros, idades de 0 a 95 anos, profissões diversas
- Alternar cenários: PS, enfermaria, UTI, UBS, SAMU, ambulatório, domicílio
- Variar comorbidades: DM, HAS, IRC, HIV, tabagismo, etilismo, gestante, imunossuprimido
- PROIBIDO: repetir a combinação idade+sexo+cenário de paciente já apresentado

REGRA DE REPETIÇÃO ESPAÇADA:
- PODE retomar temas anteriores, desde que não seja o caso CONSECUTIVO anterior
- Quando retomar, use ENFOQUE DIFERENTE (diagnóstico → conduta → complicação)
- QUANDO O ALUNO ERRAR: retome o tema nos próximos 3-5 casos para REFORÇO com ângulo diferente

Pergunte:
1. Qual o diagnóstico mais provável? Justifique com base nos achados.
2. Quais os principais diagnósticos diferenciais e como descartá-los?
3. Que exames complementares adicionais você solicitaria?
4. Qual a conduta terapêutica inicial? (medicações com dose, via e posologia)
Aguarde a resposta. Depois corrija com nota 0-5 por critério.`;

    case "scoring":
      return `${getScoringPrompt()}
FASE ATUAL: CORREÇÃO DISCURSIVA + ATUALIZAÇÃO (STATES 10-11)
Tema: "${topic}"

Dados da sessão:
${JSON.stringify(performanceData || {}, null, 2)}

Correção: diagnóstico 0-2, conduta 0-2, justificativa 0-1. Total X/5.
Depois: resposta esperada, explicação, raciocínio, erros clássicos, reforço.
Mostrar desempenho atualizado + temas fracos + próximo passo + mensagem motivacional.

🗺️ RESUMO VISUAL DE CONSOLIDAÇÃO (OBRIGATÓRIO):
Ao final da correção, gerar um FLUXOGRAMA TEXTUAL do tema estudado usando ASCII:

Formato:
🗺️ MAPA DE CONSOLIDAÇÃO — [Tema]

┌─────────────────┐
│  GATILHO/CAUSA   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ FISIOPATOLOGIA   │
│ (mecanismo-chave)│
└────────┬────────┘
         ↓
┌─────────────────┐
│ QUADRO CLÍNICO   │
│ (achados-chave)  │
└────────┬────────┘
         ↓
┌─────────────────┐
│   DIAGNÓSTICO    │
│ (exame-chave)    │
└────────┬────────┘
         ↓
┌─────────────────┐
│    CONDUTA      │
│ (padrão-ouro)    │
└─────────────────┘

REGRAS:
- Use símbolos ASCII simples
- Seja objetivo nas etapas do fluxograma`;

    case "reinforcement":
      return `${getReinforcementPrompt()}
${levelPrompt}
FASE ATUAL: REFORÇO IMEDIATO (STATE RE)
Tema: "${topic}"

O aluno acabou de errar um conceito. Você deve REFORÇAR este ponto específico:
1. Explique o ponto de erro em 3-4 frases
2. Use uma analogia ou mnemônico
3. Crie uma pequena questão de verificação (V/F ou MCQ rápida) sobre este EXATO ponto

REGRAS:
- NÃO repita o enunciado original — aborde o conceito por outro ângulo
- Linguagem positiva e motivadora ("Vamos fixar isso", "Boa tentativa")
- Seja BREVE — o objetivo é corrigir, não dar aula completa
- A questão de verificação deve testar exatamente o ponto que o aluno errou
- Ao final diga: "Qual sua resposta? (A, B, C, D ou E)"`;

    default: {
      const levelPrompt = getLevelPrompt(performanceData);
      return `${getLessonPrompt()}
${levelPrompt}
${getWeakTopicsPrompt(performanceData)}
Siga o fluxo pedagógico dos STATES 0-12.
REGRA: NUNCA comece com questões. Sempre ensine primeiro. Nunca pule estados.`;
    }
  }
}

// ── Concurrency semaphore for SSE streaming ──
const MAX_CONCURRENT_STREAMS = 25;
let activeStreams = 0;

async function fetchFallbackQuestion(supabase: any, topic: string) {
  console.log(`[Fallback] Searching questions_bank for topic: ${topic}`);
  const { data, error } = await supabase
    .from("questions_bank")
    .select("*")
    .or(`topic.ilike.%${topic}%,subtopic.ilike.%${topic}%,statement.ilike.%${topic}%`)
    .eq("review_status", "approved")
    .limit(5);

  if (error || !data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)];
}

function formatQuestionAsText(q: any): string {
  const options = Array.isArray(q.options) 
    ? q.options.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}) ${opt}`).join("\n")
    : "";
  
  return `### 📋 Questão do Banco (Fallback)
  
${q.statement}

${options}

**Qual sua resposta? (A, B, C, D ou E)**

<!--SIGNAL-->
{"wasCorrect":false,"correctLetter":"${String.fromCharCode(65 + (q.correct_index ?? 0))}","isFallback":true,"topic":"${q.topic || ""}"}
<!--/SIGNAL-->`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  const userId = await extractUserId(req);
  if (!userId) {
    return json({ error: "Autenticação obrigatória." }, 401);
  }

  if (activeStreams >= MAX_CONCURRENT_STREAMS) {
    return json({ error: "Servidor ocupado. Tente novamente em alguns segundos.", retry: true }, 503);
  }

  activeStreams++;
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json", message: "Corpo da requisição inválido." }, 400);
    }

    const { messages, phase, topic, userContext, performanceData, studyMode, targetExam } = body;

    if (!Array.isArray(messages)) {
      return json({ error: "Campo 'messages' é obrigatório." }, 400);
    }

    console.debug(`[study-session] id=${requestId} user=${userId} phase=${phase} topic=${topic}`);

    let systemPrompt = getPhasePrompt(phase, topic, performanceData, studyMode);
    const bancaProfile = getBancaProfile(targetExam);
    systemPrompt += buildBancaBlock(bancaProfile);

    if (["questions", "discussion", "reinforcement", "active-recall", "lesson"].includes(phase)) {
      systemPrompt += "\n" + STRUCTURED_SIGNAL_BLOCK;
    }

    if (userContext) {
      const truncatedContext = String(userContext).slice(0, 4000);
      systemPrompt += `\n\n--- MATERIAL DE ESTUDO ---\n${truncatedContext}\n--- FIM ---`;
    }

    const isLightPhase = ["performance", "recall", "recall_result", "active-recall", "reinforcement"].includes(phase);
    const isQuestionPhase = phase === "questions";
    const modelTier = isLightPhase ? "standard" : "pro";
    const usedModel = getModelForTier(modelTier);
    const timeoutMs = isQuestionPhase ? 15000 : 45000;
    
    const trimmedMessages = messages.slice(-10);
    const startMs = Date.now();

    try {
      const response = await aiFetch({
        model: usedModel,
        messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages],
        stream: true,
        maxTokens: isLightPhase ? 2048 : 4096,
        timeoutMs,
        userId
      });

      const elapsed = Date.now() - startMs;
      logAiUsage({
        userId,
        functionName: "study-session",
        modelUsed: usedModel,
        success: response.ok,
        responseTimeMs: elapsed,
        modelTier,
        errorMessage: response.ok ? undefined : `status ${response.status}`,
      }).catch(() => {});

      if (!response.ok) {
        throw new Error(`AI_ERROR_${response.status}`);
      }

      const transform = new TransformStream({
        flush() { activeStreams = Math.max(0, activeStreams - 1); },
      });
      response.body!.pipeTo(transform.writable).catch(() => { activeStreams = Math.max(0, activeStreams - 1); });

      return new Response(transform.readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } catch (aiErr) {
      console.error(`[study-session] id=${requestId} AI Call failed:`, aiErr);
      
      // Fallback OBRIGATÓRIO para fase de questões
      if (isQuestionPhase) {
        const fallback = await fetchFallbackQuestion(supabaseAdmin, topic);
        if (fallback) {
          activeStreams = Math.max(0, activeStreams - 1);
          const content = formatQuestionAsText(fallback);
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                choices: [{ delta: { content: "⚠️ *Instabilidade na IA — usando questão alternativa*\n\n" } }],
                isFallback: true 
              })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: content } }] })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            }
          });
          return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
      }

      // Fallback genérico para outras fases (não deixa a tela vazia)
      if (phase === "lesson") {
        activeStreams = Math.max(0, activeStreams - 1);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              choices: [{ delta: { content: `⚠️ *A IA está um pouco lenta.* Vamos tentar continuar em modo reduzido.\n\n**Foco em ${topic}:** O TEP é uma emergência vascular pulmonar crítica. O diagnóstico de escolha costuma ser a Angio-TC de tórax. O tratamento de escolha é a anticoagulação.\n\nPodemos tentar carregar o conteúdo completo novamente? Clique no botão abaixo ou digite sua dúvida.` } }]
            })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      throw aiErr;
    }
  } catch (e) {
    activeStreams = Math.max(0, activeStreams - 1);
    const isTimeout = e instanceof Error && (e.name === "AbortError" || e.message.includes("timeout"));
    
    return json({ 
      error: "Erro no serviço de IA", 
      message: isTimeout ? "Tempo esgotado. Tente novamente." : "Falha na geração.",
      isTimeout,
      isFallbackActive: true
    }, 500);
  }
});
