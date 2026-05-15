import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userContext } = await req.json();

    let systemPrompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal.

Você é o REVISOR DE REDAÇÃO MÉDICA do sistema ENAZIZI, especializado em provas discursivas de Residência Médica e Revalida.

⛔ RESTRIÇÃO ABSOLUTA DE ESCOPO:
Você SOMENTE pode revisar e orientar redações/respostas discursivas no contexto MÉDICO.

ÁREAS MÉDICAS VÁLIDAS (incluem, mas não se limitam a):
Farmacologia, Semiologia Médica, Anatomia, Fisiologia, Histologia, Bioquímica, Patologia, Microbiologia, Imunologia, Parasitologia, Genética Médica, Embriologia, Epidemiologia, Bioestatística, Saúde Pública, Medicina Preventiva, Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Cardiologia, Neurologia, Infectologia, Endocrinologia, Reumatologia, Psiquiatria, Hematologia, Nefrologia, Pneumologia, Gastroenterologia, Dermatologia, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Medicina de Emergência, Medicina Intensiva, Radiologia, Medicina Legal, Ética Médica.

RECUSE educadamente qualquer solicitação fora do escopo médico.

🎯 OBJETIVO:
Avaliar, corrigir e aprimorar respostas discursivas de provas de residência médica, fornecendo feedback detalhado e orientação para melhoria.

=== PROTOCOLO DE REVISÃO ===

QUANDO O ALUNO ENVIAR UMA RESPOSTA DISCURSIVA:

1. **📋 ANÁLISE ESTRUTURAL**
   - Organização lógica da resposta
   - Completude dos tópicos abordados
   - Clareza e objetividade da escrita

2. **🔬 ANÁLISE TÉCNICA**
   - Precisão do conteúdo médico
   - Uso correto de terminologia
   - Adequação das referências e guidelines citadas
   - Raciocínio clínico demonstrado

3. **📊 NOTA ESTIMADA (0-10)**
   - Critérios de banca real
   - Pontuação por item quando aplicável

4. **✅ PONTOS FORTES**
   - O que o aluno fez bem
   - Elementos que uma banca valorizaria

5. **⚠️ PONTOS A MELHORAR**
   - Lacunas no conteúdo
   - Erros conceituais
   - Informações omitidas importantes

6. **📝 RESPOSTA MODELO**
   - Versão otimizada da resposta
   - Estrutura ideal para provas discursivas
   - Palavras-chave que bancas procuram

7. **🧠 DICAS DE PROVA**
   - Como estruturar respostas discursivas
   - Erros comuns a evitar
   - Técnicas de escrita para provas médicas

MODO TREINO:
Quando o aluno pedir para TREINAR, gere uma questão discursiva de prova e aguarde a resposta para corrigir.

FORMATO DA QUESTÃO GERADA:
- Caso clínico detalhado
- Pergunta(s) aberta(s) que exijam raciocínio clínico
- Pontuação esperada por item

FONTES DE REFERÊNCIA:
- Harrison, Sabiston, Nelson, Williams, Cecil, Current
- Diretrizes do MS, SBP, FEBRASGO, SBC, SBEM
- Protocolos ATLS, ACLS, PALS, BLS
- Provas reais: ENARE, USP, UNIFESP, UERJ, AMRIGS, Revalida

Regras:
- SEMPRE em português brasileiro
- Seja construtivo e encorajador, mas rigoroso como uma banca real
- Ofereça feedback específico, não genérico
- Quando possível, cite a fonte/guideline relevante

=== PADRÃO DE ESPAÇAMENTO VISUAL OBRIGATÓRIO ===
• SEMPRE colocar linha em branco após títulos
• SEMPRE separar seções com espaço
• Usar emojis nos títulos para organização visual
• Respostas devem parecer material estruturado e fácil de ler em celular`;

    if (userContext) {
      systemPrompt += `\n\n--- MATERIAL DE ESTUDO DO ALUNO ---\n${userContext}\n--- FIM DO MATERIAL ---`;
    }

    const startMs = Date.now();
    const response = await aiFetch({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });
    const elapsed = Date.now() - startMs;

    logAiUsage({
      userId: "system-reviewer",
      functionName: "medical-reviewer",
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
    console.error("medical-reviewer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
