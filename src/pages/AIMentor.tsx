import { useMemo, useState, useEffect, useRef, forwardRef } from "react";
import { Sparkles, Brain, Mic, ArrowRight, Zap, GraduationCap, ChevronRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AgentChat from "@/components/agents/AgentChat";
import CinematicAvatar from "@/components/agents/CinematicAvatar";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import {
  PedagogicalMissionHero,
  PEDAGOGICAL_STAGES,
  deriveStagesFromBlockTypes,
} from "@/components/tutor/pedagogical/PedagogicalMissionHero";
import { extractInlineTutorBlocks } from "@/lib/tutor/extractInlineBlocks";
import {
  evaluateProtocolCompliance,
  buildComplementPrompt,
  logComplianceTelemetry,
} from "@/lib/tutor/protocolCompliance";

import { cn } from "@/lib/utils";

const quickActions = [
  { label: "🩺 Sessão Completa", prompt: "Iniciar uma sessão completa de estudo sobre o meu material. Siga rigorosamente as 4 mensagens: 1. Caso + Leigo + Fisiopato; 2. Técnico + Aplicação; 3. Conduta + Fluxograma; 4. Resumo + Recall.", icon: "🩺" },
  { label: "🔬 Raciocínio Clínico", prompt: "Quais são os diagnósticos diferenciais e o raciocínio clínico para os sinais e sintomas do meu material?", icon: "🔬" },
  { label: "💊 Farmacologia", prompt: "Faça uma comparação detalhada dos fármacos e condutas terapêuticas do meu material.", icon: "💊" },
  { label: "🧠 Modo Feynman", prompt: "Explique o tema central do meu material usando o Modo Feynman: primeiro para um leigo, depois aprofunde tecnicamente.", icon: "🧠" },
  { label: "📌 Pontos de Prova", prompt: "Quais as pegadinhas e os pontos mais cobrados em provas sobre este tema?", icon: "📌" },
];

const suggestions = [
  "Endocardite Bacteriana",
  "Protocolo de Sepse 2024",
  "GGO na Radiologia Tórax",
  "Conduta em AVC Isquêmico",
  "Antibióticos na UTI Adulto"
];

const TutorPremiumHero = ({ onSend, initialValue, onInputValueChange }: { onSend: (p: string) => void; initialValue?: string; onInputValueChange?: (v: string) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || "Doutor";
  const [inputValue, setInputValue] = useState(initialValue || "");
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (initialValue) {
      setInputValue(initialValue);
    }
  }, [initialValue]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSend(inputValue);
    }
  };

  return (
    <div className="relative min-h-[60vh] flex flex-col items-center justify-center pt-12 pb-20 px-6 overflow-hidden">
      {/* Back button */}
      <button
        onClick={() => navigate("/dashboard")}
        className="absolute top-4 left-4 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest backdrop-blur-md transition-all"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      {/* Cinematic Background Atmosphere */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient from-primary/10 via-transparent to-transparent opacity-40" />
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-violet-600/10 blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-primary/10 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center space-y-10">
        
        {/* IA Protagonista - Large Animated Avatar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative group"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 to-violet-500/30 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000" />
          <CinematicAvatar 
            isSpeaking={false} 
            className="w-40 h-40 sm:w-48 sm:h-48 rounded-[40px] border-2 border-white/10 shadow-2xl shadow-primary/20 float-gentle"
          />
          <div className="absolute -bottom-2 -right-2 bg-primary p-2 rounded-2xl shadow-lg border-4 border-[#050508] animate-bounce-subtle">
            <Zap className="h-5 w-5 text-white fill-current" />
          </div>
        </motion.div>

        {/* Personalized Greeting */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <EnaflixBadge type="ia" className="scale-110" />
            <div className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Tutor IA V2 Ativo</span>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tighter leading-tight">
            Olá, <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40">{firstName} 👋</span>
          </h1>
          <p className="text-xl sm:text-2xl text-white/50 font-medium tracking-tight">
            O que vamos <span className="text-primary font-bold">dominar</span> hoje?
          </p>
        </motion.div>

        {/* Premium Input Area */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="w-full max-w-3xl relative"
        >
          <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 via-violet-500/20 to-primary/20 rounded-[32px] blur-xl opacity-20 group-hover:opacity-50 transition duration-1000" />
          
          <div className="relative group/input">
            <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl rounded-[28px] sm:rounded-[32px] border border-white/10 group-hover/input:border-primary/40 transition-all duration-500 shadow-2xl" />
            
            <div className="relative flex flex-col sm:flex-row items-center p-2 sm:p-3 pl-4 sm:pl-8 gap-2">
              <div className="flex items-center w-full flex-1">
                <Brain className="h-6 w-6 text-primary/60 mr-4 hidden sm:block" />
                <input 
                  value={inputValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputValue(val);
                    onInputValueChange?.(val);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="bg-transparent border-0 outline-none flex-1 text-white placeholder:text-white/20 text-base sm:text-xl py-4 sm:py-5 min-w-0"
                  placeholder="Ex: 'Quais os critérios de Duke para Endocardite?'"
                  id="tutor-premium-input"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto pr-2 pb-2 sm:pb-0">
                 <button className="hidden sm:flex p-4 rounded-2xl hover:bg-white/5 text-white/40 hover:text-white transition-all">
                   <Mic className="h-6 w-6" />
                 </button>
                 
                 <Enaflix3DButton 
                   size="lg" 
                   glow 
                   onClick={handleSend}
                   className="h-12 sm:h-16 flex-1 sm:flex-initial px-6 sm:px-8 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 group/btn"
                   disabled={!inputValue.trim()}
                 >
                   <span>Estudar Agora</span>
                   <Zap className="h-5 w-5 group-hover/btn:scale-110 transition-transform fill-current" />
                 </Enaflix3DButton>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Intelligent Suggestions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="flex flex-wrap justify-center gap-3 pt-4"
        >
          {suggestions.map((sug) => (
            <button 
              key={sug}
              onClick={() => {
                setInputValue(sug);
                onInputValueChange?.(sug);
                setSelectedSuggestion(sug);
                // Dar foco no input após selecionar chip para melhor UX
                document.getElementById('tutor-premium-input')?.focus();
              }}
              className={cn(
                "px-5 py-2.5 rounded-2xl border transition-all duration-300 backdrop-blur-md shadow-lg text-sm font-bold",
                (selectedSuggestion === sug || inputValue === sug)
                  ? "bg-primary/20 border-primary text-primary scale-105"
                  : "bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10"
              )}
            >
              {sug}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

/**
 * Bridge entre AgentChat e o hero pedagógico.
 * Deriva missão atual, progresso e etapas a partir das mensagens do tutor,
 * varrendo blocos cognitivos JSON embutidos.
 */
const PedagogicalHeaderBridge = ({
  messages,
  conversationId,
  onRetry,
}: {
  messages: { role: string; content: string }[];
  conversationId?: string | null;
  onRetry?: (prompt: string) => void;
}) => {
  const lastValidatedRef = useRef<string>("");

  const { mission, stages, progress, lastAssistant, complianceScore } = useMemo(() => {
    const assistant = messages.filter((m) => m.role === "assistant");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const seen = new Set<string>();
    const combined = assistant.map((m) => m.content).join("\n\n");
    for (const m of assistant) {
      try {
        const { blocks } = extractInlineTutorBlocks(m.content);
        blocks.forEach((b) => seen.add(b.type));
      } catch {
        /* noop */
      }
    }
    const stages = deriveStagesFromBlockTypes(seen, combined);
    const doneCount = stages.filter((s) => s.status === "done").length;
    const progress = (doneCount / PEDAGOGICAL_STAGES.length) * 100;

    const mission =
      lastUser?.content?.slice(0, 80)?.trim() || "Sessão Pedagógica ENAZIZI";

    const lastAssistant = assistant[assistant.length - 1]?.content || "";
    const complianceScore = Math.round((doneCount / PEDAGOGICAL_STAGES.length) * 100);

    return { mission, stages, progress, lastAssistant, complianceScore };
  }, [messages]);

  // Compliance validator + auto-retry (max 1 per assistant message)
  useEffect(() => {
    if (!lastAssistant || lastAssistant === lastValidatedRef.current) return;
    if (lastAssistant.length < 400) return; // streaming partial — wait
    lastValidatedRef.current = lastAssistant;
    const report = evaluateProtocolCompliance(lastAssistant);
    logComplianceTelemetry({ conversationId, topic: mission, report });
    if (report.shouldRetry && onRetry) {
      onRetry(buildComplementPrompt(report));
    }
  }, [lastAssistant, conversationId, mission, onRetry]);

  if (messages.length <= 1) return null;

  return (
    <PedagogicalMissionHero
      missionTitle={mission}
      missionSubtitle={`Protocolo 15 fases · Compliance ${complianceScore}%`}
      stages={stages}
      progress={progress}
      estimatedMinutes={Math.max(2, Math.round((100 - progress) / 8))}
      feynmanActive
      recallActive
    />
  );
};

console.error("🔥 BUILD_FORENSE", {
  component: "AIMentor.tsx",
  timestamp: Date.now(),
  version: "FORENSE_V1"
});
const AIMentor = forwardRef<HTMLDivElement, any>((props, ref) => {
  console.log("[AIMentor] Rendering with ref:", !!ref);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTopic = searchParams.get("topic") || "";
  const initialSessionId = searchParams.get("session") || searchParams.get("conversationId") || "";
  const autoStartProcessed = useRef(false);
  
  const onSendRef = useRef<((prompt: string) => void) | null>(null);
  const [hasStarted, setHasStarted] = useState(!!initialSessionId); // Começa iniciado se já tiver ID de sessão
  const [isCinematicLoading, setIsCinematicLoading] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(initialTopic || null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialSessionId || null);

  useEffect(() => {
    console.debug("[AIMentor] URL params updated:", { initialTopic, initialSessionId, hasStarted });
    
    // Se temos um tópico mas ainda não iniciamos, dispara o fluxo
    if (initialTopic && !hasStarted && !autoStartProcessed.current) {
      console.debug("[AIMentor] topic detected in URL, starting auto-flow:", initialTopic);
      autoStartProcessed.current = true;
      
      // Limpa os parâmetros da URL IMEDIATAMENTE para evitar duplicidade no refresh
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete("topic");
      const newRelativePathQuery = window.location.pathname + (newParams.toString() ? "?" + newParams.toString() : "");
      window.history.replaceState(null, "", newRelativePathQuery);
      
      handleStart(`Quero estudar: ${initialTopic}`);
    } 
    // Se temos apenas sessão, já marcamos como iniciado (evita hero screen)
    else if (initialSessionId && !hasStarted && !autoStartProcessed.current) {
      console.debug("[AIMentor] session detected in URL, bypassing hero");
      autoStartProcessed.current = true;
      setHasStarted(true);
      setActiveConversationId(initialSessionId);
      
      // Limpa os parâmetros de sessão
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete("session");
      newParams.delete("conversationId");
      const newRelativePathQuery = window.location.pathname + (newParams.toString() ? "?" + newParams.toString() : "");
      window.history.replaceState(null, "", newRelativePathQuery);
    }
  }, [initialTopic, initialSessionId, hasStarted]);

  const handleStart = (prompt: string) => {
    setPendingPrompt(prompt);
    setIsCinematicLoading(true);
    // Reduzi o delay para 800ms para ser mais ágil
    setTimeout(() => {
      setHasStarted(true);
      setIsCinematicLoading(false);
    }, 800);
  };

  return (
    <div ref={ref} data-testid="tutor-page" className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[#050508] text-white">
      {/* Global Cinematic Background */}
      <EnaflixBackgroundFX intensity="medium" />

      <div className="relative z-10 w-full">
        <AnimatePresence>
          {isCinematicLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] animate-pulse" />
                <CinematicAvatar isSpeaking={true} className="w-48 h-48 rounded-[48px] border-2 border-primary/40 shadow-[0_0_50px_rgba(var(--primary),0.3)]" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary animate-pulse">Iniciando Sincronização Cognitiva</span>
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="h-1 w-1 rounded-full bg-primary" />
                  <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1 w-1 rounded-full bg-primary" />
                  <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1 w-1 rounded-full bg-primary" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <motion.div
              key="hero"
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <TutorPremiumHero 
                onSend={handleStart} 
                initialValue={pendingPrompt || ""} 
                onInputValueChange={(v) => setPendingPrompt(v)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex flex-col pt-16 lg:pt-20 pb-20 lg:pb-0 overflow-x-hidden"
            >
              <div className="flex-1 w-full max-w-[1600px] min-w-0 mx-auto flex flex-col px-0 sm:px-6 lg:px-12 overflow-x-hidden">
                <div className="flex-1 relative flex flex-col min-w-0 w-full max-w-full lg:rounded-t-[40px] border-t border-x border-white/10 bg-black/60 backdrop-blur-[120px] shadow-2xl overflow-hidden transition-all duration-700">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />
                  
                  {(() => { console.error("🔥 GERAR_AULA_REAL :: ARQUIVO=AIMentor.tsx :: RENDER=AgentChat"); return null; })()}
                  <AgentChat
                    title="ENAZIZI Cognitive Engine"
                    subtitle="Núcleo de Inteligência Médica Premium"
                    icon={<Sparkles className="h-6 w-6 text-primary animate-pulse" />}
                    welcomeMessage="🩺 Sessão pedagógica ativa. Vou guiar você por uma jornada estruturada: Introdução → Leigo → Técnico → Clínico → Recall → Questões → Resumo Feynman. Qual será nossa missão de hoje?"
                    placeholder="Continue sua missão… (ex: 'aprofunde a fisiopatologia da ICC')"
                    functionName="mentor-chat"
                    quickActions={quickActions}
                    onSendRef={onSendRef}
                    initialPrompt={pendingPrompt || undefined}
                    initialConversationId={activeConversationId}
                    topic={searchParams.get("topic") || searchParams.get("sc_topic")}
                    specialty={searchParams.get("specialty")}
                    subtopic={searchParams.get("subtopic")}
                    hideUploadsPicker
                    pedagogicalHeader={({ messages }) => (
                      <PedagogicalHeaderBridge
                        messages={messages}
                        onRetry={(p) => onSendRef.current?.(p)}
                      />
                    )}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Decorative elements */}
      {!hasStarted && (
        <div className="fixed bottom-12 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="flex items-center gap-8 px-8 py-4 rounded-full bg-white/5 border border-white/5 backdrop-blur-xl opacity-30">
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
               <Brain className="h-4 w-4" /> Cognitive Engine v5
             </div>
             <div className="w-[1px] h-4 bg-white/10" />
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
               <GraduationCap className="h-4 w-4" /> 15k+ Questões Mapeadas
             </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AIMentor;
