// tutor-lesson-export: gera exportação NotebookLM/Cinematic/Google Vids/Markdown/TXT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Format = "notebooklm" | "cinematic" | "google_vids" | "markdown" | "txt";

const CINEMATIC_3D_BLOCK = `---
IMPORTANTE — PADRÃO VISUAL OBRIGATÓRIO ENAZIZI/ENAFLIX

Utilize estética cinematográfica 3D estilo Pixar científico.
Priorize animações educacionais fluidas.

A aula deve parecer uma mistura entre:
- documentário Netflix
- Pixar científico
- visualização médica premium
- animação educacional AAA

Requisitos visuais:
- estilo cinematográfico 3D
- visual científico estilo Pixar
- qualidade documentário Netflix
- animações educacionais fluidas
- motion graphics médicos avançados
- anatomia precisa quando for medicina
- luz volumétrica
- profundidade de campo
- câmera dinâmica
- transições suaves
- visual premium

Narração e idioma:
- Idioma obrigatório: Português do Brasil (pt-BR).
- Linguagem técnica e didática.
- Sem termos em inglês desnecessários.
- Citar fontes (Nelson, Sabiston, diretrizes oficiais) quando aplicável.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const lessonId: string | undefined = body?.lesson_id;
    const format = (body?.format ?? "notebooklm") as Format;
    if (!lessonId) return json({ error: "lesson_id required" }, 400);

    const { data: lesson, error } = await userClient
      .from("tutor_lesson_memory")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();
    if (error || !lesson) return json({ error: "lesson_not_found" }, 404);

    const sc = (lesson.structured_content ?? {}) as Record<string, any>;
    if (!sc?.title) {
      return json({ error: "lesson_not_structured" }, 422);
    }

    let content = "";
    let extension = "md";
    let mime = "text/markdown";

    switch (format) {
      case "notebooklm":
        content = renderNotebookLM(lesson, sc);
        break;
      case "cinematic":
        content = renderCinematicPrompt(lesson, sc);
        break;
      case "google_vids":
        content = renderGoogleVidsPrompt(lesson, sc);
        break;
      case "markdown":
        content = renderMarkdown(lesson, sc);
        break;
      case "txt":
        content = renderPlainText(lesson, sc);
        extension = "txt";
        mime = "text/plain";
        break;
      default:
        return json({ error: "invalid_format" }, 400);
    }

    // Padrão cinematográfico 3D obrigatório em todas as exportações
    content = `${content}\n\n${CINEMATIC_3D_BLOCK}\n`;

    const slug = (lesson.title ?? "aula")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60);
    const fileName = `${slug || "aula"}-${format}.${extension}`;

    await admin.from("tutor_lesson_events").insert([{
      lesson_id: lessonId,
      actor_id: user.id,
      event_type: "lesson_exported",
      metadata: { format, file_name: fileName },
    }]);

    return new Response(JSON.stringify({ content, file_name: fileName, mime, format }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: "internal", detail: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bullet(arr?: any[]) {
  if (!arr?.length) return "_(não informado)_";
  return arr.map((x: any) => `- ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n");
}

