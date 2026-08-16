import { useState, useEffect, useMemo } from "react";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TutorV2ChatPanel from "@/components/tutor-v2/TutorV2ChatPanel";
import TutorV2Sidebar from "@/components/tutor-v2/TutorV2Sidebar";
import { useTutorV2Session } from "@/components/tutor-v2/hooks/useTutorV2Session";
import { useStudyContext } from "@/lib/studyContext";

import { Sparkles, Zap, Target, Heart, Shield, Activity, Stethoscope, ArrowLeft, Brain, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { MascotAvatar } from "@/components/mascot/MascotAvatar";
import { toast } from "sonner";

/**
 * Lista canônica de especialidades para a etapa de seleção.
 * Corresponde 1:1 aos labels em `curriculum_specialties`.
 * Mantida in-memory para evitar round-trip no boot do Mentor;
 * a persistência em `tutor_sessions.specialty` guarda o valor exato escolhido.
 */
const SPECIALTY_OPTIONS = [
  "Clínica Médica",
  "Cirurgia",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Medicina Preventiva",
  "Medicina de Emergência",
  "Cardiologia",
  "Pneumologia",
  "Neurologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Nefrologia",
  "Hematologia",
  "Infectologia",
  "Dermatologia",
  "Ortopedia",
  "Oftalmologia",
  "Otorrinolaringologia",
  "Psiquiatria",
  "Reumatologia",
] as const;

export default function TutorV2Page() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const studyCtx = useStudyContext();
  const [searchParams] = useSearchParams();
  const { session, isLoading, stats } = useTutorV2Session(sessionId);

  // Fallback para rotas legadas: /dashboard/mentor?specialty=X&topic=Y
  // (sem prefixo sc_*, preservado pelo RedirectWithSearch).
  const urlSpecialty = searchParams.get("specialty") || "";
  const urlTopic = searchParams.get("topic") || "";

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState<string>(studyCtx?.specialty || urlSpecialty || "");
  const [newTopic, setNewTopic] = useState<string>(studyCtx?.topic || urlTopic || "");
  const [isCreating, setIsCreating] = useState(false);
  const [bootStatus, setBootStatus] = useState("");

  const contextTopic = studyCtx?.topic || urlTopic;
  const contextSpecialty = studyCtx?.specialty || urlSpecialty;

  // Auto-start session if coming from study context with BOTH specialty and topic.
  // Antes o auto-start disparava só com topic → sessão criada sem specialty.
  useEffect(() => {
    if (contextTopic && contextSpecialty && user && !sessionId && !isCreating) {
      console.log("[TUTOR_AUTO_START] Detected full context:", { specialty: contextSpecialty, topic: contextTopic });
      handleStartSession(contextTopic, contextSpecialty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextTopic, contextSpecialty, user, sessionId]);

  // Reset boot state once the URL reflects the new session.
  useEffect(() => {
    if (sessionId && isCreating) {
      setIsCreating(false);
      setBootStatus("");
    }
  }, [sessionId, isCreating]);

  const handleStartSession = async (topicArg?: string, specialtyArg?: string) => {
    const finalTopic = (topicArg ?? newTopic ?? "").trim();
    const finalSpecialty = (specialtyArg ?? newSpecialty ?? "").trim();

    if (isCreating) return;
    if (!finalSpecialty) {
      toast.error("Selecione a especialidade antes de começar.");
      return;
    }
    if (!finalTopic) {
      toast.error("Digite o tema/assunto para começar.");
      return;
    }
    if (!user) {
      toast.error("Aguarde a autenticação carregar e tente novamente.");
      return;
    }

    setIsCreating(true);
    setBootStatus("Inicializando preceptor...");
    console.log("[TUTOR_SESSION_BOOT]", { specialty: finalSpecialty, topic: finalTopic });

    const hydrationMetadata = {
      source: studyCtx?.source || "direct",
      difficulty: studyCtx?.difficulty || "medio",
      reason: studyCtx?.reason || null,
      task_type: studyCtx?.taskType || null,
      source_plan_id: studyCtx?.priority ? String(studyCtx.priority) : null,
      initial_topic: finalTopic,
      initial_specialty: finalSpecialty,
    };

    try {
      void pedagogicalEventBus.emit(
        {
          event_type: "tutor_session_created",
          module: "tutor",
          source: "frontend",
          entity_type: "tutor_session",
          study_context: {
            topic: finalTopic,
            specialty: finalSpecialty,
            subtopic: studyCtx?.subtopic || null,
          },
          metadata: hydrationMetadata,
        },
        user.id
      );

      void supabase
        .from("pedagogical_sessions")
        .insert({
          user_id: user.id,
          topic: finalTopic,
          specialty: finalSpecialty,
          tutor_mode: "normal",
          cognitive_state: "stable",
          metadata: hydrationMetadata,
        })
        .select()
        .single()
        .then(({ error: pedErr }) => {
          if (pedErr) console.warn("[TUTOR_ALOS] Failed to create pedagogical track:", pedErr);
        })
        .catch((pedErr) => console.warn("[TUTOR_ALOS] Failed to create pedagogical track:", pedErr));

      setBootStatus("Consultando literatura médica...");

      const { data, error } = await (supabase.from("tutor_sessions") as any)
        .insert({
          user_id: user.id,
          topic: finalTopic,
          subtopic: studyCtx?.subtopic || null,
          specialty: finalSpecialty,
          mode: "livre",
          status: "active",
          metadata: {
            ...hydrationMetadata,
          },
        })
        .abortSignal(AbortSignal.timeout(8_000))
        .select()
        .single();

      if (error) throw error;
      console.log("[TUTOR_UI_READY] Session created:", data.id);

      await new Promise((resolve) => setTimeout(resolve, 800));
      navigate(`/dashboard/sessao-estudo/${data.id}`);
    } catch (err: any) {
      console.error("Error creating session:", err);
      toast.error(`Não foi possível iniciar a sessão: ${err?.message || "erro desconhecido"}`);
      setIsCreating(false);
      setBootStatus("");
    }
  };

  /** Quick action: pré-seleciona especialidade e foca o campo de tema. */
  const pickSpecialty = (specialty: string) => {
    setNewSpecialty(specialty);
    toast.message(`Especialidade: ${specialty}`, { description: "Agora digite o tema/assunto." });
    // Foca o input do tema.
    setTimeout(() => {
      const el = document.getElementById("tutor-topic-input") as HTMLInputElement | null;
      el?.focus();
    }, 50);
  };

  const canStart = useMemo(
    () => !!newSpecialty.trim() && !!newTopic.trim() && !isCreating,
    [newSpecialty, newTopic, isCreating]
  );

  if (isLoading || (isCreating && !sessionId))
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-indigo-400 gap-8 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full animate-pulse [animation-delay:1s]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6">
            <MascotAvatar state="thinking" size="xl" />
          </div>
          <div className="text-center space-y-3">
            <p className="text-[12px] font-black uppercase tracking-[0.4em] text-white/90 animate-pulse">
              {bootStatus || "Sincronizando Tutor V3"}
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
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[140px] rounded-full" />
          <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[140px] rounded-full" />
          <div className="absolute bottom-[0%] left-[20%] w-[30%] h-[30%] bg-blue-600/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-5xl w-full pt-12 md:pt-20 pb-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-12"
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
                  <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Tutor IA V3</h1>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                    Premium
                  </span>
                </div>
                <p className="text-sm text-indigo-400/80 font-bold uppercase tracking-[0.2em] mt-2">
                  Sessão Ativa • Protocolo Feynman
                </p>
              </div>
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-white max-w-2xl leading-tight mb-4">
              O que vamos{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                dominar hoje?
              </span>
            </h2>
            <p className="text-slate-400 text-lg font-medium max-w-xl">
              Olá, {user?.email?.split("@")[0]}. Escolha a especialidade e o tema para iniciar a sessão.
            </p>
          </motion.div>

          {/* Command Center (Specialty + Topic Gate) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative max-w-3xl mx-auto mb-16"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
              <div className="relative bg-slate-900/80 border border-white/10 rounded-[2.2rem] p-4 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 space-y-3">
                {/* Specialty gate */}
                <div className="flex items-center gap-3 px-2">
                  <label htmlFor="tutor-specialty-select" className="sr-only">
                    Especialidade
                  </label>
                  <div className="h-10 w-10 rounded-xl bg-slate-950 flex items-center justify-center text-indigo-500 shrink-0">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <Select value={newSpecialty} onValueChange={setNewSpecialty} disabled={isCreating}>
                    <SelectTrigger
                      id="tutor-specialty-select"
                      aria-label="Especialidade"
                      className="h-12 bg-slate-950/60 border-white/10 text-white flex-1"
                    >
                      <SelectValue placeholder="Selecione a especialidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white max-h-[280px]">
                      {SPECIALTY_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="focus:bg-indigo-500/20 focus:text-white">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic gate */}
                <div className="flex items-center px-2">
                  <div className="h-12 w-12 rounded-2xl bg-slate-950 flex items-center justify-center text-indigo-500 mr-3 shrink-0">
                    <Target className="h-6 w-6" />
                  </div>
                  <Input
                    id="tutor-topic-input"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Ex.: IAM com supra de ST, Sepse na pediatria..."
                    aria-label="Tema ou assunto"
                    className="h-14 bg-transparent border-none text-lg text-white placeholder:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleStartSession()}
                    disabled={isCreating}
                  />
                  <Button
                    onClick={() => handleStartSession()}
                    disabled={!canStart}
                    aria-label="Iniciar sessão de estudo"
                    className="h-12 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all active:scale-95 gap-2 disabled:opacity-40"
                  >
                    Estudar
                    <Zap className="h-4 w-4 fill-current" />
                  </Button>
                </div>

                {!newSpecialty && (
                  <p className="text-[11px] text-amber-400/80 font-medium px-2">
                    ⚠️ Selecione a especialidade antes de iniciar — o Mentor precisa desse contexto para calibrar a
                    aula.
                  </p>
                )}
              </div>
            </div>

            {/* Quick specialty picks */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 self-center mr-1">
                Início rápido:
              </span>
              <SuggestionChip onClick={() => pickSpecialty("Cardiologia")} label="Cardiologia" />
              <SuggestionChip onClick={() => pickSpecialty("Infectologia")} label="Infectologia" />
              <SuggestionChip onClick={() => pickSpecialty("Ginecologia e Obstetrícia")} label="Gineco/Obs" />
              <SuggestionChip onClick={() => pickSpecialty("Pediatria")} label="Pediatria" />
              <SuggestionChip onClick={() => pickSpecialty("Medicina de Emergência")} label="Emergência" />
            </div>
          </motion.div>

          {/* Grid Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-1 lg:col-span-2 space-y-4"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                  Grandes áreas — escolha e digite o tema
                </h3>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  Atualizado
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <QuickActionV2 onClick={() => pickSpecialty("Clínica Médica")} label="Clínica Médica" icon={Heart} color="text-red-400" bgColor="bg-red-500/10" />
                <QuickActionV2 onClick={() => pickSpecialty("Pediatria")} label="Pediatria" icon={Activity} color="text-blue-400" bgColor="bg-blue-500/10" />
                <QuickActionV2 onClick={() => pickSpecialty("Cirurgia")} label="Cirurgia" icon={Shield} color="text-amber-400" bgColor="bg-amber-500/10" />
                <QuickActionV2 onClick={() => pickSpecialty("Ginecologia e Obstetrícia")} label="Ginecologia" icon={Sparkles} color="text-pink-400" bgColor="bg-pink-500/10" />
                <QuickActionV2 onClick={() => pickSpecialty("Medicina Preventiva")} label="Preventiva" icon={Shield} color="text-emerald-400" bgColor="bg-emerald-500/10" />
                <QuickActionV2 onClick={() => pickSpecialty("Neurologia")} label="Neurologia" icon={Brain} color="text-purple-400" bgColor="bg-purple-500/10" />
              </div>
            </motion.div>

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
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-400">
                        12
                      </div>
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

  if (!session)
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-slate-950 text-white">
        Sessão não encontrada ou acesso negado.
      </div>
    );

  return (
    <div className="flex h-full min-h-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-indigo-500/30">
      <AnimatePresence mode="wait">
        {!isExpanded && !isSidebarMinimized && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 overflow-hidden"
          >
            <TutorV2Sidebar session={session} stats={stats} />
          </motion.div>
        )}
      </AnimatePresence>
      <main className="flex-1 relative flex flex-col min-w-0 min-h-0">
        <Button
          onClick={() => navigate("/dashboard/enaflix")}
          variant="ghost"
          size="sm"
          className="absolute top-3 left-3 z-30 h-9 px-3 gap-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800/80 text-[11px] font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="h-4 w-4" />
          Enaflix
        </Button>
        <TutorV2ChatPanel
          key={session?.id}
          session={session}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          isSidebarMinimized={isSidebarMinimized}
          onToggleSidebar={() => setIsSidebarMinimized(!isSidebarMinimized)}
        />
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

function QuickActionV2({
  label,
  icon: Icon,
  color,
  bgColor,
  onClick,
}: {
  label: string;
  icon: any;
  color: string;
  bgColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 p-5 rounded-[1.8rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group relative overflow-hidden h-full min-h-[140px]"
    >
      <div className={`h-12 w-12 rounded-2xl ${bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className="mt-auto">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">
          Selecionar
        </span>
        <h4 className="text-sm font-bold text-white group-hover:text-white transition-colors leading-tight mt-1">{label}</h4>
      </div>
    </button>
  );
}

function ContextItem({
  icon: Icon,
  label,
  value,
  progress,
  color = "bg-indigo-500",
}: {
  icon: any;
  label: string;
  value: string;
  progress: number;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
          <p className="text-sm font-bold text-white">{value}</p>
        </div>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
