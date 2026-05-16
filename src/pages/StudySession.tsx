import { useState, useRef, useEffect, useCallback, memo, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { logErrorToBank } from "@/lib/errorBankLogger";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { 
  BookOpen, Brain, HelpCircle, MessageSquare, BarChart3,
  Send, Loader2, GraduationCap, Play, RotateCcw, Stethoscope,
  FileText, AlertTriangle, TrendingUp, Target, Maximize2, Minimize2, MoreVertical, Sparkles, ChevronLeft
} from "lucide-react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

import StudyStyleSelector, { type StudyMode } from "@/components/tutor/StudyStyleSelector";
import TutorChatPanel from "@/components/study/TutorChatPanel";
import OperationalHub from "@/components/study/OperationalHub";
import { parseStudySignal, type StudySignal } from "@/lib/parseStudySignal";
import { flushStudyCompleteQueue } from "@/lib/studyCompleteRetryQueue";

console.error("🔥 BUILD_FORENSE", {
  component: "StudySession.tsx",
  timestamp: Date.now(),
  version: "FORENSE_FINAL_V2"
});

type Phase = "start" | "style-select" | "performance" | "lesson" | "active-recall" | "questions" | "discussion" | "discursive" | "scoring" | "reinforcement";
type Msg = { role: "user" | "assistant"; content: string };

interface SpecialtyScore {
  name: string;
  score: number;
  total: number;
}

interface PerformanceData {
  totalQuestions: number;
  correctAnswers: number;
  level: string;
  readiness: number;
  specialties: SpecialtyScore[];
  weakTopics: string[];
  studiedTopics: string[];
}

const INITIAL_PERFORMANCE: PerformanceData = {
  totalQuestions: 0,
  correctAnswers: 0,
  level: "Iniciante",
  readiness: 0,
  specialties: [
    { name: "Cardiologia", score: 0, total: 0 },
    { name: "Pneumologia", score: 0, total: 0 },
    { name: "Neurologia", score: 0, total: 0 },
    { name: "Endocrinologia", score: 0, total: 0 },
    { name: "Gastroenterologia", score: 0, total: 0 },
    { name: "Pediatria", score: 0, total: 0 },
    { name: "Ginecologia/Obstetrícia", score: 0, total: 0 },
    { name: "Cirurgia", score: 0, total: 0 },
    { name: "Medicina Preventiva", score: 0, total: 0 },
  ],
  weakTopics: [],
  studiedTopics: [],
};

const StudySessionContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("start");
  const [topic, setTopic] = useState("");

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMsg }],
          topic,
          phase
        })
      });
      
      if (!resp.ok) throw new Error("Erro na resposta do mentor");
      
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content || data.message || "" }]);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro no chat", description: "Não foi possível obter resposta.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const goToPhase = (newPhase: Phase) => setPhase(newPhase);

  const content = (
    <div className="flex h-screen bg-[#050508] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-black/40 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white/40 hover:text-white">
               <ChevronLeft className="h-5 w-5" />
             </Button>
             <div className="h-8 w-px bg-white/5 mx-1" />
             <div>
               <h1 className="text-sm font-bold text-white truncate max-w-[200px]">{topic || "Sessão de Estudo"}</h1>
               <p className="text-[10px] text-primary font-black uppercase tracking-widest">{phase}</p>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("max-w-[85%] rounded-2xl p-4", m.role === "user" ? "bg-primary/10 ml-auto border border-primary/20" : "bg-white/5 mr-auto border border-white/10")}>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <div className="flex items-center gap-2 text-xs text-white/30 animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> Mentor pensando...</div>}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-md">
           <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
              {phase === "questions" && (
                <Button variant="outline" size="sm" className="text-xs whitespace-nowrap border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => goToPhase("discussion")}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Discussão Clínica
                </Button>
              )}
           </div>
           <div className="flex gap-2">
             <Input 
               value={input} 
               onChange={e => setInput(e.target.value)} 
               placeholder="Sua dúvida ou resposta..." 
               className="bg-white/5 border-white/10 text-white"
               onKeyDown={e => e.key === "Enter" && sendMessage()}
             />
             <Button size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()}>
               {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
             </Button>
           </div>
        </div>
      </div>
    </div>
  );

  return content;
};

const StudySession = () => (
  <ErrorBoundary>
    <Suspense fallback={
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 space-y-6">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-black uppercase tracking-widest text-white/80 animate-pulse">SESSÃO DE ESTUDO</h2>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">Sincronizando Ecossistema...</p>
        </div>
      </div>
    }>
      <StudySessionContent />
    </Suspense>
  </ErrorBoundary>
);

export default memo(StudySession);
