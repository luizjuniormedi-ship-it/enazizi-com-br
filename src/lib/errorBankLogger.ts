import { supabase } from "@/integrations/supabase/client";
import { ensureFsrsCard } from "@/lib/fsrsAutoCreate";
import { ensurePersonalFlashcardFsrs } from "@/lib/personalFlashcardFsrs";
import { auditRecoveryAttempt } from "./recoveryAudit";

interface LogErrorParams {
  userId: string;
  tema: string;
  subtema?: string;
  tipoQuestao: "objetiva" | "flashcard" | "active-recall" | "discursiva" | "simulado" | "diagnostico";
  conteudo?: string;
  motivoErro?: string;
  categoriaErro?: string;
  dificuldade?: number;
  /** Recovery Loop Sprint-1: id da questão de origem (quando aplicável). */
  questionId?: string;
}

/**
 * Logs a wrong answer to the error_bank table.
 *
 * RECOVERY LOOP SPRINT-1:
 *  - Telemetria [RECOVERY_LOOP_ERROR_LOGGED]
 *  - Persiste error_bank.question_id quando fornecido
 *  - Em novo erro: cria FSRS card do erro (existente) + flashcard pessoal de revisão
 *    + FSRS card do flashcard (novo elo Erro → Flashcard → FSRS)
 *  - Idempotente: nunca duplica flashcard para o mesmo error_bank.id
 */
export async function logErrorToBank(params: LogErrorParams): Promise<void> {
  const {
    userId,
    tema,
    subtema,
    tipoQuestao,
    conteudo,
    motivoErro,
    categoriaErro,
    dificuldade,
    questionId,
  } = params;

  try {
    let query = supabase
      .from("error_bank")
      .select("id, vezes_errado")
      .eq("user_id", userId)
      .eq("tema", tema)
      .eq("tipo_questao", tipoQuestao);

    if (questionId) {
      // Dedup mais forte quando temos a questão real
      query = query.eq("question_id", questionId);
    } else if (conteudo) {
      query = query.eq("conteudo", conteudo.slice(0, 500));
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      await supabase
        .from("error_bank")
        .update({
          vezes_errado: (existing.vezes_errado || 1) + 1,
          updated_at: new Date().toISOString(),
          motivo_erro: motivoErro || undefined,
        })
        .eq("id", existing.id);

      console.info("[RECOVERY_LOOP_ERROR_LOGGED]", {
        userId,
        questionId: questionId ?? null,
        tema,
        tipoQuestao,
        existingError: true,
        newError: false,
        errorId: existing.id,
        vezesErrado: (existing.vezes_errado || 1) + 1,
      });
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("error_bank")
        .insert({
          user_id: userId,
          tema,
          subtema: subtema || null,
          tipo_questao: tipoQuestao,
          conteudo: conteudo?.slice(0, 500) || null,
          motivo_erro: motivoErro || null,
          categoria_erro: categoriaErro || null,
          dificuldade: dificuldade || 3,
          vezes_errado: 1,
          question_id: questionId || null,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        console.warn("[RECOVERY_LOOP_ERROR_INSERT_FAIL]", {
          userId,
          tema,
          error: insertErr?.message,
        });
        return;
      }

      console.info("[RECOVERY_LOOP_ERROR_LOGGED]", {
        userId,
        questionId: questionId ?? null,
        tema,
        tipoQuestao,
        existingError: false,
        newError: true,
        errorId: inserted.id,
        vezesErrado: 1,
      });

      // Elo 1: FSRS do erro (mantém comportamento existente)
      ensureFsrsCard(userId, "erro", inserted.id);

      // Elo 2 (NOVO): Erro → Flashcard pessoal de revisão
      await createRecoveryFlashcard({
        userId,
        errorId: inserted.id,
        questionId,
        tema,
        subtema,
        conteudo,
        motivoErro,
        dificuldade,
      });
    }
  } catch (err) {
    console.error("[RECOVERY_LOOP_FAIL]", err);
  }
}

/**
 * Cria flashcard pessoal de revisão a partir de um erro.
 * Idempotente: se já existe flashcard com metadata.from_error_id == errorId,
 * ou (quando questionId presente) metadata.question_id == questionId, não cria outro.
 */
async function createRecoveryFlashcard(args: {
  userId: string;
  errorId: string;
  questionId?: string;
  tema: string;
  subtema?: string;
  conteudo?: string;
  motivoErro?: string;
  dificuldade?: number;
}): Promise<void> {
  const { userId, errorId, questionId, tema, subtema, conteudo, motivoErro, dificuldade } = args;

  try {
    // Idempotência 1: já há flashcard para este erro?
    const { data: byError } = await supabase
      .from("flashcards")
      .select("id")
      .eq("user_id", userId)
      .eq("is_global", false)
      .contains("metadata", { from_error_id: errorId })
      .maybeSingle();

    if (byError?.id) {
      console.info("[RECOVERY_LOOP_FLASHCARD_SKIP]", {
        reason: "already_exists_for_error",
        errorId,
        flashcardId: byError.id,
      });
      return;
    }

    // Idempotência 2: já há flashcard para esta questão?
    if (questionId) {
      const { data: byQuestion } = await supabase
        .from("flashcards")
        .select("id")
        .eq("user_id", userId)
        .eq("is_global", false)
        .contains("metadata", { question_id: questionId })
        .maybeSingle();

      if (byQuestion?.id) {
        console.info("[RECOVERY_LOOP_FLASHCARD_SKIP]", {
          reason: "already_exists_for_question",
          questionId,
          flashcardId: byQuestion.id,
        });
        return;
      }
    }

    const isRichQuestion = conteudo && conteudo.trim().length > 50;
    
    // RECOVERY LOOP P0 — Chamar Edge Function para geração Premium
    try {
      const { data, error } = await supabase.functions.invoke("generate-recovery-flashcard", {
        body: {
          errorId,
          questionId,
          topic: tema,
          context: conteudo,
          userAnswer: motivoErro, // Se o motivoErro for o que o aluno marcou
          reason: motivoErro,
        }
      });

      if (error || !data?.success) {
        console.warn("[RECOVERY_LOOP_PREMIUM_FAIL] Falling back to legacy generation", error);
        // Legacy Fallback (para não perder o card se a IA falhar)
        const front = isRichQuestion 
          ? `Conceito falho em ${tema}:\nQual o ponto-chave que explica o erro no caso clínico apresentado?`
          : `Revisão de erro em ${tema}${subtema ? ` / ${subtema}` : ""}`;
        const back = motivoErro?.trim() || `Reveja o conceito de ${tema}.`;

        const { data: inserted, error: insErr } = await supabase
          .from("flashcards")
          .insert({
            user_id: userId,
            question: front,
            answer: back,
            explanation: motivoErro || null,
            topic: tema,
            subtopic: subtema || null,
            difficulty: dificuldade || 3,
            is_global: false,
            source: "error_bank",
            generation_method: "recovery_loop_v1_fallback",
            metadata: {
              from_error_id: errorId,
              question_id: questionId || null,
              source: "error_bank",
              created_by: "recovery_loop_v1_fallback",
            },
          })
          .select("id")
          .single();

        if (inserted) {
          await ensurePersonalFlashcardFsrs({
            userId,
            flashcardId: inserted.id,
            source: "flashcards_bank",
          });
        }
      }
    } catch (err) {
      console.error("[RECOVERY_LOOP_INVOKE_EXCEPTION]", err);
    }

  } catch (err: any) {
    console.error("[RECOVERY_LOOP_FLASHCARD_EXCEPTION]", {
      errorId,
      message: err?.message ?? String(err),
    });
  }
}
