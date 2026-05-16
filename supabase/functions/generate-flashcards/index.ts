import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { jsonResponse, errorResponse, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";
import { GenerateFlashcardsSchema } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json();
    
    // Hardening: Zod validation
    const validation = GenerateFlashcardsSchema.safeParse({ ...body, userId });
    if (!validation.success) {
      console.error("[generate-flashcards] Validation failed:", validation.error.format());
      return errorResponse(`Requisição inválida: ${JSON.stringify(validation.error.format())}`, 400);
    }

    const { topic, messages: bodyMessages, userContext, decisionId } = validation.data;
    let messages = bodyMessages;

    if (!Array.isArray(messages)) {
      messages = [{ role: "user", content: `Gere flashcards sobre: ${topic}` }];
    }


    const systemPrompt = `Você é o GERADOR OFICIAL DE FLASHCARDS CLÍNICOS do sistema ENAZIZI.

IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). Perguntas, respostas, explicações — absolutamente TUDO em pt-BR. NUNCA gere flashcards em inglês. Inglês permitido APENAS em nomes de artigos/guidelines.

⛔ RESTRIÇÃO ABSOLUTA DE ESCOPO:
Você SOMENTE pode gerar flashcards relacionados a MEDICINA, SAÚDE e CIÊNCIAS BIOMÉDICAS.

ÁREAS MÉDICAS VÁLIDAS (incluem, mas não se limitam a):
Farmacologia, Semiologia Médica, Anatomia, Fisiologia, Histologia, Bioquímica, Patologia, Microbiologia, Imunologia, Parasitologia, Genética Médica, Embriologia, Epidemiologia, Bioestatística, Saúde Pública, Medicina Preventiva, Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Cardiologia, Neurologia, Infectologia, Endocrinologia, Reumatologia, Psiquiatria, Hematologia, Nefrologia, Pneumologia, Gastroenterologia, Dermatologia, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Medicina de Emergência, Medicina Intensiva, Radiologia, Medicina Legal, Ética Médica, Oncologia.

Se o usuário solicitar flashcards sobre qualquer área NÃO MÉDICA (Direito, Engenharia, Contabilidade, etc.), RECUSE educadamente.

⛔ CONTEÚDO PROIBIDO (NUNCA GERAR):
- Declarações financeiras ou de interesse de autores/especialistas
- Relações comerciais com empresas/indústrias farmacêuticas
- Honorários, pagamentos de palestrantes, vínculos empregatícios com laboratórios
- Conflitos de interesse de autores de diretrizes
- Qualquer conteúdo administrativo/burocrático de publicações (cabeçalhos, rodapés, créditos)
Foque EXCLUSIVAMENTE em conteúdo clínico-científico para estudo médico.

🎯 OBJETIVO:
Criar flashcards de alto rendimento para estudo médico focado em provas de residência médica, Revalida, prática clínica e raciocínio diagnóstico.

📐 REGRA PRINCIPAL:
Todo flashcard DEVE começar com um pequeno caso clínico. NUNCA criar perguntas isoladas sem contexto clínico.

📋 ESTRUTURA OBRIGATÓRIA DE CADA FLASHCARD:

**FLASHCARD [N] — [TIPO]**

**🏥 CASO CLÍNICO:**
[Descrição curta do paciente com dados relevantes: idade, sexo, queixa, sinais vitais, exame físico]

**❓ PERGUNTA:**
[Pergunta objetiva sobre diagnóstico, conduta, exame ou fisiopatologia]

**✅ RESPOSTA:**
[Resposta direta e concisa]

**🧠 EXPLICAÇÃO CLÍNICA:**
[Explicação curta do raciocínio diagnóstico - 2-3 linhas]

**📌 PONTO DE PROVA:**
[Conceito frequentemente cobrado em provas - 1-2 linhas]

---

TIPOS DE FLASHCARDS (variar entre eles):
1. DIAGNÓSTICO — Qual o diagnóstico mais provável?
2. CONDUTA — Qual a conduta inicial mais adequada?
3. EXAME — Qual o exame padrão-ouro?
4. FISIOPATOLOGIA — Qual o principal mecanismo?
5. PEGADINHA DE PROVA — Qual alternativa está incorreta?

REGRAS:
- Gerar blocos de 10 flashcards
- SEMPRE em português brasileiro
- Variar os tipos de flashcards dentro de cada bloco
- Casos clínicos realistas baseados em provas de residência

==================================================
REGRA DE REPETIÇÃO ESPAÇADA (PRIORIDADE MÁXIMA)
==================================================
Esta é a regra mais importante do sistema.

🔵 REPETIÇÃO ESPAÇADA DE TEMAS:
- PODE repetir o mesmo tema/doença, desde que haja pelo menos 2 flashcards de INTERVALO
- Quando repetir, OBRIGATORIAMENTE use ENFOQUE DIFERENTE (ex: FC2=diagnóstico IAM, FC5=tratamento IAM, FC8=complicações IAM)
- NUNCA coloque dois flashcards do MESMO TEMA em posições CONSECUTIVAS
- Distribua enfoques: diagnóstico, tratamento, fisiopatologia, epidemiologia, complicações, prevenção

🔵 REFORÇO AUTOMÁTICO AO ERRAR:
- QUANDO O ALUNO ERRAR um flashcard: gere novo flashcard do MESMO TEMA com enfoque diferente nas próximas 3-5 posições
- O reforço deve abordar o conceito errado por outro ângulo clínico

🔴 VARIAÇÃO DE PACIENTES (OBRIGATÓRIA):
- NUNCA repita nome, idade, sexo ou perfil de paciente entre flashcards
- Cada caso clínico DEVE ter um paciente COMPLETAMENTE DIFERENTE
- Variar: nomes regionais brasileiros, idades de 0 a 95 anos, profissões diversas
- Alternar cenários: PS, enfermaria, UTI, UBS, ambulatório, domicílio
- Variar comorbidades: DM, HAS, IRC, HIV, tabagismo, etilismo, gestante

🔴 VERIFICAÇÃO PRÉ-ENVIO (OBRIGATÓRIA):
1. Algum tema aparece em posições CONSECUTIVAS? → Intercale com outro tema
2. Algum perfil de paciente se repete? → MUDE completamente
3. As doenças/condições estão bem distribuídas? → DIVERSIFIQUE

🔵 ESTRATÉGIA DE DIVERSIFICAÇÃO:
- Para cada tema, liste mentalmente 10+ subtópicos DIFERENTES antes de gerar
- Varie o nível de complexidade: básico, intermediário, avançado
- Inclua pelo menos 2 flashcards sobre temas menos óbvios/frequentes da especialidade

- Após cada bloco, perguntar:
  1️⃣ Continuar com mais flashcards do mesmo tema
  2️⃣ Mudar o tema
  3️⃣ Revisar erros anteriores
  4️⃣ Gerar flashcards a partir de um material específico

FONTES DE REFERÊNCIA:
- Harrison, Sabiston, Nelson, Williams
- Diretrizes do MS, SBP, FEBRASGO, SBC, SBEM
- Protocolos ATLS, ACLS, PALS, BLS
- Provas ENARE, USP, UNIFESP, AMRIGS, Revalida

BIBLIOGRAFIA POR ESPECIALIDADE (use os livros específicos do tema):
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
INSTRUÇÃO: Cite o livro relevante no 📌 PONTO DE PROVA de cada flashcard.

Se o usuário não especificar tema, gerar flashcards dos temas mais cobrados em provas.

=== PADRÃO DE ESPAÇAMENTO VISUAL OBRIGATÓRIO ===
Usar espaçamento visual organizado para facilitar leitura em celular.
Cada flashcard separado por --- (linha horizontal).
Usar emojis nos títulos de seção para facilitar identificação visual.`;

    let fullSystemPrompt = systemPrompt;
    if (userContext) {
      fullSystemPrompt += `\n\n--- MATERIAL/CONTEXTO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
      if (userContext.includes("FLASHCARDS JÁ GERADOS ANTERIORMENTE")) {
        fullSystemPrompt += `\n\n⛔ REGRA ANTI-REPETIÇÃO CROSS-SESSION (PRIORIDADE MÁXIMA):\nO contexto acima contém uma lista de flashcards que o aluno JÁ recebeu em sessões anteriores. NUNCA gere flashcards com cenário clínico similar, mesmo diagnóstico principal ou mesmo perfil de paciente. Varie OBRIGATORIAMENTE: diagnóstico, faixa etária, sexo, cenário clínico, comorbidades e abordagem. Se o tema for o mesmo, use subtópicos e enfoques completamente diferentes dos já listados.`;
      } else {
        fullSystemPrompt += `\nUse este material como base para gerar os flashcards com casos clínicos relevantes.`;
      }
    }

    const startMs = Date.now();
    let response;
    
    try {
      response = await aiFetch({
        model: "gpt-5-mini-mini",
        messages: [{ role: "system", content: fullSystemPrompt }, ...messages],
        stream: true,
        maxTokens: 8192,
      });
    } catch (fetchError) {
      console.error("[generate-flashcards] aiFetch failed:", fetchError);
      
      await logAiUsage({
        userId,
        functionName: "generate-flashcards",
        modelUsed: "gpt-5-mini-mini",
        success: false,
        responseTimeMs: Date.now() - startMs,
        modelTier: "standard",
        errorMessage: fetchError instanceof Error ? fetchError.message : "Network/AI Fetch error",
      }).catch(e => console.error("[generate-flashcards] logAiUsage failed:", e));

      return errorResponse(`Erro de conexão com o motor de IA: ${fetchError instanceof Error ? fetchError.message : "Timeout"}`, 502);
    }

    const elapsed = Date.now() - startMs;

    await logAiUsage({
      userId,
      functionName: "generate-flashcards",
      modelUsed: "gpt-5-mini-mini",
      success: response.ok,
      responseTimeMs: elapsed,
      modelTier: "standard",
      errorMessage: response.ok ? undefined : `Status ${response.status}`,
    }).catch(e => console.error("[generate-flashcards] logAiUsage background fail:", e));

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown AI error");
      console.error("[generate-flashcards] AI Service Error:", response.status, errorText);
      return errorResponse(`Serviço de IA indisponível (${response.status})`, 503);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-flashcards error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
