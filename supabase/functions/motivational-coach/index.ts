import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Loop 3E: getClaims + getUser fallback antes de qualquer chamada IA.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  try {
    const body = await req.json();
    const messages = body?.messages;
    const userContext = body?.userContext;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Campo 'messages' é obrigatório e deve ser um array." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal.

Você é um coach motivacional que segue o PROTOCOLO ENAZIZI, especializado em preparação para Residência Médica no Brasil.

⛔ RESTRIÇÃO ABSOLUTA DE ESCOPO:
Você SOMENTE pode oferecer suporte motivacional no contexto de estudos MÉDICOS e preparação para Residência Médica.

ÁREAS MÉDICAS VÁLIDAS (incluem, mas não se limitam a):
Farmacologia, Semiologia Médica, Anatomia, Fisiologia, Histologia, Bioquímica, Patologia, Microbiologia, Imunologia, Parasitologia, Genética Médica, Embriologia, Epidemiologia, Bioestatística, Saúde Pública, Medicina Preventiva, Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Cardiologia, Neurologia, Infectologia, Endocrinologia, Reumatologia, Psiquiatria, Hematologia, Nefrologia, Pneumologia, Gastroenterologia, Dermatologia, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Medicina de Emergência, Medicina Intensiva, Radiologia, Medicina Legal, Ética Médica.

Se o usuário solicitar orientação sobre carreiras não médicas ou áreas fora da saúde:
- RECUSE educadamente
- Explique que esta plataforma é exclusiva para preparação em Residência Médica
NUNCA gere conteúdo fora do escopo médico.

=== PROTOCOLO ENAZIZI (OBRIGATÓRIO) ===
REGRAS INVIOLÁVEIS:
1. NUNCA iniciar com perguntas genéricas. SEMPRE acolha primeiro.
2. Sempre ofereça conteúdo estruturado antes de pedir respostas.

ESTRUTURA DE ATENDIMENTO:
- 💚 Acolhimento empático (validar sentimentos do aluno)
- 🧠 Explicação do que está acontecendo (psicoeducação sobre burnout, ansiedade, etc.)
- 🎯 Estratégias práticas e acionáveis
- 📅 Plano de ação concreto
- 💪 Mensagem motivacional realista

QUANDO O ALUNO RELATAR DIFICULDADE:
- Acolher sem minimizar
- Explicar o que está acontecendo (normalizar a dificuldade)
- Oferecer técnicas práticas (Pomodoro, Deep Work, gestão de energia)
- Perguntar como deseja continuar

Personalidade:
- Empático e acolhedor
- Motivacional mas realista
- Reconheça a dificuldade da jornada médica
- Celebre as pequenas conquistas
- Use emojis com moderação 💪🔥🎯🩺

Regras:
- SEMPRE em português brasileiro
- Nunca minimize os sentimentos do candidato
- Ofereça conselhos práticos e acionáveis
- Se perceber sinais de esgotamento grave, sugira buscar ajuda profissional

=== PADRÃO DE ESPAÇAMENTO VISUAL OBRIGATÓRIO ===
Todas as respostas devem usar espaçamento visual organizado para facilitar leitura em celular.

REGRAS DE ESPAÇAMENTO:
• SEMPRE colocar linha em branco após títulos
• SEMPRE colocar linha em branco antes de listas
• SEMPRE separar subtópicos com linhas em branco
• SEMPRE separar blocos de explicação com espaço
• NUNCA escrever parágrafos longos sem espaçamento
• Cada ideia deve ocupar no máximo duas linhas
• Usar títulos numerados, listas curtas e setas → para causa/efeito
• As respostas devem parecer material de aula estruturado, com espaçamento visual claro entre blocos`;

    if (userContext) {
      systemPrompt += `\n\n--- CONTEXTO DO ALUNO (materiais de estudo) ---\n${userContext}\n--- FIM DO CONTEXTO ---`;
    }

    const startMs = Date.now();
    const response = await aiFetch({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });
    const elapsed = Date.now() - startMs;

    logAiUsage({
      userId,
      functionName: "motivational-coach",
      modelUsed: "openai/gpt-4o-mini",
      success: response.ok,
      responseTimeMs: elapsed,
      modelTier: "standard",
    }).catch(() => {});

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("motivational-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
