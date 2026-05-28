/**
 * Fase 1B — Garante que todo flashcard pessoal (is_global=false) tenha
 * um fsrs_card vinculado imediatamente após o insert.
 *
 * Diferente de ensureFsrsCard() (fire-and-forget), esta versão:
 *  - É bloqueante (await);
 *  - Loga sucesso/falha de forma estruturada;
 *  - Em caso de falha, reverte o flashcard pessoal criado (rollback);
 *  - Nunca aplica a globais (is_global=true) — biblioteca permanece intacta.
 *
 * Logs:
 *  [PERSONAL_FLASHCARD_CREATED]
 *  [PERSONAL_FLASHCARD_FSRS_OK]
 *  [PERSONAL_FLASHCARD_FSRS_FAIL]
 *  [PERSONAL_FLASHCARD_ORPHAN_BLOCKED]
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnsurePersonalFsrsParams {
  userId: string;
  flashcardId: string;
  source: "flashcards_bank" | "flashcard_generator" | "mnemonic_studio" | "tutor_v2";
}

export interface EnsurePersonalFsrsResult {
  ok: boolean;
  error?: string;
}

export async function ensurePersonalFlashcardFsrs(
  params: EnsurePersonalFsrsParams,
): Promise<EnsurePersonalFsrsResult> {
  const { userId, flashcardId, source } = params;
  console.info("[PERSONAL_FLASHCARD_CREATED]", { userId, flashcardId, source });

  try {
    const { error } = await supabase.from("fsrs_cards").insert({
      user_id: userId,
      card_type: "flashcard",
      card_ref_id: flashcardId,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      due: new Date().toISOString(),
      last_review: null,
    });

    if (error) {
      // 23505 = unique_violation → fsrs_card já existe, considerar sucesso.
      if ((error as any).code === "23505") {
        console.info("[PERSONAL_FLASHCARD_FSRS_OK]", {
          flashcardId,
          source,
          note: "already_exists",
        });
        return { ok: true };
      }
      throw error;
    }

    console.info("[PERSONAL_FLASHCARD_FSRS_OK]", { flashcardId, source });
    return { ok: true };
  } catch (err: any) {
    console.error("[PERSONAL_FLASHCARD_FSRS_FAIL]", {
      flashcardId,
      source,
      error: err?.message ?? String(err),
    });

    // Rollback: remove o flashcard pessoal recém-criado para não gerar órfão.
    try {
      const { error: delErr } = await supabase
        .from("flashcards")
        .delete()
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .eq("is_global", false);
      if (delErr) {
        console.error("[PERSONAL_FLASHCARD_ORPHAN_BLOCKED]", {
          flashcardId,
          source,
          rollback: "failed",
          error: delErr.message,
        });
      } else {
        console.warn("[PERSONAL_FLASHCARD_ORPHAN_BLOCKED]", {
          flashcardId,
          source,
          rollback: "ok",
        });
      }
    } catch (rbErr: any) {
      console.error("[PERSONAL_FLASHCARD_ORPHAN_BLOCKED]", {
        flashcardId,
        source,
        rollback: "exception",
        error: rbErr?.message ?? String(rbErr),
      });
    }

    return { ok: false, error: err?.message ?? "fsrs_link_failed" };
  }
}

/**
 * Versão batch: aplica ensurePersonalFlashcardFsrs em paralelo.
 * Retorna quantos foram OK e quais falharam (já com rollback aplicado).
 */
export async function ensurePersonalFlashcardsFsrsBatch(
  userId: string,
  flashcardIds: string[],
  source: EnsurePersonalFsrsParams["source"],
): Promise<{ okCount: number; failed: string[] }> {
  const results = await Promise.all(
    flashcardIds.map((id) =>
      ensurePersonalFlashcardFsrs({ userId, flashcardId: id, source }),
    ),
  );
  const failed = flashcardIds.filter((_, i) => !results[i].ok);
  return { okCount: results.length - failed.length, failed };
}
