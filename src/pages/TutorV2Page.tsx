import { useState, useEffect } from "react";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TutorV2ChatPanel from "@/components/tutor-v2/TutorV2ChatPanel";
import TutorV2Sidebar from "@/components/tutor-v2/TutorV2Sidebar";
import { useTutorV2Session } from "@/components/tutor-v2/hooks/useTutorV2Session";
import { useStudyContext } from "@/lib/studyContext";

import { Brain, Sparkles, GraduationCap, ArrowRight, Zap, Target, BookOpen, Clock, Heart, Shield, Activity, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { MascotAvatar } from "@/components/mascot/MascotAvatar";

export default function TutorV2Page() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const studyCtx = useStudyContext();
  const [searchParams] = useSearchParams();
  const urlTopic = searchParams.get("topic") || searchParams.get("t") || "";
  const { session, isLoading, stats } = useTutorV2Session(sessionId);
  const [newTopic, setNewTopic] = useState(urlTopic || studyCtx?.topic || "");
  const [isCreating, setIsCreating] = useState(false);
  const [bootStatus, setBootStatus] = useState("");

  // Auto-start session if coming from study context or URL topic
  useEffect(() => {
    // Only auto-start if we are NOT on a specific session and NOT already creating one
    if (sessionId || isCreating) return;
    
    const topicToStart = urlTopic || studyCtx?.topic;
    if (topicToStart && user) {
      console.log("[TUTOR_AUTO_START] Detected context for topic:", topicToStart);
      handleStartSession(topicToStart);
    }
  }, [studyCtx?.topic, urlTopic, user, sessionId, isCreating]);


  const handleStartSession = async (topic?: string) => {
    const finalTopic = topic || newTopic;
    if (!finalTopic.trim() || !user || isCreating || sessionId) return;
    
    setIsCreating(true);
    setBootStatus("Inicializando preceptor...");

    // Context hydration for ALOS
    const hydrationMetadata = {
      source: studyCtx?.source || 'direct',
      difficulty: studyCtx?.difficulty || 'medio',
      reason: studyCtx?.reason || null,
      task_type: studyCtx?.taskType || null,
      source_plan_id: studyCtx?.priority ? String(studyCtx.priority) : null,
      initial_topic: finalTopic
    };

    try {
      // Fire-and-forget telemetry to avoid blocking boot
      pedagogicalEventBus.emit({
        event_type: 'tutor_session_created',
        module: 'tutor',
        source: 'frontend',
        entity_type: 'tutor_session',
        study_context: {
          topic: finalTopic,
          specialty: studyCtx?.specialty || null,
          subtopic: studyCtx?.subtopic || null
        },
        metadata: hydrationMetadata
      }, user.id).catch(err => console.warn("[TUTOR_TELEMETRY] Failed:", err));
      
      // Parallel creation of pedagogical track and tutor session
      setBootStatus("Sincronizando Ecossistema...");
      
      const [pedResult, tutorResult] = await Promise.all([
        supabase
          .from("pedagogical_sessions")
          .insert({
            user_id: user.id,
            topic: finalTopic,
            specialty: studyCtx?.specialty || null,
            tutor_mode: 'normal',
            cognitive_state: 'stable',
            metadata: hydrationMetadata
          })
          .select()
          .single(),
        supabase
          .from("tutor_sessions")
          .insert({
            user_id: user.id,
            topic: finalTopic,
            subtopic: studyCtx?.subtopic || null,
            specialty: studyCtx?.specialty || null,
            mode: 'livre',
            status: 'active',
            metadata: hydrationMetadata
          })
          .select()
          .single()
      ]);

      if (tutorResult.error) throw tutorResult.error;
      
      // Update tutor session with ped reference if available
      if (pedResult.data) {
        await supabase
          .from("tutor_sessions")
          .update({ 
            metadata: { 
              ...hydrationMetadata, 
              pedagogical_session_id: pedResult.data.id 
            } 
          })
          .eq("id", tutorResult.data.id);
      }

      navigate(`/dashboard/sessao-estudo/${tutorResult.data.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
      setIsCreating(false);
      setBootStatus("");
    }
  };

  if (isLoading || (isCreating && !sessionId)) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-indigo-400 gap-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full animate-pulse [animation-delay:1s]" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6">
          <MascotAvatar state="thinking" size="xl" />
        </div>
        
        <div className="text-center space-y-3">
          <p className="text-[12px] font-black uppercase tracking-[0.4em] text-white/90 animate-pulse">
            {bootStatus || "Sincronizando Tutor V3 Premium"}
          </p>
          <div className="h-1 w-48 bg-white/5 rounded-full overflow-hidden mx-auto">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (!sessionId) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-start p-6 overflow-y-auto relative selection:bg-indigo-500/30">
        {/* Animated Background Layers */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[140px] rounded-full" />
          <div className="absolute bottom-[0%] left-[20%] w-[30%] h-[30%] bg-blue-600/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-5xl w-full pt-12 md:pt-20 pb-20 relative z-10">
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-16"
          >
            <div className="flex items-center gap-6 mb-8 group">
              <div className="h-24 w-24 group-hover:scale-105 transition-transform duration-500 relative">
                <MascotAvatar state="idle" size="lg" />
                <div className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-slate-900 border border-indigo-500/50 flex items-center justify-center shadow-lg z-20">
                  <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                </div>
              </div>

              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Tutor V3</h1>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-black text-indigo-400 uppercase tracking-widest">Premium</span>
                </div>
                <p className="text-sm text-indigo-400/80 font-bold uppercase tracking-[0.2em] mt-2">Sessão Ativa • Protocolo Feynman Premium</p>
              </div>
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-white max-w-2xl leading-tight mb-4">
              O que vamos <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">dominar hoje?</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium max-w-xl">
              Olá, {user?.email?.split('@')[0]}. Seu copiloto médico está pronto para transformar temas complexos em conhecimento consolidado.
            </p>
          </motion.div>

          {/* Command Center (Input) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative max-w-3xl mx-auto mb-16"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
              <div className="relative bg-slate-900/80 border border-white/10 rounded-[2.2rem] p-3 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
                <div className="flex items-center px-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-950 flex items-center justify-center text-indigo-500 mr-4">
                    <Target className="h-6 w-6" />
                  </div>
                  <Input 
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Explique IAM como se eu fosse leigo..." 
                    className="h-16 bg-transparent border-none text-xl text-white placeholder:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                    onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
                    disabled={isCreating}
                  />
                  <Button 
                    onClick={() => handleStartSession()}
                    disabled={!newTopic.trim() || isCreating}
                    className="h-14 px-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all active:scale-95 gap-2"
                  >
                    Estudar Agora
                    <Zap className="h-5 w-5 fill-current" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Smart Suggestions */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <SuggestionChip onClick={() => handleStartSession("Critérios de Duke")} label="Duke" />
              <SuggestionChip onClick={() => handleStartSession("Protocolo de Sepse")} label="Sepse" />
              <SuggestionChip onClick={() => handleStartSession("Conduta no AVC")} label="AVC" />
              <SuggestionChip onClick={() => handleStartSession("Raciocínio Clínico")} label="Raciocínio" />
              <SuggestionChip onClick={() => handleStartSession("Antibióticos na UTI")} label="Antibióticos" />
            </div>
          </motion.div>

          {/* Grid Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Especialidades */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-1 lg:col-span-2 space-y-4"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Especialidades de Hoje</h3>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Atualizado</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <QuickActionV2 onClick={() => handleStartSession("Clínica Médica")} label="Clínica Médica" icon={Heart} color="text-red-400" bgColor="bg-red-500/10" />
                <QuickActionV2 onClick={() => handleStartSession("Pediatria")} label="Pediatria" icon={Activity} color="text-blue-400" bgColor="bg-blue-500/10" />
                <QuickActionV2 onClick={() => handleStartSession("Cirurgia")} label="Cirurgia" icon={Shield} color="text-amber-400" bgColor="bg-amber-500/10" />
                <QuickActionV2 onClick={() => handleStartSession("Ginecologia e Obstetrícia")} label="Ginecologia" icon={Sparkles} color="text-pink-400" bgColor="bg-pink-500/10" />
                <QuickActionV2 onClick={() => handleStartSession("Preventiva e Saúde Pública")} label="Preventiva" icon={Shield} color="text-emerald-400" bgColor="bg-emerald-500/10" />
                <QuickActionV2 onClick={() => handleStartSession("Neurologia")} label="Neurologia" icon={Brain} color="text-purple-400" bgColor="bg-purple-500/10" />
              </div>
            </motion.div>

            {/* Context Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2">Seu Contexto</h3>
              <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 backdrop-blur-xl h-full">
                <div className="space-y-6">
                  <ContextItem icon={Stethoscope} label="Missão Ativa" value="Cardiologia" progress={65} />
                  <ContextItem icon={Clock} label="Fadiga Cognitiva" value="Baixa" progress={20} color="bg-emerald-500" />
                  <ContextItem icon={Target} label="Score TRI" value="742" progress={74} color="bg-indigo-500" />
                  <div className="pt-4 mt-4 border-t border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Revisões Pendentes</p>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-400">12</div>
                      <p className="text-[11px] text-slate-300 font-medium">Flashcards aguardando seu Active Recall hoje.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return (
    <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
      Sessão não encontrada ou acesso negado.
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-indigo-500/30">
      <TutorV2Sidebar session={session} stats={stats} />
      <main className="flex-1 relative flex flex-col min-w-0">
        <TutorV2ChatPanel session={session} />
      </main>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-[11px] font-bold text-slate-400 hover:text-indigo-400"
    >
      {label}
    </button>
  );
}

function QuickActionV2({ label, icon: Icon, color, bgColor, onClick }: { label: string; icon: any; color: string; bgColor: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col gap-3 p-5 rounded-[1.8rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group relative overflow-hidden h-full min-h-[140px]"
    >
      <div className={`h-12 w-12 rounded-2xl ${bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className="mt-auto">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">Acessar</span>
        <h4 className="text-sm font-bold text-white group-hover:text-white transition-colors leading-tight mt-1">{label}</h4>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="h-4 w-4 text-indigo-500" />
      </div>
    </button>
  );
}

function ContextItem({ icon: Icon, label, value, progress, color = "bg-indigo-500" }: { icon: any; label: string; value: string; progress: number; color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-[11px] font-bold text-white">{value}</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

function QuickAction({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <button className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group">
      <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
        <Icon className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}
