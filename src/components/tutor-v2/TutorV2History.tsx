import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Calendar, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TutorV2History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      const { data } = await supabase
        .from("tutor_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) setSessions(data);
      setIsLoading(false);
    };

    fetchHistory();
  }, [user]);

  if (isLoading) return <div className="p-4 text-[10px] text-slate-500 font-bold uppercase animate-pulse">Carregando Histórico...</div>;

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => navigate(`/dashboard/sessao-estudo/${session.id}`)}
          className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-indigo-500/20 transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-indigo-400" />
              <span className="text-[10px] font-black text-white uppercase truncate max-w-[120px]">
                {session.title || "Nova Conversa"}
              </span>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-700 group-hover:text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-2.5 w-2.5 text-slate-600" />
            <span className="text-[9px] text-slate-500 font-bold uppercase">
              {new Date(session.created_at).toLocaleDateString()}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
