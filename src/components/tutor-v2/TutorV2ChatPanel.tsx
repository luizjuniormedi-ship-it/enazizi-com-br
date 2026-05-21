import { useState, useRef, useEffect } from "react";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import { useAuth } from "@/hooks/useAuth";
import { useTutorV2Messages } from "./hooks/useTutorV2Messages";
import { TutorV2Service } from "./services/TutorV2Service";
import TutorV2MessageList from "./TutorV2MessageList";
import TutorV2Input from "./TutorV2Input";
import TutorV2Actions from "./TutorV2Actions";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { MascotAvatar } from "../mascot/MascotAvatar";
import { MascotBubble } from "../mascot/MascotBubble";
import { useMascotState } from "../mascot/useMascotState";
import { motion } from "framer-motion";



interface TutorV2ChatPanelProps {
  session: any;
}

export default function TutorV2ChatPanel({ session }: TutorV2ChatPanelProps) {
  const { user } = useAuth();
  const { messages, isLoading, addMessage, setMessages } = useTutorV2Messages(session.id);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { state: mascotState, speech: mascotSpeech, triggerInteraction } = useMascotState();


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string, pedagogicalInteraction?: string, newTopic?: string) => {
    const requestId = crypto.randomUUID();
    // [TUTOR_01_SEND_CLICKED]
    console.log(`[TUTOR_01_SEND_CLICKED] requestId=${requestId}`);

    if (!text.trim() || isTyping || !user) {
      console.warn(`[TUTOR] SEND_SKIPPED id=${requestId}`, { text: !!text.trim(), isTyping, user: !!user });
      return;
    }

    // [TUTOR_02_MESSAGE_TEXT]
    console.log(`[TUTOR_02_MESSAGE_TEXT] text="${text.slice(0, 50)}..."`);

    // [TUTOR_03_AUTH_SESSION]
    console.log(`[TUTOR_03_AUTH_SESSION] userId=${user?.id} hasSession=${!!session.id}`);

    setError(null);
    triggerInteraction({ 
      state: 'thinking', 
      type: 'motivation', 
      speech: pedagogicalInteraction === 'continue' ? "Preparando o próximo bloco cognitivo..." : "Analisando seu raciocínio médico..." 
    });

    // Optimistic update
    const tempId = crypto.randomUUID();
    const userMsg = { 
      id: tempId, 
      role: "user", 
      content: text, 
      tutor_session_id: session.id, 
      user_id: user.id,
      created_at: new Date().toISOString()
    };
    
    setIsTyping(true);

    // Optimistic: append user message immediately
    setMessages((prev) => {
      // Evitar duplicata se o realtime já inseriu
      if (prev.some(m => m.id === tempId || (m.role === 'user' && m.content === text && Math.abs(new Date(m.created_at).getTime() - Date.now()) < 2000))) {
        return prev;
      }
      return [
        ...prev,
        {
          id: tempId,
          role: "user",
          content: text,
          tutor_session_id: session.id,
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
      ];
    });

    try {
      // Persist user message
      await addMessage(user.id, "user", text);

      // Call AI
      console.log(`[TUTOR_V3_START_CALL] id=${requestId}`);
      const response = await TutorV2Service.sendMessage(session.id, text, pedagogicalInteraction, newTopic);

      if (!response || (!response.content && !response.answer && !response.message && !response.response)) throw new Error(response?.error || "Erro na resposta da IA");

      // [TUTOR_22_FRONTEND_DATA_RECEIVED]
      console.log("[TUTOR_22_FRONTEND_DATA_RECEIVED] requestId=" + requestId, response);

      const content = response.content || response.answer || response.message || response.response || "";
      // [TUTOR_23_CONTENT_EXTRACTED]
      console.log(`[TUTOR_23_CONTENT_EXTRACTED] contentLen=${content?.length}`, { content });
      if (response?.fallback) {
        toast.warning("O Tutor encontrou instabilidade no provedor de IA. Sua sessão foi preservada. Tente novamente.");
      }
      if (content) {
        // [TUTOR_24_ASSISTANT_MESSAGE_CREATED]
        console.log(`[TUTOR_24_ASSISTANT_MESSAGE_CREATED] id=${requestId}`);
        
        // [TUTOR_25_SET_MESSAGES_CALLED]
        console.log(`[TUTOR_25_SET_MESSAGES_CALLED] id=${requestId}`);

        setMessages((prev) => {
          const alreadyVisible = prev.some((m) => m.role === "assistant" && m.content === content);
          if (alreadyVisible) return prev;
          const newMessages = [
            ...prev,
            {
              id: response.requestId || crypto.randomUUID(),
              role: "assistant",
              content: content,
              tutor_session_id: session.id,
              user_id: user.id,
              created_at: new Date().toISOString(),
              metadata: { 
                fallback_used: !!response.fallback, 
                provider: response.provider,
                currentBlock: response.currentBlock,
                blockTitle: response.blockTitle,
                socraticQuestion: response.socraticQuestion,
                actionsContext: response.actionsContext
              },
            },
          ];
          // [TUTOR_26_MESSAGES_AFTER_APPEND]
          console.log(`[TUTOR_26_MESSAGES_AFTER_APPEND] count=${newMessages.length}`);
          return newMessages;
        });
        
        // Persist assistant message
        console.log(`[TUTOR_V3_PERSIST_ASSISTANT] id=${requestId}`);
        await addMessage(user.id, "assistant", content);
      }
      setLastFailedMessage(null);

      // If questionReview mode is detected, react to it
      if (response?.questionReviewActive) {
        triggerInteraction({
          state: response?.questionReview?.is_correct ? 'success' : 'warning',
          type: 'feedback',
          speech: response?.questionReview?.is_correct ? "Excelente raciocínio!" : "Percebi um ponto de confusão aqui."
        });

        // Emit ALOS Event for Tutor Interaction
        await pedagogicalEventBus.emit({
          event_type: 'tutor_question_answered',
          module: 'tutor',
          source: 'frontend',
          entity_type: 'tutor_session',
          entity_id: session.id,
          study_context: {
            topic: session.topic
          },
          metadata: {
            is_correct: response?.questionReview?.is_correct,
            question_type: response?.questionReview?.question_type,
            student_answer: response?.questionReview?.student_answer
          }
        }, user.id);
      } else {
        triggerInteraction({
          state: 'teaching',
          type: 'explanation'
        });
      }

      console.log("[TUTOR_V2] AI_RESPONSE_RECEIVED", { hasContent: !!content });
    } catch (err: any) {
      console.error("Error in Tutor V2 chat:", err);
      triggerInteraction({ state: 'warning', type: 'alert', speech: "Encontrei uma instabilidade, tente novamente." });
      const friendlyMessage = err.message || "O Tutor encontrou instabilidade no provedor de IA. Sua sessão foi preservada. Tente novamente.";
      setLastFailedMessage(text);
      setError(friendlyMessage);
      toast.error(friendlyMessage);
    } finally {
      setIsTyping(false);
      // [TUTOR_27_LOADING_FALSE]
      console.log(`[TUTOR_27_LOADING_FALSE] id=${requestId}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <header className="p-4 border-b border-white/5 bg-slate-950/60 backdrop-blur-2xl z-20 sticky top-0">
        <div className="max-w-6xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 group">
              <div className="flex-shrink-0">
                <MascotAvatar state="idle" size="sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black uppercase tracking-widest text-white/90">
                    {session.topic || "Sessão de Estudo"}
                  </h1>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter mt-0.5">
                  {session.specialty || "Sessão Premium Ativa"} • Tutor V3 Premium
                </p>
              </div>
            </div>
            <TutorV2Actions session={session} />
          </div>

          {/* Cognitive Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                Estágio Cognitivo: <span className="text-white">{session.currentBlock || 'Exploração'}</span>
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {session.cognitive_progress || 0}% Concluído
              </span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${session.cognitive_progress || 0}%` }}
                className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-400"
              />
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth pb-32 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <MascotAvatar state="thinking" size="md" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recuperando histórico cognitivo...</p>
            </div>
          ) : (
            <TutorV2MessageList 
              messages={messages} 
              isTyping={isTyping} 
              onIncrementalAction={(action) => {
                let prompt = "";
                switch (action) {
                  case 'continue': prompt = "Compreendido, pode prosseguir para o próximo bloco da aula."; break;
                  case 'deepen': prompt = "Gostaria de aprofundar mais este ponto técnico. Pode detalhar?"; break;
                  case 'analogy': prompt = "Pode me dar uma analogia diferente para este conceito?"; break;
                  case 'clinical': prompt = "Me dê um exemplo clínico de plantão real sobre isso."; break;
                  case 'simplify': prompt = "Pode explicar de forma mais simples e didática?"; break;
                  default: prompt = "Próximo bloco.";
                }
                handleSendMessage(prompt, action);
              }}
            />
          )}

          {error && (
            <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-3 animate-slide-up">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
              {lastFailedMessage && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(lastFailedMessage)}
                  disabled={isTyping}
                  className="shrink-0 rounded-xl border border-red-500/30 px-3 py-1 font-black uppercase tracking-widest text-[10px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="p-6 border-t border-white/5 bg-slate-950/90 backdrop-blur-3xl absolute bottom-0 w-full z-20">
        {/* Mascot UI Integrated */}
        <div className="absolute -top-32 right-8 flex flex-col items-end gap-2 pointer-events-none">
          <MascotBubble speech={mascotSpeech} />
          <MascotAvatar state={mascotState} size="lg" className="pointer-events-auto" />
        </div>
        
        <div className="max-w-4xl mx-auto">

          <TutorV2Input onSendMessage={handleSendMessage} disabled={isTyping} />
        </div>
      </footer>
    </div>
  );
}
