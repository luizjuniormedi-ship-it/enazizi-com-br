import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { emitShadowEvent } from "@/lib/shadowAdaptive";
import { dispatchPedagogicalEvent } from "@/lib/events";
import {
  Rating,
  State,
  reviewCard,
  createNewCard,
  cardFromRow,
  cardToRow,
  retrievability,
  type Card,
} from "@/lib/fsrs";

export { Rating, State };

export interface FsrsCardRow {
  id: string;
  card_type: string;
  card_ref_id: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: number;
  due: string;
  last_review: string | null;
}

/**
 * Hook that provides FSRS operations for any module.
 * Manages fsrs_cards table and review logging.
 */
export function useFsrs() {
  const { user } = useAuth();

  /** Get or create an FSRS card for a given item. */
  const getOrCreateCard = useCallback(
    async (cardType: string, cardRefId: string): Promise<{ row: FsrsCardRow; card: Card }> => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("fsrs_cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("card_type", cardType)
        .eq("card_ref_id", cardRefId)
        .maybeSingle();

      if (existing) {
        return { row: existing as unknown as FsrsCardRow, card: cardFromRow(existing) };
      }

      const newCard = createNewCard();
      const fields = cardToRow(newCard);

      const { data: inserted, error } = await supabase
        .from("fsrs_cards")
        .insert({
          user_id: user.id,
          card_type: cardType,
          card_ref_id: cardRefId,
          ...fields,
        })
        .select()
        .single();

      if (error) throw error;
      return { row: inserted as unknown as FsrsCardRow, card: newCard };
    },
    [user]
  );

  /** Review a card with a given rating. Returns the updated card. */
  const review = useCallback(
    async (
      cardType: string,
      cardRefId: string,
      rating: Rating,
      durationMs?: number
    ): Promise<Card> => {
      if (!user) throw new Error("Not authenticated");

      const { row, card } = await getOrCreateCard(cardType, cardRefId);
      const now = new Date();
      const result = reviewCard(card, rating, now);
      const fields = cardToRow(result.card);

      // Update card state
      await supabase
        .from("fsrs_cards")
        .update({ ...fields, updated_at: now.toISOString() })
        .eq("id", row.id);

      // Log the review
      await supabase.from("fsrs_review_log").insert({
        user_id: user.id,
        card_id: row.id,
        rating,
        scheduled_days: result.log.scheduled_days,
        elapsed_days: result.log.elapsed_days,
        review_duration_ms: durationMs ?? null,
        reviewed_at: now.toISOString(),
      });

      // Shadow Adaptive Layer (Fase 3A) — observacional. NÃO altera fila FSRS.
      void emitShadowEvent({
        module: "flashcard",
        event: "flashcard_review_completed",
        topic: cardType,
        durationMs: durationMs ?? null,
        extra: { rating, ref_id: cardRefId },
      });

      // Standardized pedagogical event
      dispatchPedagogicalEvent('fsrs_reviewed', {
        cardId: row.id,
        rating,
        interval: result.log.scheduled_days
      });

      return result.card;
    },
    [user, getOrCreateCard]
  );

  /** Get all due cards for a given type. */
  const getDueCards = useCallback(
    async (cardType: string): Promise<FsrsCardRow[]> => {
      if (!user) return [];

      const now = new Date().toISOString();
      const { data } = await supabase
        .from("fsrs_cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("card_type", cardType)
        .lte("due", now)
        .order("due", { ascending: true });

      return (data || []) as unknown as FsrsCardRow[];
    },
    [user]
  );

  /** Get FSRS stats for a user: total cards, due count, avg retrievability. */
  const getStats = useCallback(
    async (): Promise<{
      totalCards: number;
      dueCount: number;
      avgRetrievability: number;
      byType: Record<string, { total: number; due: number }>;
    }> => {
      if (!user)
        return { totalCards: 0, dueCount: 0, avgRetrievability: 0, byType: {} };

      const { data: allCards } = await supabase
        .from("fsrs_cards")
        .select("card_type, stability, elapsed_days, state, due")
        .eq("user_id", user.id);

      const cards = allCards || [];
      const now = new Date();
      let totalR = 0;
      let rCount = 0;
      const byType: Record<string, { total: number; due: number }> = {};

      for (const c of cards as any[]) {
        const type = c.card_type;
        if (!byType[type]) byType[type] = { total: 0, due: 0 };
        byType[type].total++;

        const isDue = new Date(c.due) <= now;
        if (isDue) byType[type].due++;

        if (c.state === State.Review && c.stability > 0) {
          const elapsed =
            (now.getTime() - new Date(c.due).getTime() + c.elapsed_days * 86400000) /
            86400000;
          totalR += retrievability(Math.max(elapsed, 0), c.stability);
          rCount++;
        }
      }

      return {
        totalCards: cards.length,
        dueCount: Object.values(byType).reduce((s, v) => s + v.due, 0),
        avgRetrievability: rCount > 0 ? totalR / rCount : 1,
        byType,
      };
    },
    [user]
  );

  return { review, getOrCreateCard, getDueCards, getStats, Rating };
}
