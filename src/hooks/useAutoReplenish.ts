import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const THRESHOLD = 5;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown per topic

/**
 * Hook that monitors unanswered questions for a given topic.
 * When remaining drops below THRESHOLD, triggers background generation.
 */
export function useAutoReplenish(activeTopic: string | null) {
  const { user } = useAuth();
  const generating = useRef<Set<string>>(new Set());
  const lastGenerated = useRef<Map<string, number>>(new Map());

  const checkAndReplenish = useCallback(async (topic: string) => {
    if (!user || !topic || topic === "all") return;
    if (generating.current.has(topic)) return;

    // Cooldown check
    const lastTime = lastGenerated.current.get(topic) || 0;
    if (Date.now() - lastTime < COOLDOWN_MS) return;

    try {
      // Count total questions for this topic
      const { count: totalCount } = await supabase
        .from("questions_bank")
        .select("id", { count: "exact", head: true })
        .or(`user_id.eq.${user.id},is_global.eq.true`)
        .eq("review_status", "approved")
        .eq("topic", topic);

      // Count answered questions for this topic
      const { data: answeredData } = await supabase
        .from("practice_attempts")
        .select("question_id, questions_bank!inner(topic)")
        .eq("user_id", user.id)
        .eq("questions_bank.topic", topic);

      const answeredIds = new Set((answeredData || []).map(a => a.question_id));
      const remaining = (totalCount || 0) - answeredIds.size;

      if (remaining > THRESHOLD) return;

      // Trigger background generation
      generating.current.add(topic);
      lastGenerated.current.set(topic, Date.now());

      console.log(`[AutoReplenish] ${topic}: ${remaining} restantes, gerando mais...`);

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await supabase.functions.invoke("question-generator", {
        body: {
          messages: [
            {
              role: "user",
              content: `Gere 10 questões ORIGINAIS de ${topic} nível REVALIDA/ENAMED com casos clínicos variados. Formato ENARE com 4 alternativas.`,
            },
          ],
          saveToBank: true,
          generationContext: {
            specialty: topic,
            topic: topic,
            objective: "practice",
            difficulty: "medium",
            language: "pt-BR",
            source: "auto-replenish",
          },
        },
      });

      if (!response.error) {
        toast({
          title: "🔄 Novas questões geradas!",
          description: `+10 questões de ${topic} adicionadas ao banco.`,
        });
      }
    } catch (err) {
      console.error("[AutoReplenish] Error:", err);
    } finally {
      generating.current.delete(topic);
    }
  }, [user]);

  useEffect(() => {
    if (activeTopic && activeTopic !== "all") {
      checkAndReplenish(activeTopic);
    }
  }, [activeTopic, checkAndReplenish]);

  return { checkAndReplenish };
}
