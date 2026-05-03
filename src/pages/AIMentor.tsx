import { useState } from "react";
import { Sparkles, Brain, Mic, ArrowRight, Zap, GraduationCap, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import AgentChat from "@/components/agents/AgentChat";
import CinematicAvatar from "@/components/agents/CinematicAvatar";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "🩺 Sessão Completa", prompt: "Iniciar uma sessão completa de estudo sobre o meu material. Siga rigorosamente as 4 mensagens: 1. Caso + Leigo + Fisiopato; 2. Técnico + Aplicação; 3. Conduta + Fluxograma; 4. Resumo + Recall.", icon: "🩺" },
  { label: "🔬 Raciocínio Clínico", prompt: "Quais são os diagnósticos diferenciais e o raciocínio clínico para os sinais e sintomas do meu material?", icon: "🔬" },
  { label: "💊 Farmacologia", prompt: "Faça uma comparação detalhada dos fármacos e condutas terapêuticas do meu material.", icon: "💊" },
  { label: "🧠 Modo Feynman", prompt: "Explique o tema central do meu material usando o Modo Feynman: primeiro para um leigo, depois aprofunde tecnicamente.", icon: "🧠" },
  { label: "📌 Pontos de Prova", prompt: "Quais as pegadinhas e os pontos mais cobrados em provas sobre este tema?", icon: "📌" },
];

const suggestions = [
  "ECG na Emergência",
  "Protocolo de Sepse",
  "GGO na Radiologia",
  "Conduta em AVC",
  "Antibióticos na UTI"
];

const TutorPremiumHero = ({ onSend }: { onSend: (p: string) => void }) => {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || "Doutor";
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue("");
    }
  };

  return (
    <div className="relative min-h-[60vh] flex flex-col items-center justify-center pt-12 pb-20 px-6 overflow-hidden">
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
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Sessão Premium Ativa</span>
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
            <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl rounded-[28px] border border-white/10 group-hover/input:border-primary/40 transition-all duration-500 shadow-2xl" />
            
            <div className="relative flex items-center p-2 sm:p-3 pl-6 sm:pl-8">
              <Brain className="h-6 w-6 text-primary/60 mr-4" />
              <input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="bg-transparent border-0 outline-none flex-1 text-white placeholder:text-white/20 text-lg sm:text-xl py-4 sm:py-5"
                placeholder="Ex: 'Quais os critérios de Duke para Endocardite?'"
              />
              
              <div className="flex items-center gap-2 pr-2">
                 <button className="hidden sm:flex p-4 rounded-2xl hover:bg-white/5 text-white/40 hover:text-white transition-all">
                   <Mic className="h-6 w-6" />
                 </button>
                 
                 <Enaflix3DButton 
                   size="lg" 
                   glow 
                   onClick={handleSend}
                   className="h-14 sm:h-16 px-8 rounded-2xl text-base font-bold flex items-center gap-2 group/btn"
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
          {suggestions.map((sug, i) => (
            <button 
              key={sug}
              onClick={() => onSend(sug)}
              className={cn(
                "px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white/40",
                "hover:text-primary hover:border-primary/30 hover:bg-primary/5 hover:scale-105 transition-all duration-300",
                "backdrop-blur-md shadow-lg"
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

const AIMentor = () => {
  const onSendRef = { current: null as any };
  const [hasStarted, setHasStarted] = useState(false);

  const handleSend = (prompt: string) => {
    setHasStarted(true);
    // Give time for animation before focusing chat
    setTimeout(() => {
      onSendRef.current?.(prompt);
    }, 100);
  };
  
  return (
    <div className="relative min-h-screen bg-[#050508] text-white">
      {/* Global Cinematic Background */}
      <EnaflixBackgroundFX intensity="medium" />

      <div className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <motion.div
              key="hero"
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <TutorPremiumHero onSend={handleSend} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col pt-4 pb-0 sm:pt-6"
            >
              <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col px-2 sm:px-6 lg:px-12">
                <div className="flex-1 relative flex flex-col rounded-t-[40px] border-t border-x border-white/10 bg-black/40 backdrop-blur-[80px] shadow-2xl overflow-hidden transition-all duration-700">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
                  
                  <AgentChat
                    title="ENAZIZI Cognitive Engine"
                    subtitle="Núcleo de Inteligência Médica Premium"
                    icon={<Sparkles className="h-6 w-6 text-primary animate-pulse" />}
                    welcomeMessage="Olá! Sou o MentorMed, seu núcleo pedagógico ENAZIZI. Estou pronto para transformar seu material em aprendizado profundo com foco em residência médica. Como vamos começar hoje? 🩺"
                    placeholder="Inicie um caso clínico ou tire uma dúvida técnica..."
                    functionName="mentor-chat"
                    quickActions={quickActions}
                    onSendRef={onSendRef}
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
};

export default AIMentor;
