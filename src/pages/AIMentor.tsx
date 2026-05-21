import { useState, useEffect } from "react";
import { Brain, Zap, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CinematicAvatar from "@/components/agents/CinematicAvatar";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { cn } from "@/lib/utils";

const suggestions = [
  "Critérios de Duke",
  "Protocolo de Sepse",
  "Raciocínio Clínico",
  "Conduta no AVC",
  "Antibióticos na UTI"
];

const AIMentor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.user_metadata?.display_name?.split(" ")[0] || "Doutor";
  const [inputValue, setInputValue] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSend = (topic: string) => {
    if (!topic.trim()) return;
    setIsRedirecting(true);
    // Redireciona para o Tutor unificado
    navigate(`/dashboard/sessao-estudo?topic=${encodeURIComponent(topic)}`);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050508] text-white overflow-hidden">
      <EnaflixBackgroundFX intensity="medium" />
      
      <AnimatePresence>
        {isRedirecting && (
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

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20">
        {/* Botão Voltar */}
        <button
          onClick={() => navigate("/dashboard")}
          className="absolute top-8 left-8 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest backdrop-blur-md transition-all"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center space-y-12">
          
          {/* Avatar IA */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative group"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 to-violet-500/30 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000" />
            <CinematicAvatar 
              isSpeaking={false} 
              className="w-40 h-40 sm:w-48 sm:h-48 rounded-[40px] border-2 border-white/10 shadow-2xl shadow-primary/20 float-gentle"
            />
            <div className="absolute -bottom-2 -right-2 bg-primary p-2 rounded-2xl shadow-lg border-4 border-[#050508]">
              <Zap className="h-5 w-5 text-white fill-current" />
            </div>
          </motion.div>

          {/* Branding e Saudação */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-center gap-3">
              <EnaflixBadge type="ia" className="scale-110" />
              <div className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Tutor IA Premium Ativo</span>
            </div>
            
            <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tighter leading-tight">
              Olá, <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40">{firstName} 👋</span>
            </h1>
            <p className="text-xl sm:text-2xl text-white/50 font-medium tracking-tight">
              O que vamos <span className="text-primary font-bold">dominar</span> hoje?
            </p>
          </motion.div>

          {/* Input Area */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-full max-w-3xl relative"
          >
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 via-violet-500/20 to-primary/20 rounded-[32px] blur-xl opacity-20 group-hover:opacity-50 transition duration-1000" />
            
            <div className="relative group/input bg-white/5 backdrop-blur-3xl rounded-[32px] border border-white/10 p-3 shadow-2xl">
              <div className="flex flex-col sm:row items-center gap-2 sm:flex-row">
                <div className="flex items-center flex-1 w-full px-4">
                  <Brain className="h-6 w-6 text-primary/60 mr-4 hidden sm:block" />
                  <input 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
                    className="bg-transparent border-0 outline-none flex-1 text-white placeholder:text-white/20 text-xl py-4 sm:py-5"
                    placeholder="Ex: 'Quais os critérios de Duke?'"
                  />
                </div>
                
                <Enaflix3DButton 
                  size="lg" 
                  glow 
                  onClick={() => handleSend(inputValue)}
                  className="h-16 w-full sm:w-auto px-8 rounded-2xl text-base font-bold flex items-center justify-center gap-2 group/btn"
                  disabled={!inputValue.trim()}
                >
                  <span>Estudar Agora</span>
                  <Zap className="h-5 w-5 fill-current" />
                </Enaflix3DButton>
              </div>
            </div>
          </motion.div>

          {/* Sugestões */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {suggestions.map((sug) => (
              <button 
                key={sug}
                onClick={() => handleSend(sug)}
                className="px-5 py-2.5 rounded-2xl border bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all text-sm font-bold backdrop-blur-md"
              >
                {sug}
              </button>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AIMentor;
