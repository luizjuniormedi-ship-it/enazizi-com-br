import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, corsHeaders } from "../_shared/unified-core.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    const userId = user.id;

    // 1. GATHER PEDAGOGICAL CONTEXT
    const today = new Date().toISOString().slice(0, 10);
    const [revRes, errorRes, planRes] = await Promise.all([
      supabase.from("revisoes").select("id, temas_estudados(tema)").eq("user_id", userId).eq("status", "pendente").lte("data_revisao", today).limit(1),
      supabase.from("error_bank").select("tema, vezes_errado").eq("user_id", userId).eq("dominado", false).order("vezes_errado", { ascending: false }).limit(3),
      supabase.from("daily_plan_tasks").select("*").eq("user_id", userId).eq("completed", false).limit(1),
    ]);

    let recommendation: any = {
      type: "free_study",
      title: "Explorar novos temas",
      description: "Você está em dia! Escolha um tema para expandir sua base.",
      estimatedMinutes: 30,
      priorityScore: 10
    };

    let justification = "Não há tarefas urgentes pendentes.";

    // Logic Tree: 1. Daily Task > 2. Error Review > 3. FSRS Due
    if (planRes.data && planRes.data.length > 0) {
      const task = planRes.data[0];
      recommendation = {
        type: "daily_task",
        title: `Missão: ${task.topic || task.specialty}`,
        description: `Continuar seu plano diário: ${task.subtopic || 'Foco em conceitos-chave'}.`,
        targetId: task.id,
        estimatedMinutes: task.estimated_minutes || 20,
        priorityScore: 90
      };
      justification = "Tarefa prioritária do seu plano diário.";
    } else if (errorRes.data && errorRes.data.length > 0) {
      const error = errorRes.data[0];
      recommendation = {
        type: "error_review",
        title: `Recuperar: ${error.tema}`,
        description: `Você errou este tema ${error.vezes_errado} vezes recentemente. Vamos blindar este conhecimento?`,
        targetId: error.tema,
        estimatedMinutes: 15,
        priorityScore: 85
      };
      justification = "Detecção de fragilidade recorrente no Banco de Erros.";
    } else if (revRes.data && revRes.data.length > 0) {
      const rev = revRes.data[0];
      recommendation = {
        type: "review",
        title: `Revisar: ${(rev.temas_estudados as any)?.tema}`,
        description: "Risco de esquecimento detectado pelo algoritmo FSRS.",
        targetId: rev.id,
        estimatedMinutes: 10,
        priorityScore: 80
      };
      justification = "Otimização de memória de longo prazo (FSRS).";
    }

    return new Response(JSON.stringify({
      success: true,
      recommendation,
      justification,
      adaptiveState: {
        pendingReviews: revRes.data?.length || 0,
        weakTopicsCount: errorRes.data?.length || 0,
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});