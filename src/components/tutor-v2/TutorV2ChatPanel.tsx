import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTutorV2Messages } from "./hooks/useTutorV2Messages";
import { TutorV2Service } from "./services/TutorV2Service";
import TutorV2MessageList from "./TutorV2MessageList";
import TutorV2Input from "./TutorV2Input";
import TutorV2Actions from "./TutorV2Actions";
import { AlertCircle } from "lucide-react";

interface TutorV2ChatPanelProps {
  session: any;
}

export default function TutorV2ChatPanel({ session }: TutorV2ChatPanelProps) {
  const { user } = useAuth();
  const { messages, isLoading, addMessage, setMessages } = useTutorV2Messages(session.id);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping || !user) return;
    setError(null);

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
    
    // addMessage handles DB insert, but we also update local state for real-time feel
    // if addMessage insert is successful, the subscription will handle the duplicate if not careful
    // Actually, useTutorV2Messages subscription will add the "real" one.
    
    setIsTyping(true);

    // Optimistic: append user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        tutor_session_id: session.id,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      // Persist user message
      await addMessage(user.id, "user", text);

      // Call AI
      const response = await TutorV2Service.sendMessage(session.id, text);

      if (!response?.ok) throw new Error(response?.error || "Erro na resposta da IA");

      // Append assistant reply directly (don't depend on realtime)
      if (response.content) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: response.content,
            tutor_session_id: session.id,
            user_id: user.id,
            created_at: new Date().toISOString(),
            metadata: response.flashcardSuggestion
              ? { flashcard_suggestion: response.flashcardSuggestion }
              : undefined,
          },
        ]);
      }
    } catch (err: any) {
      console.error("Error in Tutor V2 chat:", err);
      setError(err.message || "Ocorreu um erro ao processar sua mensagem.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      <header className="p-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-md z-10">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <div className="h-4 w-4 bg-indigo-500 rounded-md" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-white/90">
                {session.topic || "Sessão de Estudo"}
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                {session.specialty || "Clínica Médica"} • V2 Active
              </p>
            </div>
          </div>
          <TutorV2Actions session={session} />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth pb-20">
        <div className="max-w-4xl mx-auto w-full p-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <TutorV2MessageList messages={messages} isTyping={isTyping} />
          )}

          {error && (
            <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </div>

      <footer className="p-6 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl absolute bottom-0 w-full">
        <TutorV2Input onSendMessage={handleSendMessage} disabled={isTyping} />
      </footer>
    </div>
  );
}