function renderNotebookLM(lesson: any, sc: any): string {
  const ctx = sc.student_context ?? {};
  const chapters = (sc.chapters ?? [])
    .map((c: any) => {
      return `### Capítulo ${c.order ?? "?"} — ${c.title ?? ""}
Resumo: ${c.summary ?? "—"}
Narração: ${c.script ?? "—"}
Pontos-chave:
${bullet(c.key_points)}
Sugestão visual: ${c.visual_suggestion ?? "—"}`;
    })
    .join("\n\n");

  return `# ${sc.title ?? lesson.title ?? "Aula"}

## Identificação
- Disciplina: ${sc.subject ?? lesson.subject ?? "—"}
- Tema: ${sc.topic ?? lesson.topic ?? "—"}
- Subtema: ${sc.subtopic ?? lesson.subtopic ?? "—"}
- Nível: ${sc.difficulty_level ?? "—"}
- Duração estimada: ${sc.estimated_duration_minutes ?? "—"} min

## Contexto do Aluno
- Dúvida principal: ${ctx.main_question ?? "—"}
- Dificuldades conhecidas: ${(ctx.known_difficulties ?? []).join(", ") || "—"}
- Erros recentes: ${(ctx.recent_errors ?? []).join(", ") || "—"}
- Risco FSRS: ${ctx.fsrs_risk ?? "—"}
- Objetivo: ${ctx.learning_goal ?? "—"}

## Objetivos de Aprendizagem
${bullet(sc.learning_objectives)}

## Explicação Leiga
${sc.lay_explanation ?? "—"}

## Explicação Técnica
${sc.technical_explanation ?? "—"}

## Relevância Clínica/Prova
${sc.clinical_or_exam_relevance ?? "—"}

## Roteiro da Videoaula
${chapters || "_(sem capítulos)_"}

## Pontos de Prova
${bullet(sc.exam_traps)}

## Pegadinhas Comuns
${bullet(sc.common_mistakes)}

## Perguntas de Fixação
${(sc.quiz_questions ?? [])
  .map(
    (q: any, i: number) =>
      `${i + 1}. ${q.question}\n   - Alternativas: ${(q.alternatives ?? []).join(" | ")}\n   - Resposta: ${q.correct_answer}\n   - Comentário: ${q.explanation}`,
  )
  .join("\n\n") || "_(sem questões)_"}

## Flashcards Sugeridos
${(sc.flashcard_suggestions ?? [])
  .map((f: any) => `- **${f.front}** → ${f.back}`)
  .join("\n") || "_(sem flashcards)_"}

## Prompt para NotebookLM
${sc.notebooklm_prompt ?? "Gerar resumo, áudio guiado e mapa de estudo fiel ao conteúdo acima."}

## Prompt para Vídeo GPT-5 / Google Vids
${sc.cinematic_video_prompt || sc.gemini_video_prompt || "—"}

## Referências
${bullet(sc.references)}

## Observações de Qualidade
${bullet(sc.quality_notes)}
`;
}

function renderCinematicPrompt(lesson: any, sc: any): string {
  const vs = sc.video_script ?? {};
  return `# Prompt — Vídeo Cinematográfico (OpenAI GPT-5)

Título: ${sc.title ?? lesson.title}
Tema: ${sc.subject ?? "—"} / ${sc.topic ?? "—"}
Duração-alvo: ${sc.estimated_duration_minutes ?? 8} minutos

## Briefing
${sc.gemini_video_prompt ?? "Crie uma videoaula didática em pt-BR sobre o conteúdo abaixo."}

## Abertura
${vs.opening ?? "—"}

## Narração principal
${vs.narration ?? sc.technical_explanation ?? "—"}

## Cenas (scene-by-scene)
${(vs.scene_by_scene ?? []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n") || "—"}

## Encerramento
${vs.closing ?? "—"}

## Restrições
- Português do Brasil.
- Sem termos em inglês desnecessários.
- Visuais limpos, sem texto em overlay sobreposto a rosto humano.
- Citar fontes ao final.
`;
}

function renderGoogleVidsPrompt(lesson: any, sc: any): string {
  const chapters = (sc.chapters ?? [])
    .map(
      (c: any) =>
        `Cena ${c.order}: "${c.title}" — visual: ${c.visual_suggestion ?? "—"}; narração: ${c.script ?? "—"}`,
    )
    .join("\n");
  return `# Prompt — Google Vids

Aula: ${sc.title ?? lesson.title}
Estilo: didático, ENAZIZI/ENAFLIX, foco em estudante de medicina/concurso pt-BR.
Duração: ${sc.estimated_duration_minutes ?? 8} min.

${sc.google_vids_prompt ?? "Monte um vídeo educacional com narração, cards e cenas conforme o roteiro abaixo."}

## Roteiro de cenas
${chapters || "—"}

## CTA final
${sc.video_script?.closing ?? "—"}
`;
}

function renderMarkdown(lesson: any, sc: any): string {
  return renderNotebookLM(lesson, sc); // mesmo formato amigável
}

function renderPlainText(lesson: any, sc: any): string {
  return renderNotebookLM(lesson, sc).replace(/[#*_`>]/g, "");
}
