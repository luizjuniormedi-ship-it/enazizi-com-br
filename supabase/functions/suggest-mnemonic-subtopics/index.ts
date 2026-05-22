import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-request-id, x-timeout-ms, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SubtopicItem {
  name: string;
  priority: "high" | "medium" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return new Response(JSON.stringify({ subtopics: [], source: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = topic.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Try curriculum_subtopics (structured, with prioridade_base)
    const { data: topicRows } = await supabase
      .from("curriculum_topics")
      .select("id, nome")
      .ilike("nome", `%${trimmed}%`)
      .eq("ativo", true)
      .limit(3);

    if (topicRows && topicRows.length > 0) {
      const topicIds = topicRows.map(t => t.id);
      const { data: subtopicRows } = await supabase
        .from("curriculum_subtopics")
        .select("nome, prioridade_base, incidencia_geral")
        .in("topic_id", topicIds)
        .eq("ativo", true)
        .order("prioridade_base", { ascending: false })
        .limit(8);

      if (subtopicRows && subtopicRows.length >= 2) {
        const items: SubtopicItem[] = subtopicRows.map(s => ({
          name: s.nome,
          priority: assignPriorityFromScore(s.prioridade_base, s.incidencia_geral),
        }));
        return respond({ subtopics: items.slice(0, 6), source: "curriculum" });
      }
    }

    // 2. Try curriculum_matrix (has prioridade_base and incidencia_geral)
    const { data: matrixRows } = await supabase
      .from("curriculum_matrix")
      .select("subtema, prioridade_base, incidencia_geral")
      .ilike("tema", `%${trimmed}%`)
      .eq("ativo", true)
      .order("prioridade_base", { ascending: false })
      .limit(8);

    if (matrixRows && matrixRows.length >= 2) {
      const seen = new Set<string>();
      const items: SubtopicItem[] = [];
      for (const r of matrixRows) {
        if (seen.has(r.subtema)) continue;
        seen.add(r.subtema);
        items.push({
          name: r.subtema,
          priority: assignPriorityFromScore(r.prioridade_base, r.incidencia_geral),
        });
      }
      if (items.length >= 2) {
        return respond({ subtopics: items.slice(0, 6), source: "matrix" });
      }
    }

    // 3. Fallback: AI with priority
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return respond({ subtopics: [], source: "none" });
    }

    const prompt = `Você é um especialista em provas de residência médica brasileira.

Para o tema "${trimmed}", liste entre 4 e 6 subtemas mais cobrados em provas de residência.

Para cada subtema, classifique a prioridade:
- "high": cai com muita frequência em provas, é tema clássico
- "medium": cai com frequência moderada
- "low": cai ocasionalmente, mas é relevante

REGRAS:
- Apenas subtemas objetivos e relevantes para prova
- NÃO incluir dosagens, posologias ou condutas emergenciais detalhadas
- Cada subtema: máximo 5 palavras
- Retorne APENAS JSON válido

Responda em JSON:
{"subtopics": [{"name": "subtema", "priority": "high|medium|low"}, ...]}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0,
      }),
    });

    if (!resp.ok) {
      console.warn("AI subtopic suggestion failed:", resp.status);
      return respond({ subtopics: [], source: "none" });
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.subtopics)) {
          const items: SubtopicItem[] = parsed.subtopics
            .filter((s: any) => s && typeof s.name === "string" && s.name.trim())
            .map((s: any) => ({
              name: s.name.trim(),
              priority: ["high", "medium", "low"].includes(s.priority) ? s.priority : "medium",
            }))
            .slice(0, 6);
          return respond({ subtopics: items, source: "ai" });
        }
      } catch { /* fall through */ }
    }

    return respond({ subtopics: [], source: "none" });
  } catch (e) {
    console.error("suggest-mnemonic-subtopics error:", e);
    return new Response(JSON.stringify({ subtopics: [], source: "none" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function assignPriorityFromScore(
  prioridade_base: number | null,
  incidencia_geral: string | null,
): "high" | "medium" | "low" {
  // Use prioridade_base (1-10 scale) as primary signal
  const p = prioridade_base ?? 5;
  if (p >= 8) return "high";
  if (p >= 5) return "medium";

  // Also check incidencia_geral text
  const inc = (incidencia_geral || "").toLowerCase();
  if (inc.includes("alta") || inc.includes("muito")) return "high";
  if (inc.includes("média") || inc.includes("moderada")) return "medium";

  return "low";
}

function respond(body: { subtopics: SubtopicItem[]; source: string }) {
  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  body.subtopics.sort((a, b) => order[a.priority] - order[b.priority]);

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
