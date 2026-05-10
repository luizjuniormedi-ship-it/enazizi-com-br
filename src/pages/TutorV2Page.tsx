import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TutorV2ChatPanel from "@/components/tutor-v2/TutorV2ChatPanel";
import TutorV2Sidebar from "@/components/tutor-v2/TutorV2Sidebar";
import { useTutorV2Session } from "@/components/tutor-v2/hooks/useTutorV2Session";
import { Brain, Sparkles, GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TutorV2Page() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, isLoading } = useTutorV2Session(sessionId);
  const [newTopic, setNewTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleStartSession = async () => {
    if (!newTopic.trim() || !user) return;
    setIsCreating(true);
    
    try {
      const { data, error } = await (supabase
        .from("tutor_sessions") as any)
        .insert({
          user_id: user.id,
          topic: newTopic,
          mode: 'livre',
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      navigate(`/dashboard/tutor-v2/${data.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-indigo-400 gap-4">
      <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center animate-pulse">
        <div className="h-6 w-6 bg-indigo-500 rounded-lg animate-spin" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sincronizando Tutor V2</p>
    </div>
  );

  if (!sessionId) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          <div className="flex items-center gap-4 mb-12 justify-center">
            <div className="h-16 w-16 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Tutor IA V2</h1>
              <p className="text-xs text-indigo-400 font-black uppercase tracking-widest">ENAZIZI Medical Intelligence</p>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-3xl shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">O que vamos dominar hoje?</h2>
            <p className="text-slate-400 text-sm mb-8">Digite um tema, especialidade ou caso clínico para iniciar sua jornada pedagógica adaptativa.</p>
            
            <div className="space-y-4">
              <div className="relative">
                <Input 
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Ex: Insuficiência Cardíaca, Pré-natal de alto risco..." 
                  className="h-14 bg-slate-950/50 border-white/10 rounded-2xl pl-6 pr-14 text-white placeholder:text-slate-600 focus:ring-indigo-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
                />
                <Button 
                  onClick={handleStartSession}
                  disabled={!newTopic.trim() || isCreating}
                  size="icon" 
                  className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <QuickAction label="Clínica Médica" icon={Sparkles} />
                <QuickAction label="Pediatria" icon={GraduationCap} />
              </div>
            </div>
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
      <TutorV2Sidebar session={session} />
      <main className="flex-1 relative flex flex-col min-w-0">
        <TutorV2ChatPanel session={session} />
      </main>
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
