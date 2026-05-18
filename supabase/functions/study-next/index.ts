import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient, corsHeaders } from "../_shared/unified-core.ts";
import { 
  BASE_SCORES, 
  ScoringContext, 
  scoreReview, 
  scoreFSRS, 
  scoreError, 
  scoreDailyTask, 
  scoreFreeStudy,
  scoreImageQuiz,
  scoreMnemonic,
  buildJustification,
  getApprovalZone,
  decideMnemonicMode
} from "../_shared/study-next-scoring.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    const userId = user.id;

    // 1. GATHER ALL PEDAGOGICAL CONTEXT IN PARALLEL
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const [
      revRes, 
      fsrsRes,
      errorRes, 
      planRes,
      predRes,
      sysFlags,
      visualStats,
      mnemonicStats,
      imageQuizCount
    ] = await Promise.all([
      // Pending reviews
      supabase.from("revisoes").select("id, temas_estudados(tema), prioridade, risco_esquecimento, data_revisao").eq("user_id", userId).eq("status", "pendente").lte("data_revisao", today).limit(5),
      // FSRS cards
      supabase.from("fsrs_cards").select("*").eq("user_id", userId).lte("due", now).order("due", { ascending: true }).limit(5),
      // Error bank
      supabase.from("error_bank").select("tema, subtema, vezes_errado, categoria_erro, updated_at").eq("user_id", userId).eq("dominado", false).order("vezes_errado", { ascending: false }).limit(5),
      // Daily plan
      supabase.from("daily_plan_tasks").select("*").eq("user_id", userId).eq("completed", false).limit(2),
      // Approval prediction
      supabase.from("approval_predictions").select("approval_probability").eq("user_id", userId).maybeSingle(),
      // System flags
      supabase.from("system_flags").select("flag_key, enabled"),
      // Visual weakness (real data from performance_metrics or analytics)
      supabase.from("performance_metrics").select("topic, accuracy_rate, questions_answered").eq("user_id", userId).eq("discipline", "Visual").limit(10),
      // Mnemonic utility
      supabase.from("mnemonic_feedback").select("topic, utility").eq("user_id", userId).limit(20),
      // Available image quiz questions
      supabase.from("questions").select("id", { count: 'exact', head: true }).eq("mode", "image")
    ]);

    const approvalScore = Math.round((predRes.data?.approval_probability || 0.65) * 100);
    const recoveryActive = sysFlags.data?.find(f => f.flag_key === "adaptive_recovery_mode")?.enabled || false;
    const contentLocked = (approvalScore < 50) || (sysFlags.data?.find(f => f.flag_key === "force_content_lock")?.enabled || false);
    
    const ctx: ScoringContext = {
      approvalScore,
      approvalZone: getApprovalZone(approvalScore),
      recoveryActive,
      contentLocked,
      missionActive: true, // Assuming active for now
      sessionMinutes: null,
      examProximityDays: null,
      now,
      today,
      imageQuizAvailable: imageQuizCount.count || 0,
      visualWeaknesses: visualStats.data?.map(v => ({
        imageType: v.topic,
        accuracy: v.accuracy_rate,
        attemptsCount: v.questions_answered,
        trend: "stable"
      })) || [],
      mnemonicUtility: [] // Would need more complex aggregation
    };

    const candidates: any[] = [];

    // --- SCORE REVIEWS ---
    if (revRes.data) {
      for (const rev of revRes.data) {
        candidates.push({
          type: "review",
          title: `Revisar: ${(rev.temas_estudados as any)?.tema}`,
          description: "Risco de esquecimento detectado pelo sistema de revisão.",
          targetId: rev.id,
          estimatedMinutes: 10,
          priorityScore: scoreReview(rev as any, ctx),
          targetType: "revisao"
        });
      }
    }

    // --- SCORE FSRS CARDS ---
    if (fsrsRes.data) {
      for (const card of fsrsRes.data) {
        candidates.push({
          type: "review",
          title: "FSRS Flashcard",
          description: "Revisão otimizada pelo algoritmo SuperMemo-like.",
          targetId: card.id,
          estimatedMinutes: 2,
          priorityScore: scoreFSRS(card as any, ctx),
          targetType: "fsrs"
        });
      }
    }

    // --- SCORE ERRORS ---
    if (errorRes.data) {
      for (const err of errorRes.data) {
        candidates.push({
          type: "error_review",
          title: `Blindar: ${err.tema}`,
          description: `Você errou este tema ${err.vezes_errado} vezes. Vamos corrigir?`,
          targetId: err.tema,
          estimatedMinutes: 15,
          priorityScore: scoreError(err as any, ctx),
          contextPayload: { subtema: err.subtema }
        });

        // Add Mnemonic candidate if it's a memorization topic
        const mScore = scoreMnemonic([err as any], ctx);
        if (mScore.score > 0) {
          const mDecision = decideMnemonicMode(err.tema);
          candidates.push({
            type: "mnemonic",
            title: `Mnemônico: ${err.tema}`,
            description: "Reforço visual para temas de difícil memorização.",
            targetId: err.tema,
            estimatedMinutes: 5,
            priorityScore: mScore.score,
            contextPayload: { 
              topic: err.tema, 
              subtopic: err.subtema,
              mnemonicMode: mDecision.mode,
              preferredStyle: mDecision.preferredStyle
            }
          });
        }
      }
    }

    // --- SCORE DAILY TASKS ---
    if (planRes.data) {
      for (const task of planRes.data) {
        candidates.push({
          type: "daily_task",
          title: `Missão: ${task.topic || task.specialty}`,
          description: `Seu plano para hoje: ${task.subtopic || 'avançar no cronograma'}.`,
          targetId: task.id,
          estimatedMinutes: task.estimated_minutes || 20,
          priorityScore: scoreDailyTask(task as any, ctx)
        });
      }
    }

    // --- SCORE IMAGE QUIZ ---
    const iqScore = scoreImageQuiz(errorRes.data as any || [], ctx);
    if (iqScore.score > 0) {
      candidates.push({
        type: "image_quiz",
        title: "Quiz Multimodal",
        description: `Treino intensivo de interpretação: ${iqScore.bestTopic?.tema || 'Diagnóstico Visual'}.`,
        targetId: iqScore.bestTopic?.tema,
        estimatedMinutes: 10,
        priorityScore: iqScore.score,
        contextPayload: { imageType: iqScore.targetImageType }
      });
    }

    // --- FREE STUDY (Last resort) ---
    candidates.push({
      type: "free_study",
      title: "Explorar temas",
      description: "Você está em dia! Que tal adiantar um novo assunto?",
      estimatedMinutes: 30,
      priorityScore: scoreFreeStudy(ctx)
    });

    // 2. SORT AND PICK
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    const top = candidates[0];

    const justification = buildJustification({
      reviews: revRes.data?.length || 0,
      fsrs: fsrsRes.data?.length || 0,
      errors: errorRes.data?.length || 0,
      tasks: planRes.data?.length || 0,
    }, ctx, top.type);

    return new Response(JSON.stringify({
      success: true,
      recommendation: top,
      justification,
      alternativeActions: candidates.slice(1, 4),
      adaptiveState: {
        approvalScore: ctx.approvalScore,
        approvalZone: ctx.approvalZone,
        recoveryActive: ctx.recoveryActive,
        contentLocked: ctx.contentLocked,
        pendingReviews: (revRes.data?.length || 0) + (fsrsRes.data?.length || 0),
        weakTopicsCount: errorRes.data?.length || 0,
        examProximityDays: ctx.examProximityDays
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[study-next] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
