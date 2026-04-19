// Tutor V2 — Sprint 6
// Writeback adaptativo: registra eventos pedagógicos em `tutor_events` e,
// quando aplicável e seguro, alimenta `error_bank` (mini-quiz incorreto)
// e `fsrs_cards` (mini-quiz correto reforçado).
//
// Tudo controlado pela flag `tutor_adaptive_writeback_enabled`.
// Se a flag estiver OFF → no-op silencioso (Tutor V1 inalterado).
// Falhas de rede/RLS são engolidas — UI nunca quebra.

import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import type {
  TutorBlockType,
  TutorEventType,
  TutorEventInput,
} from "@/types/tutor";

interface QuizContext {
  conversationId?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  block_type?: TutorBlockType;
  related_message_id?: string | null;
}

interface QuizResultArgs extends QuizContext {
  correct: boolean;
  selectedIndex: number;
  stem?: string;
  correctIndex?: number;
}

interface BlockRenderedArgs extends QuizContext {
  block_type: TutorBlockType;
}

interface NextStepClickArgs extends QuizContext {
  action_kind?: string;
  action_label?: string;
}

export function useTutorAdaptiveSync() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const writebackOn = isEnabled("tutor_adaptive_writeback_enabled");

  // Anti-spam de block_rendered (mesmo block_type+convId em < 5s).
  const lastRenderedRef = useRef<Map<string, number>>(new Map());

  const logEvent = useCallback(
    async (input: TutorEventInput) => {
      if (!writebackOn || !user) return;
      try {
        const row = {
          user_id: user.id,
          event_type: input.event_type,
          conversation_id: input.conversation_id ?? null,
          topic: input.topic ?? null,
          subtopic: input.subtopic ?? null,
          block_type: input.block_type ?? null,
          payload: input.payload ?? {},
          outcome: input.outcome ?? null,
          related_message_id: input.related_message_id ?? null,
        };
        const { error } = await supabase.from("tutor_events").insert([row]);
        if (error) console.warn("[TutorSync] tutor_events insert failed:", error.message);
      } catch (e) {
        console.warn("[TutorSync] logEvent exception:", e);
      }
    },
    [writebackOn, user]
  );

  const logBlockRendered = useCallback(
    async (args: BlockRenderedArgs) => {
      if (!writebackOn) return;
      const key = `${args.conversationId ?? "anon"}::${args.block_type}`;
      const now = Date.now();
      const last = lastRenderedRef.current.get(key) ?? 0;
      if (now - last < 5000) return; // dedupe simples
      lastRenderedRef.current.set(key, now);
      await logEvent({
        event_type: "block_rendered",
        conversation_id: args.conversationId ?? undefined,
        topic: args.topic ?? undefined,
        subtopic: args.subtopic ?? undefined,
        block_type: args.block_type,
        payload: {},
      });
    },
    [writebackOn, logEvent]
  );

  /** Mini-quiz: registra answered + correct/incorrect e alimenta error_bank/fsrs. */
  const logQuizAnswered = useCallback(
    async (args: QuizResultArgs) => {
      if (!writebackOn || !user) return;

      const baseTopic = args.topic ?? null;
      const baseSubtopic = args.subtopic ?? null;

      // 1) Evento pareado: answered + (correct|incorrect)
      const evType: TutorEventType = args.correct
        ? "mini_quiz_correct"
        : "mini_quiz_incorrect";

      await Promise.all([
        logEvent({
          event_type: "mini_quiz_answered",
          conversation_id: args.conversationId ?? undefined,
          topic: baseTopic ?? undefined,
          subtopic: baseSubtopic ?? undefined,
          block_type: "mini_quiz",
          outcome: args.correct ? "correct" : "incorrect",
          payload: {
            selected_index: args.selectedIndex,
            correct_index: args.correctIndex,
          },
          related_message_id: args.related_message_id ?? undefined,
        }),
        logEvent({
          event_type: evType,
          conversation_id: args.conversationId ?? undefined,
          topic: baseTopic ?? undefined,
          subtopic: baseSubtopic ?? undefined,
          block_type: "mini_quiz",
          payload: {
            selected_index: args.selectedIndex,
            correct_index: args.correctIndex,
          },
        }),
      ]);

      // 2) Erro → alimenta error_bank (upsert manual: incrementa vezes_errado).
      if (!args.correct && baseTopic) {
        try {
          const { data: existing } = await supabase
            .from("error_bank")
            .select("id, vezes_errado")
            .eq("user_id", user.id)
            .eq("tema", baseTopic)
            .eq("subtema", baseSubtopic ?? "")
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from("error_bank")
              .update({
                vezes_errado: (existing.vezes_errado ?? 0) + 1,
                updated_at: new Date().toISOString(),
                dominado: false,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("error_bank").insert([
              {
                user_id: user.id,
                tema: baseTopic,
                subtema: baseSubtopic,
                tipo_questao: "objetiva",
                categoria_erro: "tutor_mini_quiz",
                motivo_erro: args.stem ?? null,
                conteudo: args.stem ?? null,
                vezes_errado: 1,
              },
            ]);
          }
        } catch (e) {
          console.warn("[TutorSync] error_bank writeback failed:", e);
        }
      }

      // 3) Acerto com tópico → cria/garante card FSRS leve para reforço futuro.
      //    Não reagenda revisões (isso é responsabilidade do FSRS engine);
      //    apenas garante a presença para que o cérebro adaptativo enxergue.
      if (args.correct && baseTopic) {
        try {
          const cardRef = `tutor::${baseTopic}::${baseSubtopic ?? ""}`.slice(0, 200);
          await supabase
            .from("fsrs_cards")
            .upsert(
              {
                user_id: user.id,
                card_type: "tutor_topic",
                card_ref_id: cardRef,
              },
              { onConflict: "user_id,card_type,card_ref_id", ignoreDuplicates: true }
            );
        } catch (e) {
          console.warn("[TutorSync] fsrs_cards upsert failed:", e);
        }
      }
    },
    [writebackOn, user, logEvent]
  );

  const logNextStepClicked = useCallback(
    async (args: NextStepClickArgs) => {
      if (!writebackOn) return;
      await logEvent({
        event_type: "next_step_clicked",
        conversation_id: args.conversationId ?? undefined,
        topic: args.topic ?? undefined,
        subtopic: args.subtopic ?? undefined,
        block_type: "next_steps",
        payload: {
          action_kind: args.action_kind,
          action_label: args.action_label,
        },
      });
    },
    [writebackOn, logEvent]
  );

  return {
    writebackEnabled: writebackOn,
    logEvent,
    logBlockRendered,
    logQuizAnswered,
    logNextStepClicked,
  };
}
