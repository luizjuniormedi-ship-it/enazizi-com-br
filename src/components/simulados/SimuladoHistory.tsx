import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, RotateCcw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// P0 FIX (Freeze v25 — bugfix localizado):
// Antes lia `exam_sessions` (3 linhas) — fonte errada.
// Agora lê `simulado_sessions` (3299 linhas) — fonte real onde
// `generate-adaptive-simulado` persiste as sessões do aluno.
interface HistorySession {
  id: string;
  mode: string;
  discipline: string | null;
  topic: string | null;
  score: number | null;
  correct_count: number | null;
  total_questions: number;
  started_at: string | null;
  finished_at: string | null;
  status: string | null;
  metadata: any;
}

interface SimuladoHistoryProps {
  userId?: string;
  onRetryErrors: (sessionId: string) => void;
}

const buildTitle = (s: HistorySession): string => {
  const parts: string[] = [];
  if (s.discipline) parts.push(s.discipline);
  if (s.topic && s.topic !== s.discipline) parts.push(s.topic);
  const base = parts.join(" • ") || "Simulado";
  const modeLabel = s.mode === "prova_real" ? "Prova Real" : s.mode === "tri" ? "TRI" : s.mode === "estudo" ? "Estudo" : "Adaptativo";
  return `${base} — ${modeLabel}`;
};

const SimuladoHistory = ({ userId, onRetryErrors }: SimuladoHistoryProps) => {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchHistory = async () => {
      // P0 FIX: read from real source (simulado_sessions).
      // We don't filter by status='finished' because today legacy rows stay 'active';
      // ordering by finished_at (then started_at) surfaces real completed sessions first.
      const { data, error } = await supabase
        .from("simulado_sessions")
        .select("id, mode, discipline, topic, score, correct_count, total_questions, started_at, finished_at, status, metadata")
        .eq("user_id", userId)
        .order("finished_at", { ascending: false, nullsFirst: false })
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) {
        console.warn("[SimuladoHistory] fetch failed:", error.message);
      }
      setSessions((data as HistorySession[]) || []);
      setLoading(false);
    };
    fetchHistory();
  }, [userId]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Carregando histórico...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground">Nenhum simulado realizado ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">Complete seu primeiro simulado para ver o histórico aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map(s => {
        const score = Math.round(s.score ?? 0);
        // results breakdown comes from metadata.results when present
        const results = (s.metadata && typeof s.metadata === "object" && (s.metadata as any).results && typeof (s.metadata as any).results === "object")
          ? (s.metadata as any).results as Record<string, { correct: number; total: number }>
          : {};
        const hasErrors = score < 100 && (s.correct_count ?? 0) < s.total_questions;
        const isExpanded = expandedId === s.id;
        const displayDate = s.finished_at || s.started_at;
        const title = buildTitle(s);

        return (
          <div key={s.id} className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  score >= 70 ? "bg-green-500/15 text-green-500" : score >= 50 ? "bg-yellow-500/15 text-yellow-500" : "bg-destructive/15 text-destructive"
                }`}>
                  {score}%
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {displayDate ? format(new Date(displayDate), "dd MMM yyyy, HH:mm", { locale: ptBR }) : "—"}
                    {" • "}{s.total_questions} questões
                    {s.status && s.status !== "finished" ? ` • ${s.status}` : ""}
                  </p>
                </div>
              </div>
              {hasErrors && (
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); onRetryErrors(s.id); }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Revisar erros
                </Button>
              )}
            </div>

            {isExpanded && Object.keys(results).length > 0 && (
              <div className="pt-2 border-t border-border mt-2 space-y-2">
                {Object.entries(results).map(([area, { correct, total }]) => {
                  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                  return (
                    <div key={area}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span>{area}</span>
                        <span className="text-muted-foreground">{correct}/{total} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary">
                        <div className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SimuladoHistory;
