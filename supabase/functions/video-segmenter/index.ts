// video-segmenter — FASE 1 Adaptive Video
// Gera segmentos (microblocos) para uma videoaula usando Lovable AI.
// Fluxo: dado video_lesson_id → busca metadados → IA propõe segmentos
// (introdução/fisiopatologia/clínica/diagnóstico/tratamento/pegadinhas/resumo)
// com timestamps estimados → grava em lesson_segments com ai_generated=true.
//
// Governança:
//  - Apenas admins podem chamar (verifica role).
//  - Nunca apaga segmentos manuais existentes (ai_generated=false).
//  - Idempotente: se já há segmentos IA, retorna existentes (a menos que force=true).
//  - Falhas voltam 200 com error legível para o frontend exibir e manter player atual.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  video_lesson_id: string;
  force?: boolean;
}

interface Segment {
  ordem: number;
  title: string;
  segment_type: string;
  start_second: number;
  end_second: number;
  summary: string;
  key_points: string[];
}

const SEGMENTER_PROMPT = `Você é um especialista em educação médica.
Dada uma videoaula médica (título, especialidade, objetivos e duração total em segundos),
divida-a em microblocos pedagógicos seguindo a ordem clínica natural quando aplicável:
introducao, fisiopatologia, clinica, diagnostico, tratamento, pegadinhas, resumo.

REGRAS OBRIGATÓRIAS:
- Idioma: pt-BR estrito.
- Nunca use termos em inglês fora siglas médicas consagradas.
- Cada segmento deve ter título curto (máx 60 chars), resumo (80-200 chars),
  e 2-5 pontos-chave acionáveis.
- Timestamps em segundos (start_second/end_second), cobrindo 0..duração total sem sobreposição.
- Mínimo 3, máximo 8 segmentos.
- Retorne APENAS via tool call, sem texto extra.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Auth obrigatória." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas admins podem segmentar." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body.video_lesson_id) {
      return new Response(JSON.stringify({ error: "video_lesson_id obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar videoaula
    const { data: lesson, error: lErr } = await admin
      .from("ai_video_lessons")
      .select("id, title, specialty, topic, subtopic, description, learning_objectives, duration_seconds, tutor_lesson_summary, notebooklm_export_text")
      .eq("id", body.video_lesson_id)
      .maybeSingle();

    if (lErr || !lesson) {
      return new Response(JSON.stringify({ error: "Videoaula não encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verificar se já tem segmentos IA (idempotente)
    if (!body.force) {
      const { data: existing } = await admin
        .from("lesson_segments")
        .select("id, ordem")
        .eq("lesson_id", body.video_lesson_id)
        .eq("ai_generated", true)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({
          status: "already_segmented",
          message: "Videoaula já possui segmentos gerados por IA. Use force=true para regenerar.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const duration = (lesson as { duration_seconds: number | null }).duration_seconds ?? 600;
    const userPrompt = `Videoaula:
Título: ${(lesson as { title: string }).title}
Especialidade: ${(lesson as { specialty: string | null }).specialty ?? "—"}
Tema: ${(lesson as { topic: string | null }).topic ?? "—"} / ${(lesson as { subtopic: string | null }).subtopic ?? "—"}
Descrição: ${(lesson as { description: string | null }).description ?? "—"}
Objetivos: ${JSON.stringify((lesson as { learning_objectives: string[] | null }).learning_objectives ?? [])}
Duração total: ${duration} segundos
Resumo do roteiro (Tutor): ${((lesson as { tutor_lesson_summary: string | null }).tutor_lesson_summary ?? "").slice(0, 1500)}
Roteiro NotebookLM: ${((lesson as { notebooklm_export_text: string | null }).notebooklm_export_text ?? "").slice(0, 2500)}

Divida em microblocos seguindo as regras do system prompt.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SEGMENTER_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_segments",
            description: "Emite os microblocos pedagógicos da videoaula.",
            parameters: {
              type: "object",
              properties: {
                segments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ordem: { type: "integer" },
                      title: { type: "string" },
                      segment_type: {
                        type: "string",
                        enum: ["introducao","fisiopatologia","clinica","diagnostico","tratamento","pegadinhas","resumo","generic"],
                      },
                      start_second: { type: "integer" },
                      end_second: { type: "integer" },
                      summary: { type: "string" },
                      key_points: { type: "array", items: { type: "string" } },
                    },
                    required: ["ordem","title","segment_type","start_second","end_second","summary","key_points"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["segments"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_segments" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos Lovable AI esgotados." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("[video-segmenter] AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na IA. Player permanece com vídeo completo." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou segmentos válidos." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: { segments: Segment[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Falha ao parsear segmentos." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!parsed.segments || parsed.segments.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum segmento gerado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Se force=true, remove apenas segmentos IA antigos (preserva manuais)
    if (body.force) {
      await admin.from("lesson_segments")
        .delete()
        .eq("lesson_id", body.video_lesson_id)
        .eq("ai_generated", true);
    }

    const rows = parsed.segments.map((s) => ({
      lesson_id: body.video_lesson_id,
      ordem: s.ordem,
      title: s.title,
      segment_type: s.segment_type,
      start_second: Math.max(0, s.start_second),
      end_second: Math.max(s.start_second + 1, Math.min(s.end_second, duration)),
      summary: s.summary,
      key_points: s.key_points,
      ai_generated: true,
    }));

    const { data: inserted, error: insErr } = await admin
      .from("lesson_segments")
      .insert(rows)
      .select("id, ordem, title, segment_type, start_second, end_second");

    if (insErr) {
      console.error("[video-segmenter] insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      status: "segmented",
      segments_count: inserted?.length ?? 0,
      segments: inserted ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[video-segmenter] exception", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
