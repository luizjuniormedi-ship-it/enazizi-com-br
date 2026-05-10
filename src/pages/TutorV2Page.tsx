import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TutorV2ChatPanel from "@/components/tutor-v2/TutorV2ChatPanel";
import TutorV2Sidebar from "@/components/tutor-v2/TutorV2Sidebar";
import { useTutorV2Session } from "@/components/tutor-v2/hooks/useTutorV2Session";

export default function TutorV2Page() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { session, isLoading } = useTutorV2Session(sessionId);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-indigo-400 gap-4">
      <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center animate-pulse">
        <div className="h-6 w-6 bg-indigo-500 rounded-lg animate-spin" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Iniciando Tutor V2</p>
    </div>
  );

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
