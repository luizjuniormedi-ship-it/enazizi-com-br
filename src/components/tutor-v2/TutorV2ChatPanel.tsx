import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTutorV2Messages } from "./hooks/useTutorV2Messages";
import { TutorV2Service } from "./services/TutorV2Service";
import TutorV2MessageList from "./TutorV2MessageList";
import TutorV2Input from "./TutorV2Input";
import TutorV2Actions from "./TutorV2Actions";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
      const response = await TutorV2Service.sendMessage(session.id, text);

      if (!response?.ok) throw new Error(response?.error || "Erro na resposta da IA");
      if (response?.fallback) {
        toast.warning("O Tutor encontrou instabilidade no provedor de IA. Sua sessão foi preservada. Tente novamente.");
      }
      setLastFailedMessage(null);

      // We DON'T manually append here anymore because the Edge Function should persist 
      // the assistant message to the database, and our Realtime subscription will pick it up.
      // If we manually append AND have Realtime, we'll see duplicates or double-renders.
      console.log("[TUTOR_V2] AI_RESPONSE_RECEIVED", { hasContent: !!response.content });
    } catch (err: any) {
      console.error("Error in Tutor V2 chat:", err);
      const friendlyMessage = err.message || "O Tutor encontrou instabilidade no provedor de IA. Sua sessão foi preservada. Tente novamente.";
      setLastFailedMessage(text);
      setError(friendlyMessage);
      toast.error(friendlyMessage);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <header className="p-4 border-b border-white/5 bg-slate-950/60 backdrop-blur-2xl z-20 sticky top-0">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-lg group-hover:border-indigo-500/50 transition-all">
              <div className="h-5 w-5 bg-indigo-500 rounded-lg animate-cinematic-pulse-core" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black uppercase tracking-widest text-white/90">
                  {session.topic || "Sessão de Estudo"}
                </h1>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter mt-0.5">
                {session.specialty || "Sessão Premium Ativa"} • Protocolo Feynman
              </p>
            </div>
          </div>
          <TutorV2Actions session={session} />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth pb-32 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full p-6 space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
                <div className="h-6 w-6 bg-indigo-500 rounded-lg animate-spin" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recuperando histórico cognitivo...</p>
            </div>
          ) : (
            <TutorV2MessageList messages={messages} isTyping={isTyping} />
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
        <div className="max-w-4xl mx-auto">
          <TutorV2Input onSendMessage={handleSendMessage} disabled={isTyping} />
        </div>
      </footer>
    </div>
  );
}
