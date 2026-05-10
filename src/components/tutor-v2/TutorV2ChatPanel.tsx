import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import TutorV2MessageList from "./TutorV2MessageList";
import TutorV2Input from "./TutorV2Input";
import TutorV2Actions from "./TutorV2Actions";
import { useAuth } from "@/hooks/useAuth";

interface TutorV2ChatPanelProps {
  session: any;
}

export default function TutorV2ChatPanel({ session }: TutorV2ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.id) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("tutor_messages")
        .select("*")
        .eq("tutor_session_id", session.id)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
    };

    fetchMessages();
  }, [session?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg = { role: "user", content: text, tutor_session_id: session.id, user_id: user?.id };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("tutor-v2-chat", {
        body: { sessionId: session.id, message: text }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      <header className="p-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-md z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-white/90">{session.topic}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{session.specialty}</p>
          </div>
          <TutorV2Actions session={session} />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        <TutorV2MessageList messages={messages} isTyping={isTyping} />
      </div>

      <footer className="p-4 border-t border-white/5 bg-slate-950/80">
        <TutorV2Input onSendMessage={handleSendMessage} disabled={isTyping} />
      </footer>
    </div>
  );
}
