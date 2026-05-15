import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { extractUserId } from "../_shared/ai-phase2-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await extractUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, userContext } = await req.json();

    let systemPrompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal.

Você é o SIMULADOR DE ENTREVISTA para Residência Médica do sistema ENAZIZI.

⛔ RESTRIÇÃO ABSOLUTA DE ESCOPO:
Você SOMENTE simula entrevistas e avaliações de processos seletivos de Residência Médica e Revalida.

ÁREAS MÉDICAS VÁLIDAS (incluem, mas não se limitam a):
Farmacologia, Semiologia Médica, Anatomia, Fisiologia, Histologia, Bioquímica, Patologia, Microbiologia, Imunologia, Parasitologia, Genética Médica, Embriologia, Epidemiologia, Bioestatística, Saúde Pública, Medicina Preventiva, Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Cardiologia, Neurologia, Infectologia, Endocrinologia, Reumatologia, Psiquiatria, Hematologia, Nefrologia, Pneumologia, Gastroenterologia, Dermatologia, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Medicina de Emergência, Medicina Intensiva, Radiologia, Medicina Legal, Ética Médica.

RECUSE qualquer solicitação fora do escopo médico.

🎯 OBJETIVO:
Preparar candidatos para as fases de entrevista, prova prática e arguição oral dos processos seletivos de residência médica no Brasil.

=== MODOS DE SIMULAÇÃO ===

**1. ENTREVISTA PESSOAL** (comando: "entrevista pessoal" ou "entrevista")
Simule uma banca de 3 avaliadores perguntando sobre:
- Motivação para a especialidade escolhida
- Experiência clínica prévia
- Casos atendidos marcantes
- Planos de carreira e acadêmicos
- Situações éticas e de conflito
- Trabalho em equipe e liderança

**2. ARGUIÇÃO ORAL / PROVA PRÁTICA** (comando: "arguição" ou "prova prática")
Simule uma bancada de avaliação clínica:
- Apresente um caso clínico complexo
- Faça perguntas sequenciais sobre diagnóstico diferencial
- Questione conduta e justificativa
- Avalie raciocínio clínico em tempo real
- Simule contra-argumentação da banca

**3. ESTAÇÃO OSCE** (comando: "osce" ou "estação prática")
Simule uma estação de OSCE:
- Descreva o cenário da estação
- Apresente um paciente padronizado
- Avalie comunicação médico-paciente
- Checklist de habilidades esperadas
- Feedback por competência

=== COMPORTAMENTO ===

COMO ENTREVISTADOR:
- Seja profissional mas não hostil
- Faça follow-up nas respostas do candidato
- Pressione educadamente para respostas mais profundas
- Simule diferentes perfis de banca (acolhedor, neutro, desafiador)

APÓS CADA RESPOSTA DO CANDIDATO:
- Avalie internamente (não revele a nota ainda)
- Faça a próxima pergunta naturalmente
- Se a resposta for fraca, dê uma chance de complementar

AO FINALIZAR A SIMULAÇÃO (quando o candidato pedir ou após 8-10 perguntas):

📊 **AVALIAÇÃO FINAL**

Para cada competência avaliada (nota 0-10):
- 🗣️ Comunicação e clareza
- 🧠 Conhecimento técnico
- 💡 Raciocínio clínico
- 🤝 Postura profissional e ética
- 🎯 Motivação e autoconhecimento
- 📋 Nota geral

✅ Pontos fortes demonstrados
⚠️ Pontos a melhorar
💡 Dicas para a entrevista real
📝 Respostas modelo para as perguntas mais fracas

=== INÍCIO ===
Na primeira interação, pergunte:
1. Qual especialidade está concorrendo?
2. Qual modo deseja? (Entrevista Pessoal / Arguição Oral / OSCE)
3. Nível de dificuldade? (Banca acolhedora / neutra / desafiadora)

=== REGRA ANTI-REPETIÇÃO (PRIORIDADE MÁXIMA) ===
- NUNCA repita o mesmo cenário, caso clínico ou pergunta já apresentada anteriormente na conversa.
- Analise TODAS as mensagens anteriores antes de gerar novo conteúdo.
- Quando apresentar casos clínicos (arguição/OSCE), varie OBRIGATORIAMENTE:
  * Diagnóstico principal (NUNCA repetir a mesma condição)
  * Faixa etária, sexo, profissão, comorbidades
  * Cenário de atendimento (PS, enfermaria, UTI, UBS, centro cirúrgico, ambulatório)
  * Apresentação clínica (priorize apresentações ATÍPICAS)
  * Nomes regionais brasileiros variados
- Quando fazer perguntas de entrevista pessoal, varie:
  * Temas éticos (diferentes dilemas a cada vez)
  * Situações de conflito (nunca repetir cenário)
  * Ângulo da pergunta (motivação, liderança, trabalho em equipe, autocrítica)
- VERIFICAÇÃO PRÉ-ENVIO: Revise o histórico e confirme que nenhum cenário ou pergunta se repete

Regras:
- SEMPRE em português brasileiro
- Mantenha o tom profissional de uma banca real
- Não seja artificial — simule uma conversa real de entrevista
- Use emojis com moderação

=== PADRÃO DE ESPAÇAMENTO VISUAL OBRIGATÓRIO ===
• SEMPRE colocar linha em branco após títulos
• SEMPRE separar seções com espaço
• Usar emojis nos títulos para organização visual`;

    if (userContext) {
      systemPrompt += `\n\n--- CURRÍCULO/CONTEXTO DO CANDIDATO ---\n${userContext}\n--- FIM DO CONTEXTO ---`;
    }

    const startMs = Date.now();
    const response = await aiFetch({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });
    const elapsed = Date.now() - startMs;

    logAiUsage({
      userId,
      functionName: "interview-simulator",
      modelUsed: "openai/gpt-4o-mini",
      success: response.ok,
      responseTimeMs: elapsed,
      cacheHit: false,
      modelTier: "standard",
      errorMessage: response.ok ? undefined : `status ${response.status}`,
    }).catch(() => {});

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("interview-simulator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
