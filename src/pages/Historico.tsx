import { useState, useEffect } from "react";
import { History, Loader2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Historico() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("study_sessions_log")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error("Erro ao carregar histórico:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-white">Histórico de Estudo</h1>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">Nenhuma atividade registrada ainda.</p>
          <p className="text-white/30 text-sm mt-2">Comece a estudar e seu histórico aparecerá aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <Clock className="h-4 w-4 text-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.title || item.module || "Sessão de estudo"}</p>
                <p className="text-white/40 text-xs">{new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              {item.duration_minutes && (
                <span className="text-white/30 text-xs">{item.duration_minutes} min</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
