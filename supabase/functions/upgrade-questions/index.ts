import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function upgradeQuestion(q: { id: string; statement: string; options: string[]; correct_index: number; topic: string; explanation?: string }, apiKey: string): Promise<string | null> {
  const prompt = `Você é um elaborador de questões de ELITE para residência médica (ENAMED/REVALIDA).

TAREFA: Expanda o enunciado curto abaixo em um CASO CLÍNICO COMPLETO padrão prova, mantendo o MESMO tema, as MESMAS alternativas e o MESMO gabarito (índice ${q.correct_index}).

ENUNCIADO ORIGINAL:
"${q.statement}"

ALTERNATIVAS ORIGINAIS:
${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")}

TEMA: ${q.topic}

REGRAS OBRIGATÓRIAS:
1. Crie um caso clínico com paciente fictício (nome, idade, sexo, profissão)
2. Inclua: QP com tempo de evolução, HDA detalhada, antecedentes, hábitos
3. Sinais vitais completos (PA, FC, FR, Temp, SpO2)
4. Exame físico com achados positivos e negativos
5. Exames laboratoriais com valores numéricos quando pertinente
6. O enunciado expandido deve ter 400-800 caracteres
7. NÃO altere as alternativas nem o gabarito
8. NÃO referencie imagens, figuras ou gráficos
9. TUDO em PORTUGUÊS BRASILEIRO
10. Mantenha a pergunta objetiva no final do caso
11. 🚨 CRÍTICO: O campo "statement" deve conter APENAS o caso clínico e a pergunta final. NÃO inclua as alternativas (A, B, C, D, E) dentro do statement. As alternativas já existem separadamente e serão mantidas como estão.
12. NÃO repita, liste ou mencione as alternativas dentro do enunciado de forma alguma.

Retorne APENAS JSON: {"statement": "caso clínico expandido completo terminando APENAS com a pergunta, SEM listar alternativas"}`;

  try {
    const res = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "Responda EXCLUSIVAMENTE com JSON válido. Sem markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      console.error(`AI error ${res.status} for ${q.id}`);
      return null;
    }

    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || "").replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    // Strip any alternatives that leaked into the statement
    let newStatement = (parsed.statement || "").trim();
    // Remove patterns like "A) ...\nB) ...\nC) ..." or "a) ..." at the end
    newStatement = newStatement.replace(/\n\s*[A-Ea-e]\)\s+.+$/gms, "").trim();
    // Remove patterns like "\nA. ...\nB. ..." 
    newStatement = newStatement.replace(/\n\s*[A-Ea-e]\.\s+.+$/gms, "").trim();

    if (!newStatement || newStatement.length < 350) {
      console.warn(`Upgraded statement too short for ${q.id}: ${newStatement?.length}`);
      return null;
    }

    return newStatement;
  } catch (e) {
    console.error(`Upgrade error for ${q.id}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 10, 20);
    const ids: string[] | undefined = body.ids;

    // Fetch questions to upgrade
    let query = supabaseAdmin.from("questions_bank")
      .select("id, statement, options, correct_index, topic, explanation")
      .eq("quality_tier", "needs_upgrade")
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (ids && ids.length > 0) {
      query = supabaseAdmin.from("questions_bank")
        .select("id, statement, options, correct_index, topic, explanation")
        .in("id", ids)
        .limit(batchSize);
    }

    const { data: questions, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma questão para enriquecer", upgraded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let upgraded = 0;
    let failed = 0;

    for (const q of questions) {
      const newStatement = await upgradeQuestion(
        { ...q, options: Array.isArray(q.options) ? q.options : [] },
        LOVABLE_API_KEY,
      );

      if (newStatement) {
        const { error } = await supabaseAdmin.from("questions_bank").update({
          statement: newStatement,
          quality_tier: "exam_standard",
          review_status: "pending",
          source: (q as any).source ? `${(q as any).source}|ai-upgraded` : "ai-upgraded",
        }).eq("id", q.id);

        if (!error) upgraded++;
        else { console.error(`Update error ${q.id}:`, error); failed++; }
      } else {
        failed++;
      }

      // Small delay to avoid rate limits
      if (questions.indexOf(q) < questions.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return new Response(JSON.stringify({
      message: `${upgraded} questões enriquecidas, ${failed} falharam`,
      upgraded,
      failed,
      total_processed: questions.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("upgrade-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
