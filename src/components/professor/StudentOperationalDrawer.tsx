/**
 * StudentOperationalDrawer v2
 * Drawer lateral com drill-down operacional do aluno selecionado.
 * Consome:
 *   - action `student_detail` → cognitivo + atividade + simulados
 *   - tabela `assistant_decisions` (timeline de decisões IA + intervenções professor)
 *   - prop `risk?: StudentCognitiveRisk` vinda de class_analytics → exibe risco composto,
 *     burnout e ação sugerida do ProfessorActionEngine
 * Sem dado → DadosInsuficientesCard nas seções vazias.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DadosInsuficientesCard } from "@/components/common/DadosInsuficientesCard";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Brain, Clock, AlertCircle, History, Target, Loader2, GaugeCircle, BookOpen, MessageCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeProfessorAction,
  type StudentCognitiveRisk,
  type ProfessorActionType,
} from "@/lib/professor/professorActionEngine";
import type { InterventionType } from "@/components/professor/QuickInterventionDialog";

interface Props {
  studentId: string | null;
  open: boolean;
  onClose: () => void;
  callAPI: (body: Record<string, unknown>) => Promise<any>;
  risk?: StudentCognitiveRisk | null;
  onAction?: (type: InterventionType, suggestedSpecialty?: string, suggestedJustification?: string) => void;
}

interface Decision {
  id: string;
  decision_type: string;
  source_module: string;
  justification: string | null;
  created_at: string;
}

const ACTION_BUTTONS: { type: InterventionType; label: string; icon: React.ReactNode; variant?: "default" | "outline" }[] = [
  { type: "recovery",          label: "Recovery",      icon: <Target className="h-3 w-3 mr-1.5" /> },
  { type: "fsrs_review",       label: "Revisão FSRS",  icon: <Brain className="h-3 w-3 mr-1.5" />,        variant: "outline" },
  { type: "adaptive_simulado", label: "Simulado adapt.", icon: <BookOpen className="h-3 w-3 mr-1.5" />,   variant: "outline" },
  { type: "reduce_load",       label: "Reduzir carga", icon: <GaugeCircle className="h-3 w-3 mr-1.5" />,  variant: "outline" },
  { type: "mentoria",          label: "Mentoria",      icon: <MessageCircle className="h-3 w-3 mr-1.5" />, variant: "outline" },
  { type: "monitor",           label: "Monitorar",     icon: <Eye className="h-3 w-3 mr-1.5" />,          variant: "outline" },
];

const ACTION_TO_INTERVENTION: Record<ProfessorActionType, InterventionType> = {
  assign_recovery: "recovery",
  assign_fsrs_review: "fsrs_review",
  assign_adaptive_simulado: "adaptive_simulado",
  reduce_load: "reduce_load",
  open_mentory: "mentoria",
  monitor: "monitor",
};

export default function StudentOperationalDrawer({
  studentId,
  open,
  onClose,
  callAPI,
  risk,
  onAction,
}: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [detailRes, decRes] = await Promise.all([
          callAPI({ action: "student_detail", student_id: studentId }),
          supabase
            .from("assistant_decisions")
            .select("id,decision_type,source_module,justification,created_at")
            .eq("user_id", studentId)
            .order("created_at", { ascending: false })
            .limit(15),
        ]);
        if (cancelled) return;
        setDetail(detailRes || null);
        setDecisions(Array.isArray(decRes?.data) ? (decRes.data as Decision[]) : []);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setDecisions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, studentId, callAPI]);

  const weakest = detail?.domain_scores?.length
    ? [...detail.domain_scores].sort((a: any, b: any) => a.domain_score - b.domain_score)[0]
    : null;

  const suggestedSpecialty = risk?.weak_specialty || weakest?.specialty;

  const recommendedAction = useMemo(() => (risk ? computeProfessorAction(risk) : null), [risk]);

  const trigger = (type: InterventionType) => {
    if (!onAction || !studentId) return;
    onAction(type, suggestedSpecialty, recommendedAction?.justification);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-white/5">
          <SheetTitle className="text-xl font-black flex items-center gap-2 flex-wrap">
            {detail?.profile?.display_name || risk?.display_name || "Aluno"}
            {risk && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-black uppercase tracking-wider",
                  risk.risk_level === "critical" && "bg-rose-500/10 text-rose-300 border-rose-500/30",
                  risk.risk_level === "warning" && "bg-amber-500/10 text-amber-300 border-amber-500/30",
                  risk.risk_level === "low" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
                )}
              >
                Risco {risk.risk_score} · {risk.risk_level}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {detail?.profile?.email}
            {detail?.profile?.faculdade ? ` · ${detail.profile.faculdade}` : ""}
            {detail?.profile?.periodo ? ` · ${detail.profile.periodo}` : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Quick actions — 6 botões reais */}
        <div className="px-6 py-3 border-b border-white/5 flex flex-wrap gap-1.5" data-testid="drawer-actions">
          {ACTION_BUTTONS.map((b) => {
            const isRecommended =
              recommendedAction && ACTION_TO_INTERVENTION[recommendedAction.action_type] === b.type;
            return (
              <Button
                key={b.type}
                size="sm"
                variant={isRecommended ? "default" : (b.variant || "outline")}
                onClick={() => trigger(b.type)}
                className={cn(
                  "h-8 text-[11px] font-bold uppercase tracking-wider",
                  isRecommended && "ring-2 ring-primary/40",
                )}
                data-testid={`drawer-action-${b.type}`}
              >
                {b.icon} {b.label}
              </Button>
            );
          })}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {loading && (
              <div className="py-12 text-center text-white/50">
                <Loader2 className="h-5 w-5 animate-spin inline" />
              </div>
            )}

            {/* RISCO COGNITIVO + AÇÃO RECOMENDADA */}
            {risk && (
              <Section icon={<AlertCircle className="h-3.5 w-3.5" />} title="Risco cognitivo">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Kpi label="Risco" value={`${risk.risk_score}`} severity={risk.risk_level} />
                  <Kpi label="Burnout" value={risk.burnout_risk} severity={risk.burnout_risk === "high" ? "critical" : risk.burnout_risk === "moderate" ? "warning" : "low"} />
                  <Kpi label="Sobrecarga" value={`${risk.overload_score}`} />
                  <Kpi label="Inativo" value={`${risk.inactive_days}d`} />
                  <Kpi label="Estabilidade FSRS" value={risk.avg_stability ?? "—"} />
                  <Kpi label="Lapses" value={risk.avg_lapses ?? "—"} />
                  <Kpi label="Retenção" value={risk.retention_score !== null ? `${risk.retention_score}%` : "—"} />
                  <Kpi label="θ proxy" value={risk.theta_proxy !== null ? `${risk.theta_proxy}%` : "—"} />
                </div>
                {recommendedAction && (
                  <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary/80">Ação recomendada</div>
                    <div className="text-sm font-black text-white mt-0.5">{recommendedAction.label}</div>
                    <p className="text-xs text-white/70 mt-1 leading-snug">{recommendedAction.justification}</p>
                  </div>
                )}
              </Section>
            )}

            {!loading && detail && (
              <>
                {/* COGNITIVO */}
                <Section icon={<Brain className="h-3.5 w-3.5" />} title="Cognitivo">
                  <KpiGrid
                    items={[
                      { label: "Score médio", value: `${detail.avg_domain_score ?? 0}%` },
                      {
                        label: "Acerto geral",
                        value: detail.study_performance ? `${detail.study_performance.taxa_acerto}%` : "—",
                      },
                      { label: "Questões", value: detail.study_performance?.questoes_respondidas ?? 0 },
                      { label: "Especialidades", value: detail.domain_scores?.length ?? 0 },
                    ]}
                  />
                </Section>

                {/* ATIVIDADE */}
                <Section icon={<Activity className="h-3.5 w-3.5" />} title="Atividade">
                  <KpiGrid
                    items={[
                      { label: "Streak", value: `${detail.gamification?.current_streak ?? 0}d` },
                      { label: "XP", value: detail.gamification?.xp ?? 0 },
                      { label: "Nível", value: detail.gamification?.level ?? 1 },
                      {
                        label: "Última ativ.",
                        value: detail.gamification?.last_activity_date
                          ? new Date(detail.gamification.last_activity_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                          : "—",
                      },
                    ]}
                  />
                </Section>

                {/* TEMAS CRÍTICOS */}
                <Section icon={<AlertCircle className="h-3.5 w-3.5" />} title="Temas críticos">
                  {detail.error_topics?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.error_topics.slice(0, 10).map((e: any, i: number) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold",
                            e.vezes_errado >= 3
                              ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/30",
                          )}
                        >
                          {e.tema} · {e.vezes_errado}×
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <DadosInsuficientesCard
                      title="Sem temas críticos registrados"
                      description="O aluno ainda não acumulou erros suficientes."
                    />
                  )}
                </Section>

                {/* ATIVIDADES RECENTES */}
                <Section icon={<Clock className="h-3.5 w-3.5" />} title="Atividades recentes">
                  <RecentList
                    items={[
                      ...(detail.simulado_results || []).map((r: any) => ({
                        kind: "Simulado", title: r.title, score: r.score, status: r.status, at: r.finished_at,
                      })),
                      ...(detail.clinical_case_results || []).map((r: any) => ({
                        kind: "Caso", title: r.title, score: r.score, status: r.status, at: r.finished_at,
                      })),
                      ...(detail.study_assignments || []).map((r: any) => ({
                        kind: "Tema", title: r.title, score: null, status: r.status, at: r.completed_at,
                      })),
                    ]
                      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
                      .slice(0, 8)}
                  />
                </Section>

                {/* TIMELINE INTERVENÇÕES */}
                <Section icon={<History className="h-3.5 w-3.5" />} title="Decisões e intervenções">
                  {decisions && decisions.length > 0 ? (
                    <div className="space-y-2" data-testid="drawer-timeline">
                      {decisions.map((d) => {
                        const isProfessor = d.decision_type.startsWith("professor_intervention_");
                        return (
                          <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                isProfessor ? "text-amber-300" : "text-primary/80",
                              )}>
                                {isProfessor ? "Professor · " : "IA · "}{d.decision_type}
                              </span>
                              <span className="text-[10px] text-white/40">
                                {new Date(d.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {d.justification && (
                              <p className="text-xs text-white/70 mt-1 leading-snug">{d.justification}</p>
                            )}
                            <span className="text-[10px] text-white/30 mt-1 inline-block">via {d.source_module}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <DadosInsuficientesCard
                      title="Sem decisões registradas"
                      description="Nenhuma intervenção IA ou professor registrada para este aluno ainda."
                    />
                  )}
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3 text-[11px] font-black uppercase tracking-wider text-white/60">
        {icon}{title}
      </div>
      {children}
    </section>
  );
}

function KpiGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((k, i) => (
        <div key={i} className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">{k.label}</div>
          <div className="text-base font-black text-white mt-0.5">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, severity }: { label: string; value: string | number; severity?: "low" | "warning" | "critical" | "moderate" | "high" | string }) {
  const tone =
    severity === "critical" || severity === "high"
      ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
      : severity === "warning" || severity === "moderate"
      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
      : severity === "low"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
      : "bg-white/[0.03] border-white/10 text-white";
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", tone)}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-base font-black mt-0.5">{value}</div>
    </div>
  );
}

function RecentList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <DadosInsuficientesCard
        title="Sem atividades recentes"
        description="Quando o aluno responder simulados, casos ou temas, eles aparecerão aqui."
      />
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{it.kind}</div>
            <div className="text-sm font-bold text-white truncate">{it.title}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {it.score != null && <span className="text-xs font-black text-white">{it.score}%</span>}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                it.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-white/5 text-white/60",
              )}
            >
              {it.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
