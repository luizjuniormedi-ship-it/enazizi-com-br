import { MessageSquare, Sparkles, Zap, Brain, Mic, GraduationCap } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";
import { motion } from "framer-motion";
import { Enaflix3DButton } from "@/components/enaflix/Enaflix3DButton";
import { EnaflixBadge } from "@/components/enaflix/EnaflixBadge";

const quickActions = [
  { label: "🩺 Tirar dúvida", prompt: "Explique detalhadamente o tema principal do meu material, como se eu fosse estudar para a prova.", icon: "🩺" },
  { label: "📌 Pontos de prova", prompt: "Quais são os pontos mais cobrados em provas de residência sobre o conteúdo do meu material?", icon: "📌" },
  { label: "💊 Condutas", prompt: "Quais as condutas terapêuticas mais importantes e mais cobradas nos temas do meu material?", icon: "💊" },
  { label: "🔄 Diagnóstico diferencial", prompt: "Faça uma análise de diagnóstico diferencial dos temas abordados no meu material.", icon: "🔄" },
  { label: "🔬 Artigos PubMed", prompt: "Busque e cite artigos científicos relevantes do PubMed/NLM sobre o tema principal do meu material, com links e resumos.", icon: "🔬" },
];

const TutorHero = ({ onSend }: { onSend: (p: string) => void }) => {
  return (
    <div className="relative overflow-hidden rounded-[40px] bg-slate-950/50 border border-white/5 p-8 sm:p-12 mb-8 group">
       <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent" />
       <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] -z-10 animate-pulse" />
       
       <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
         <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center border border-primary/30 shadow-[0_0_40px_rgba(var(--pixar-blue),0.3)] float-gentle"
         >
           <Sparkles className="h-12 w-12 text-primary" />
         </motion.div>

         <div className="space-y-2">
           <div className="flex items-center justify-center gap-3">
             <EnaflixBadge type="ia" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Sessão Premium</span>
           </div>
           <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tighter leading-none">
             Olá 👋
           </h1>
           <p className="text-xl text-white/60 font-medium">O que vamos dominar hoje?</p>
         </div>

         <div className="w-full max-w-2xl relative group/input">
           <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-violet-500/50 rounded-2xl blur opacity-20 group-hover/input:opacity-40 transition duration-1000" />
           <div className="relative flex items-center bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 pl-6">
             <Brain className="h-5 w-5 text-primary/60 mr-4" />
             <input 
               className="bg-transparent border-0 outline-none flex-1 text-white placeholder:text-white/30 text-lg py-4"
               placeholder="Digite um tema, doença, prova ou dúvida..."
               onKeyDown={(e) => e.key === 'Enter' && onSend((e.target as HTMLInputElement).value)}
             />
             <div className="flex items-center gap-2 px-2">
                <button className="p-3 rounded-xl hover:bg-white/5 text-white/40 transition-colors">
                  <Mic className="h-5 w-5" />
                </button>
                <Enaflix3DButton 
                  size="sm" 
                  glow 
                  onClick={() => {}}
                  className="h-12 px-6"
                >
                  Estudar Agora
                </Enaflix3DButton>
             </div>
           </div>
         </div>

         <div className="flex flex-wrap justify-center gap-2 pt-2">
           {["ECG na Emergência", "Protocolo de Sepse", "GGO na Radiologia"].map(sug => (
             <button 
               key={sug}
               onClick={() => onSend(sug)}
               className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white/40 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
             >
               {sug}
             </button>
           ))}
         </div>
       </div>
    </div>
  );
};

const AIMentor = () => {
  const onSendRef = { current: null as any };
  
  return (
    <div className="p-4 sm:p-8 lg:p-14 space-y-8">
      <TutorHero onSend={(p) => onSendRef.current?.(p)} />
      
      <div className="h-[600px] border border-white/5 rounded-[40px] overflow-hidden bg-[#050508]/50 backdrop-blur-xl shadow-2xl">
        <AgentChat
          title="MentorMed Premium"
          subtitle="Deep Learning especializado em Residência Médica."
          icon={<Sparkles className="h-6 w-6 text-primary" />}
          welcomeMessage="Olá! Sou o MentorMed, seu mentor IA especializado em Residência Médica. Como posso ajudá-lo hoje? 🩺"
          placeholder="Faça uma pergunta sobre residência médica..."
          functionName="mentor-chat"
          quickActions={quickActions}
          onSendRef={onSendRef}
        />
      </div>
    </div>
  );
};

export default AIMentor;

