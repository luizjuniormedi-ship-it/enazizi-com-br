// Tutor V2 — Sprint 1
// Edge function de enriquecimento de contexto adaptativo.
//
// Responsabilidade: dado um user_id + mensagem + sessão atual, retorna
// um payload `adaptive_context` agregando weak_topics, fsrs_due,
// current_mission, prep_index, target_banca, last_orchestrator_decision,
// session_context e bibliography.
//
// IMPORTANTE: Esta função é READ-ONLY no cérebro adaptativo.
// Não altera nada. Pode ser chamada por mentor-chat ou outras edges,
// ou diretamente do cliente (com auth) durante o piloto.
//
// Ativação controlada por feature flag `tutor_adaptive_context_enabled`
// no chamador — esta função sempre responde se chamada.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  user_id?: string;          // opcional; preferir derivar do JWT
  message?: string;
  topic?: string | null;
  subtopic?: string | null;
  conversation_id?: string | null;
  // Toggles para evitar consultas desnecessárias
  include?: {
    weak_topics?: boolean;
    fsrs_due?: boolean;
    mission?: boolean;
    prep_index?: boolean;
    orchestrator?: boolean;
    bibliography?: boolean;
  };
}

interface AdaptiveContext {
  weak_topics: Array<{ tema: string; subtema: string | null; vezes_errado: number }>;
  fsrs_due: Array<{ id: string; topic: string | null; due_at: string | null }>;
  current_mission: {
    plan_date: string;
    objective: string | null;
    phase: string | null;
    completed: number;
    total: number;
    pending_tasks: Array<{ title: string; task_type: string; topic: string | null }>;
  } | null;
  prep_index: {
    score: number;
    prep_index: number | null;
    chance_score: number | null;
    accuracy: number;
  } | null;
  target_banca: string | null;
  last_orchestrator_decision: Record<string, unknown> | null;
  session_context: { topic: string | null; subtopic: string | null } | null;
  meta: {
    generated_at: string;
    source: "tutor-context-builder";
    flags_evaluated: Record<string, boolean>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Resolver user_id via JWT do chamador (preferencial)
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (jwt) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      userId = userData?.user?.id ?? null;
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!userId && body.user_id) userId = body.user_id; // fallback (server-to-server)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Autenticação obrigatória." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const include = {
      weak_topics: true,
      fsrs_due: true,
      mission: true,
      prep_index: true,
      orchestrator: true,
      bibliography: true, // Habilitado para RAG
      ...(body.include ?? {}),
    };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    
    // Buscar Bibliografia RAG se solicitado
    let bibliography: any[] = [];
    if (include.bibliography) {
      try {
        const { data: profile } = await admin.from("profiles").select("organization_id").eq("user_id", userId).single();
        const orgId = profile?.organization_id;
        
        const { data: chunks } = await admin
          .from("rag_chunks")
          .select(`
            content, page_number,
            rag_documents!inner(title, file_name)
          `)
          .eq("organization_id", orgId)
          .eq("rag_documents.is_published", true)
          .ilike("content", `%${body.topic || body.message || ""}%`)
          .limit(3);
          
        bibliography = (chunks || []).map(c => ({
          text: c.content,
          file: (c.rag_documents as any)?.title || (c.rag_documents as any)?.file_name,
          page: c.page_number
        }));
      } catch (e) {
        console.warn("RAG Context fetch failed:", e);
      }
    }

    const ctx: AdaptiveContext = {
      weak_topics: [],
      fsrs_due: [],
      current_mission: null,
      prep_index: null,
      target_banca: null,
      last_orchestrator_decision: null,
      session_context: { topic: body.topic ?? null, subtopic: body.subtopic ?? null },
      bibliography, // Injetado aqui
      meta: {
        generated_at: new Date().toISOString(),
        source: "tutor-context-builder",
        flags_evaluated: include as Record<string, boolean>,
      },
    };

    // Banca alvo (perfil)
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("target_exam, target_banca, faculdade")
        .eq("user_id", userId)
        .maybeSingle();
      ctx.target_banca =
        (profile as { target_exam?: string; target_banca?: string } | null)?.target_exam ??
        (profile as { target_banca?: string } | null)?.target_banca ??
        null;
    } catch (e) {
      console.warn("target_banca lookup failed:", e);
    }

    // Banco de erros (top 5 por tema, opcionalmente filtrando pelo tema corrente)
    if (include.weak_topics) {
      try {
        let q = admin
          .from("error_bank")
          .select("tema, subtema, vezes_errado, categoria_erro")
          .eq("user_id", userId)
          .order("vezes_errado", { ascending: false })
          .limit(8);
        if (body.topic) q = q.ilike("tema", `%${body.topic}%`);
        const { data } = await q;
        ctx.weak_topics =
          (data as Array<{ tema: string; subtema: string | null; vezes_errado: number }>) ?? [];
      } catch (e) {
        console.warn("weak_topics lookup failed:", e);
      }
    }

    // FSRS due (cards vencidos do tema)
    // Loop 4B-fix-2: lê fsrs_cards (tabela real); user_fsrs_cards não existe.
    if (include.fsrs_due) {
      const nowIso = new Date().toISOString();
      let q = admin
        .from("fsrs_cards")
        .select("id, card_type, card_ref_id, due, stability, difficulty, reps, lapses")
        .eq("user_id", userId)
        .lte("due", nowIso)
        .order("due", { ascending: true })
        .limit(5);
      if (body.topic) q = q.ilike("card_ref_id", `%${body.topic}%`);
      const { data, error } = await q;
      if (error) {
        console.warn("[tutor-context-builder] fsrs_cards lookup failed:", error.message);
        ctx.fsrs_due = [];
      } else {
        ctx.fsrs_due = (data ?? []).map((row: any) => ({
          id: row.id,
          topic: row.card_ref_id ?? null,
          card_type: row.card_type,
          due_at: row.due,
          stability: row.stability,
          difficulty: row.difficulty,
          reps: row.reps,
          lapses: row.lapses,
        }));
      }
    }

    // Missão do dia (daily_plans + daily_plan_tasks)
    if (include.mission) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: plan } = await admin
          .from("daily_plans")
          .select("id, plan_date, objective, phase, completed_count, total_blocks")
          .eq("user_id", userId)
          .eq("plan_date", today)
          .maybeSingle();
        if (plan) {
          const planRow = plan as {
            id: string;
            plan_date: string;
            objective: string | null;
            phase: string | null;
            completed_count: number | null;
            total_blocks: number | null;
          };
          const { data: tasks } = await admin
            .from("daily_plan_tasks")
            .select("title, task_type, topic")
            .eq("daily_plan_id", planRow.id)
            .eq("completed", false)
            .order("ordem", { ascending: true })
            .limit(5);
          ctx.current_mission = {
            plan_date: planRow.plan_date,
            objective: planRow.objective,
            phase: planRow.phase,
            completed: planRow.completed_count ?? 0,
            total: planRow.total_blocks ?? 0,
            pending_tasks:
              (tasks as Array<{ title: string; task_type: string; topic: string | null }>) ?? [],
          };
        }
      } catch (e) {
        console.warn("mission lookup failed:", e);
      }
    }

    // Prep Index / approval_scores
    if (include.prep_index) {
      try {
        const { data: scores } = await admin
          .from("approval_scores")
          .select("score, prep_index, chance_score, accuracy")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (scores && scores.length > 0) {
          const s = scores[0] as {
            score: number;
            prep_index: number | null;
            chance_score: number | null;
            accuracy: number;
          };
          ctx.prep_index = {
            score: s.score,
            prep_index: s.prep_index,
            chance_score: s.chance_score,
            accuracy: s.accuracy,
          };
        }
      } catch (e) {
        console.warn("prep_index lookup failed:", e);
      }
    }

    // Última decisão do orchestrator
    if (include.orchestrator) {
      try {
        const { data: decision } = await admin
          .from("assistant_decisions")
          .select("decision_type, decision_output, justification, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (decision && decision.length > 0) {
          ctx.last_orchestrator_decision = decision[0] as Record<string, unknown>;
        }
      } catch (e) {
        console.warn("orchestrator lookup failed:", e);
      }
    }

    return new Response(JSON.stringify(ctx), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tutor-context-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
