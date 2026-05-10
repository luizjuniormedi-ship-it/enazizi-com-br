/**
 * ProfessorInterventionTimeline (Fase 5)
 * Timeline unificada: assistant_decisions + atribuições do professor.
 * Consome action `intervention_timeline` do edge function professor-simulado.
 * Sem mocks; sem dado → DadosInsuficientesCard.
 */
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bot, History, RefreshCw, Sparkles, UserCog } from "lucide-react";
import { DadosInsuficientesCard } from "@/components/common/DadosInsuficientesCard";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  timestamp: string;
  kind: "ai_decision" | "professor_assignment";
  student_id: string | null;
  student_name: string | null;
  label: string;
  source: string;
  justification: string;
  severity: "info" | "action" | "warning" | "critical";
}

interface Props {
  callAPI: (b: Record<string, unknown>) => Promise<any>;
  studentId?: string;
}

export default function ProfessorInterventionTimeline({ callAPI, studentId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ai_decision" | "professor_assignment">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAPI({ action: "intervention_timeline", student_id: studentId, limit: 80 });
      setEvents(Array.isArray(res?.events) ? res.events : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [callAPI, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <DadosInsuficientesCard
        title="Sem intervenções registradas ainda"
        description="Decisões da IA e atribuições do professor aparecerão aqui assim que forem registradas."
        icon={<History className="h-4 w-4 text-primary/70" />}
      />
    );
  }

  const filtered = events.filter(e => filter === "all" || e.kind === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-black text-white">Timeline de intervenções</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Auditoria pedagógica unificada (IA + professor).
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "ai_decision", "professor_assignment"] as const).map(k => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "h-7 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border",
                filter === k
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-white/[0.03] text-white/60 border-white/10 hover:text-white/90"
              )}
            >
              {k === "all" ? "Todos" : k === "ai_decision" ? "IA" : "Professor"}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={load}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="relative pl-6 space-y-2">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-white/10" />
        {filtered.map(ev => (
          <div key={ev.id} className="relative">
            <div className="absolute -left-[18px] top-3 h-2.5 w-2.5 rounded-full bg-primary/70 ring-2 ring-background" />
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {ev.kind === "ai_decision" ? (
                    <Bot className="h-3.5 w-3.5 text-sky-300 shrink-0" />
                  ) : (
                    <UserCog className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white/85 truncate">{ev.label}</span>
                </div>
                <span className="text-[10px] text-white/40 shrink-0">
                  {new Date(ev.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/50">
                {ev.student_name && <span className="px-1.5 py-0.5 rounded bg-white/5">{ev.student_name}</span>}
                <span className="px-1.5 py-0.5 rounded bg-white/5">{ev.source}</span>
              </div>
              {ev.justification && (
                <p className="mt-1.5 text-[11px] text-white/70 leading-snug">{ev.justification}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 text-[10px] text-white/40 pt-1">
        <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
        <p>
          Resultados pós-intervenção (outcome) serão exibidos quando o pipeline
          de governance_logs com `target_user_id` estiver ativo.
        </p>
      </div>
    </div>
  );
}
