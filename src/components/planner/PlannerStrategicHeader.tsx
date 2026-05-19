import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target, Calendar, TrendingUp, Shield, AlertTriangle,
  Flame, Zap, Clock, GraduationCap
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type StudyPhase = "base" | "construcao" | "consolidacao" | "reta_final" | "pre_prova";

export interface PhaseConfig {
  key: StudyPhase;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  reviewWeight: number;
  newContentWeight: number;
  practiceWeight: number;
  simuladoWeight: number;
}

const PHASES: PhaseConfig[] = [
  {
    key: "base", label: "Base", description: "Construindo fundamentos — teoria + primeiros temas",
    icon: <GraduationCap className="h-4 w-4" />, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    reviewWeight: 0.2, newContentWeight: 0.5, practiceWeight: 0.2, simuladoWeight: 0.1,
  },
  {
    key: "construcao", label: "Construção", description: "Expandindo cobertura e reforçando pontos fracos",
    icon: <TrendingUp className="h-4 w-4" />, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    reviewWeight: 0.3, newContentWeight: 0.35, practiceWeight: 0.25, simuladoWeight: 0.1,
  },
  {
    key: "consolidacao", label: "Consolidação", description: "Revisão intensiva e correção de lacunas",
    icon: <Shield className="h-4 w-4" />, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    reviewWeight: 0.4, newContentWeight: 0.15, practiceWeight: 0.3, simuladoWeight: 0.15,
  },
  {
    key: "reta_final", label: "Reta Final", description: "Foco em questões, simulados e revisão estratégica",
    icon: <Flame className="h-4 w-4" />, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    reviewWeight: 0.35, newContentWeight: 0.05, practiceWeight: 0.35, simuladoWeight: 0.25,
  },
  {
    key: "pre_prova", label: "Pré-Prova", description: "Últimos ajustes — simulados + revisão de erros",
    icon: <Zap className="h-4 w-4" />, color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    reviewWeight: 0.3, newContentWeight: 0, practiceWeight: 0.3, simuladoWeight: 0.4,
  },
];

export function getPhaseByDaysLeft(daysLeft: number, approvalScore: number): PhaseConfig {
  if (daysLeft <= 15) return PHASES[4]; // pré-prova
  if (daysLeft <= 30) return PHASES[3]; // reta final
  if (daysLeft <= 60) return PHASES[2]; // consolidação
  if (approvalScore >= 60 || daysLeft <= 90) return PHASES[2]; // consolidação
  if (approvalScore >= 30) return PHASES[1]; // construção
  return PHASES[0]; // base
}

export function getPhaseByProgress(approvalScore: number): PhaseConfig {
  if (approvalScore >= 85) return PHASES[3];
  if (approvalScore >= 60) return PHASES[2];
  if (approvalScore >= 30) return PHASES[1];
  return PHASES[0];
}

interface ChanceByExam {
  banca: string;
  chance_score: number;
}

interface Props {
  examDate: string | null;
  targetExams: string[];
  approvalScore: number;
  chanceByExam: ChanceByExam[];
  pendingReviews: number;
  overdueReviews: number;
  recoveryMode: boolean;
  heavyRecoveryPhase?: number;
  weekNumber?: number;
}

function getChanceColor(score: number) {
  if (score >= 70) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  if (score >= 30) return "text-orange-600";
  return "text-red-600";
}

function getChanceLabel(score: number) {
  if (score >= 70) return "Alta";
  if (score >= 50) return "Competitiva";
  if (score >= 30) return "Em construção";
  return "Muito baixa";
}

