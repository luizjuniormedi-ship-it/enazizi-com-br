/**
 * useFsrsDueCount
 * ───────────────
 * Hook leve que conta cards FSRS vencidos (`due <= now`) — global ou por tema.
 *
 * Uso típico:
 *   const { totalDue, dueByTopic, isLoading } = useFsrsDueCount();
 *   const dueAqui = dueByTopic(topic ?? "") || 0;
 *
 * NÃO escreve no backend. Apenas leitura agregada para alimentar CTAs.
 *
 * Observações:
 *  - `card_ref_id` é o vínculo com a entidade original (flashcard / mnemônico).
 *    Para mapear card_ref_id → topic, fazemos um join de leitura em
 *    flashcards.tema quando o card_type = 'flashcard'. Mnemônicos e outros
 *    tipos contribuem apenas para o total global (sem map por tema).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FsrsDueResult {
  totalDue: number;
  /** lookup case-insensitive: topic.toLowerCase() → count */
  dueByTopic: (topic: string) => number;
  isLoading: boolean;
}

function normalizeTopic(t: string | null | undefined): string {
  return (t || "").trim().toLowerCase();
}

export function useFsrsDueCount(): FsrsDueResult {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["fsrs-due-count", user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();

      // 1) Cards vencidos do usuário (usa bridge para legados)
      const { data: dueCards } = await supabase
        .from("legacy_fsrs_bridge")
        .select("id, card_ref_id, card_type")
        .eq("user_id", user!.id)
        .lte("due", nowIso);

      const cards = dueCards || [];
      if (cards.length === 0) {
        return { total: 0, byTopic: new Map<string, number>() };
      }

      // 2) Mapear flashcards → tema (para CTA por tópico no Tutor)
      const flashRefIds = cards
        .filter((c) => c.card_type === "flashcard")
        .map((c) => c.card_ref_id);

      const byTopic = new Map<string, number>();

      if (flashRefIds.length > 0) {
        const { data: flashRows } = await supabase
          .from("flashcards")
          .select("id, topic")
          .in("id", flashRefIds);

        const refToTopic = new Map<string, string>();
        for (const f of (flashRows || []) as Array<{ id: string; topic: string | null }>) {
          if (f?.topic) refToTopic.set(f.id, normalizeTopic(f.topic));
        }
        for (const c of cards) {
          if (c.card_type !== "flashcard") continue;
          const topic = refToTopic.get(c.card_ref_id);
          if (!topic) continue;
          byTopic.set(topic, (byTopic.get(topic) || 0) + 1);
        }
      }

      return { total: cards.length, byTopic };
    },
  });

  const data = query.data;
  return {
    totalDue: data?.total ?? 0,
    dueByTopic: (topic: string) => {
      if (!data) return 0;
      return data.byTopic.get(normalizeTopic(topic)) || 0;
    },
    isLoading: query.isLoading,
  };
}
