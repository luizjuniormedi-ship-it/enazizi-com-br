import { BarChart3, TrendingUp, Stethoscope, GraduationCap, ChevronDown, ChevronUp, Target, Activity, Clock, Zap } from "lucide-react";
import type { StudyPerformance } from "@/components/tutor/TutorConstants";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TutorMetricsBarProps {
  performance: StudyPerformance;
  metricsCollapsed: boolean;
  setMetricsCollapsed: (v: boolean) => void;
  userId?: string;
}

const TutorMetricsBar = ({ performance, metricsCollapsed, setMetricsCollapsed, userId }: TutorMetricsBarProps) => {
  const [extraMetrics, setExtraMetrics] = useState({ retention: 0, recovery: 0, latency: 0, memoryHits: 0 });

  useEffect(() => {
    if (!userId) return;
    const fetchExtra = async () => {
      const { data: prog } = await supabase.from("enazizi_progress").select("retention_score, recovery_score").eq("user_id", userId).maybeSingle();
      const { data: run } = await supabase.from("tutor_runtime_metrics").select("tutor_generation_ms, memory_hit").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      
      const lat = run && run.length > 0 ? Math.round(run.reduce((a, c) => a + (c.tutor_generation_ms || 0), 0) / run.length / 100) / 10 : 0;
      const hits = run ? run.filter(r => r.memory_hit).length : 0;
      
      setExtraMetrics({ 
        retention: Number(prog?.retention_score) || 0, 
        recovery: Number(prog?.recovery_score) || 0, 
        latency: lat,
        memoryHits: hits
      });
    };
    fetchExtra();
  }, [userId]);

  return (
  <div className="mb-3">
    <button
      onClick={() => setMetricsCollapsed(!metricsCollapsed)}
      className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full group"
    >
      <BarChart3 className="h-3.5 w-3.5" />
      <span>Métricas</span>
      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] overflow-x-auto no-scrollbar">
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold shrink-0">
          <Target className="h-2.5 w-2.5" /> {extraMetrics.retention}%
        </span>
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold shrink-0">
          <Activity className="h-2.5 w-2.5" /> {extraMetrics.recovery}%
        </span>
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-semibold shrink-0">
          <Clock className="h-2.5 w-2.5" /> {extraMetrics.latency}s
        </span>
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold shrink-0">
          <Zap className="h-2.5 w-2.5" /> {extraMetrics.memoryHits} hits
        </span>
        <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">{performance.questoes_respondidas}Q</span>
        <span className={`px-1.5 py-0.5 rounded font-semibold ${performance.taxa_acerto >= 70 ? "bg-success/10 text-success" : performance.taxa_acerto >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>{performance.taxa_acerto}%</span>
        {performance.pontuacao_discursiva != null && (
          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">{performance.pontuacao_discursiva}/10</span>
        )}
        <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{performance.historico_estudo.length} sessões</span>
      </div>
      {metricsCollapsed ? <ChevronDown className="h-3.5 w-3.5 ml-auto" /> : <ChevronUp className="h-3.5 w-3.5 ml-auto" />}
    </button>
    {!metricsCollapsed && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 animate-fade-in">
        <div className="glass-card p-2 sm:p-3 flex items-center gap-2 card-3d">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground">Questões</p>
            <p className="text-sm font-bold">{performance.questoes_respondidas}</p>
          </div>
        </div>
        <div className="glass-card p-2 sm:p-3 flex items-center gap-2 card-3d">
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${performance.taxa_acerto >= 70 ? "bg-success/10" : performance.taxa_acerto >= 50 ? "bg-warning/10" : "bg-destructive/10"}`}>
            <TrendingUp className={`h-4 w-4 ${performance.taxa_acerto >= 70 ? "text-success" : performance.taxa_acerto >= 50 ? "text-warning" : "text-destructive"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground">Acerto</p>
            <p className="text-sm font-bold">{performance.taxa_acerto}%</p>
          </div>
        </div>
        <div className="glass-card p-2 sm:p-3 flex items-center gap-2 card-3d">
          <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground">Discursiva</p>
            <p className="text-sm font-bold">{performance.pontuacao_discursiva != null ? `${performance.pontuacao_discursiva}/10` : "—"}</p>
          </div>
        </div>
        <div className="glass-card p-2 sm:p-3 flex items-center gap-2 card-3d">
          <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-4 w-4 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] text-muted-foreground">Sessões</p>
            <p className="text-sm font-bold">{performance.historico_estudo.length}</p>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default TutorMetricsBar;