export default function PlannerStrategicHeader({
  examDate, targetExams, approvalScore, chanceByExam,
  pendingReviews, overdueReviews, recoveryMode, heavyRecoveryPhase, weekNumber,
}: Props) {
  const now = new Date();
  const daysLeft = examDate ? Math.max(0, differenceInDays(new Date(examDate), now)) : null;
  const phase = daysLeft !== null
    ? getPhaseByDaysLeft(daysLeft, approvalScore)
    : getPhaseByProgress(approvalScore);

  const retentionRisk = overdueReviews > 10 ? "alto" : overdueReviews > 3 ? "moderado" : "baixo";
  
  // Longitudinal Hardening: Risk based on proximity vs score
  const trajectoryRisk = daysLeft !== null && approvalScore < (100 - (daysLeft * 0.5)) ? "high" : "low";

  return (
    <div className="space-y-3">
      {/* Row 1: Phase + Days */}
      <div className={`rounded-xl border ${phase.borderColor} ${phase.bgColor} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${phase.bgColor} ${phase.color}`}>
              {phase.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm font-bold ${phase.color}`}>Fase: {phase.label}</h2>
                {weekNumber && (
                  <Badge variant="outline" className="text-[9px]">Semana {weekNumber}</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{phase.description}</p>
            </div>
          </div>
          {daysLeft !== null && (
            <div className="text-right">
              <p className={`text-2xl font-black tabular-nums ${daysLeft <= 30 ? "text-red-600" : daysLeft <= 60 ? "text-amber-600" : "text-foreground"}`}>
                {daysLeft}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">dias p/ prova</p>
            </div>
          )}
        </div>

        {/* Phase progress bar (visual representation) */}
        <div className="flex gap-1 mt-2">
          {PHASES.map((p, i) => (
            <div
              key={p.key}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                p.key === phase.key
                  ? "bg-current opacity-80"
                  : PHASES.indexOf(phase) > i
                    ? "bg-current opacity-30"
                    : "bg-muted"
              }`}
              style={{ color: p.key === phase.key || PHASES.indexOf(phase) > i ? undefined : undefined }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {PHASES.map(p => (
            <span key={p.key} className={`text-[8px] ${p.key === phase.key ? phase.color + " font-bold" : "text-muted-foreground"}`}>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Row 2: Key Metrics */}
      <div className="grid grid-cols-3 gap-2">
        {/* Approval Score */}
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <Target className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{approvalScore}%</p>
          <p className="text-[9px] text-muted-foreground">Approval Score</p>
        </div>

        {/* Retention Risk */}
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${
            retentionRisk === "alto" ? "text-red-500" : retentionRisk === "moderado" ? "text-amber-500" : "text-emerald-500"
          }`} />
          <p className={`text-sm font-bold ${
            retentionRisk === "alto" ? "text-red-600" : retentionRisk === "moderado" ? "text-amber-600" : "text-emerald-600"
          }`}>
            {retentionRisk === "alto" ? "Alto" : retentionRisk === "moderado" ? "Moderado" : "Baixo"}
          </p>
          <p className="text-[9px] text-muted-foreground">Risco Retenção</p>
          {overdueReviews > 0 && (
            <p className="text-[9px] text-red-500 mt-0.5">{overdueReviews} atrasadas</p>
          )}
        </div>

        {/* Pending Reviews */}
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{pendingReviews}</p>
          <p className="text-[9px] text-muted-foreground">Revisões Pendentes</p>
        </div>
      </div>

      {/* Row 3: Chance by Exam */}
      {chanceByExam.length > 0 && (
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3" /> Chance por Banca
          </p>
          <div className="flex gap-3">
            {chanceByExam.map(c => (
              <div key={c.banca} className="flex-1 text-center">
                <p className={`text-lg font-bold ${getChanceColor(c.chance_score)}`}>
                  {Math.round(c.chance_score)}%
                </p>
                <p className="text-[9px] font-medium">{c.banca}</p>
                <p className={`text-[8px] ${getChanceColor(c.chance_score)}`}>
                  {getChanceLabel(c.chance_score)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 4: Recovery Warning */}
      {recoveryMode && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-xs font-bold text-red-700 dark:text-red-400">
                {heavyRecoveryPhase
                  ? `Recuperação Pesada — Fase ${heavyRecoveryPhase}/4`
                  : "Modo Recuperação Ativo"}
              </p>
              <p className="text-[10px] text-red-600/80 dark:text-red-400/80">
                {heavyRecoveryPhase
                  ? "Carga reduzida progressiva. O planner ajusta automaticamente."
                  : "Carga reduzida até estabilizar. Foco em revisões críticas."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
