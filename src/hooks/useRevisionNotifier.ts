import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { generateRecommendations } from "@/lib/studyEngine";
import { useCoreData } from "@/hooks/useCoreData";

/**
 * Checks for pending reviews, streak risk, study engine recommendations
 * on mount, then shows toast + browser notifications once per session.
 */
export function useRevisionNotifier() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { permission, sendNotification, requestPermission } = usePushNotifications();
  const { data: coreData } = useCoreData();
  const hasNotified = useRef(false);
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? "1900-01-01T00:00:00Z";

  useEffect(() => {
    if (!user || !coreData || hasNotified.current) return;

    const check = async () => {
      // Request notification permission on first visit (non-blocking)
      if (permission === "default") {
        requestPermission();
      }

      const today = new Date().toISOString().slice(0, 10);

      const [pendingRes, gamifRes] = await Promise.all([
        supabase
          .from("revisoes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pendente")
          .gt("created_at", resetAt)
          .lte("data_revisao", today),
        supabase
          .from("user_gamification")
          .select("current_streak, last_activity_date")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      hasNotified.current = true;

      // 1. Pending reviews notification
      const pendingCount = pendingRes.count || 0;
      if (pendingCount > 0) {
        toast({
          title: `📚 ${pendingCount} revisão(ões) pendente(s)!`,
          description: "Revise agora para manter o conhecimento fresco.",
          duration: 8000,
        });

        sendNotification(`📚 ${pendingCount} revisão(ões) pendente(s)!`, {
          body: "Revise agora para manter o conhecimento fresco.",
          tag: "revision-pending",
        });
      }

      // 2. Streak risk notification
      const gamif = gamifRes.data;
      if (gamif && gamif.current_streak >= 3) {
        const lastDate = gamif.last_activity_date;
        if (lastDate) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().slice(0, 10);

          if (lastDate === yesterdayStr) {
            setTimeout(() => {
              toast({
                title: `🔥 Streak de ${gamif.current_streak} dias em risco!`,
                description: "Complete uma atividade hoje para não perder sua sequência.",
                duration: 10000,
              });

              sendNotification(`🔥 Streak de ${gamif.current_streak} dias em risco!`, {
                body: "Complete uma atividade hoje para não perder sua sequência.",
                tag: "streak-risk",
              });
            }, 3000);
          }
        }
      }

      // 3. Study Engine — topic-specific notifications
      try {
        const engineResult = await generateRecommendations({ userId: user.id, coreData });
        const recs = engineResult.recommendations;
        
        // High-priority error review notification
        const errorRec = recs.find(r => r.type === "error_review" && r.priority >= 70);
        if (errorRec) {
          setTimeout(() => {
            toast({
              title: `⚠️ Tema recorrente: "${errorRec.topic}"`,
              description: errorRec.reason,
              duration: 8000,
            });

            sendNotification(`⚠️ Tema recorrente: "${errorRec.topic}"`, {
              body: errorRec.reason,
              tag: "error-review",
            });
          }, 6000);
        }

        // Clinical practice gap notification
        const clinicalRec = recs.find((r: any) => r.type === "clinical");
        if (clinicalRec && !errorRec) {
          setTimeout(() => {
            toast({
              title: `🩺 ${clinicalRec.topic}`,
              description: clinicalRec.reason,
              duration: 8000,
            });

            sendNotification(`🩺 ${clinicalRec.topic}`, {
              body: clinicalRec.reason,
              tag: "clinical-gap",
            });
          }, 6000);
        }
      } catch (e) {
        console.error("[RevisionNotifier] Error fetching recommendations:", e);
      }
    };

    const timer = setTimeout(check, 2000);
    return () => clearTimeout(timer);
  }, [user, coreData, resetAt, toast, permission, sendNotification, requestPermission]);
}
