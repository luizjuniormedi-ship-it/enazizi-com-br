/**
 * OperationalHub — painel operacional do aluno (4 áreas).
 *
 * Aparece em /dashboard/sessao-estudo quando NÃO há tópico/foco/auto na URL.
 * Substitui a antiga "Start Screen" minimalista por um hub claro:
 *
 *   1. HOJE        — revisões vencidas, missão, streak, dias até banca
 *   2. EXECUÇÃO    — iniciar revisão, continuar, revisar erros, simulado
 *   3. PROGRESSO   — desempenho, aprovação, evolução
 *   4. ORGANIZAÇÃO — cronograma, planner, tarefas
 *
 * Filosofia: silencioso, funcional, sem competir com o ENAFLIX.
 * Reusa o motor StudySession existente — aluno digita tema OU clica em
 * uma ação rápida e a sessão arranca normalmente.
 */
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Clock, Target, Flame, CalendarDays,
  RotateCcw, Play, AlertTriangle, FileText,
  TrendingUp, BarChart3, Award,
  ListChecks, CalendarRange, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { trackStudyAction, type ActionKind } from "@/lib/behavioralTelemetry";
import { cn } from "@/lib/utils";

const SUGGESTED_TOPICS = [
  "Insuficiência Cardíaca", "TEP", "AVC",
  "Diabetes Mellitus", "Pneumonia", "Sepse",
];

interface Props {
  topicInput: string;
  onTopicChange: (v: string) => void;
  onStartStudy: () => void;
}

export default function OperationalHub({ topicInput, onTopicChange, onStartStudy }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useDashboardData();
  const metrics = data?.metrics;
  const stats = data?.stats;

  const pendingReviews = metrics?.pendingRevisoes ?? 0;
  const streak = metrics?.gamificationStreak ?? 0;
  const daysUntilExam = stats?.daysUntilExam ?? null;
  const todayCompleted = stats?.todayCompleted ?? 0;
  const todayTotal = stats?.todayTotal ?? 0;
  const accuracy = metrics?.accuracy ?? 0;
  const errorsCount = metrics?.errorsCount ?? 0;

  // Sprint 4 — track + delegate. entry_point = 'estudar' (todas ações nascem aqui).
  const trackAndGo = (kind: ActionKind, target: string, meta?: Record<string, unknown>) => {
    if (user) trackStudyAction(user.id, "estudar", kind, meta);
    navigate(target);
  };
  const handleStartStudy = () => {
    if (!topicInput.trim()) {
      toast.error("Escolha ou digite um tema para iniciar.");
      return;
    }
    if (user) trackStudyAction(user.id, "estudar", "start_topic", { topic: topicInput });
    onStartStudy();
  };

  const selectedTopic = topicInput.trim().toLowerCase();

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        {/* Header premium e silencioso */}
        <header className="space-y-1 text-center sm:text-left">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-black">
            Modo Estudo Ativo
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Sua missão começa aqui
          </h1>
          <p className="text-[13px] text-muted-foreground/80 font-medium">
            Escolha um tema ou retome seu plano diário com um clique.
          </p>
        </header>

        {/* ÁREA 2 — EXECUÇÃO (AÇÃO PRINCIPAL) */}
        <Section title="Estudo Direto" icon={Play} subtitle="O que você quer dominar agora?" className="order-1">
          {/* Quick start: tópico livre — Estética Cockpit */}
          <div className="rounded-2xl border-0 bg-card/40 backdrop-blur-sm p-6 space-y-4 shadow-sm relative overflow-hidden group">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative flex items-center gap-3 text-[13px] font-bold uppercase tracking-wider text-muted-foreground/70">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Tema de foco</span>
            </div>
            <div className="relative flex flex-col sm:flex-row gap-3">
              <Input
                value={topicInput}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="Ex: Insuficiência Cardíaca, TEP, AVC..."
                onKeyDown={(e) => e.key === "Enter" && handleStartStudy()}
                className="flex-1 h-12 bg-white/5 border-white/10 rounded-xl text-base font-medium placeholder:text-muted-foreground/40 focus:ring-primary/20"
              />
              <Button
                onClick={handleStartStudy}
                aria-disabled={!topicInput.trim()}
                className="h-12 px-8 rounded-xl font-black text-sm uppercase tracking-tight shadow-glow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <Play className="h-4 w-4 mr-2 fill-current" /> Iniciar Sessão
              </Button>
            </div>
            <div className="relative flex flex-wrap gap-2 pt-1">
              {SUGGESTED_TOPICS.map((t) => {
                const isSelected = selectedTopic === t.toLowerCase();
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTopicChange(t)}
                    aria-pressed={isSelected}
                    className={cn(
                      "text-xs font-bold px-3.5 py-2 min-h-9 rounded-lg border transition-all cursor-pointer",
                      isSelected
                        ? "border-primary/60 bg-primary/15 text-primary shadow-glow-sm"
                        : "border-white/5 bg-white/5 hover:bg-primary/10 hover:text-primary text-muted-foreground/80"
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ações rápidas — Grid de Cards Premium */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <ActionCard
              icon={RotateCcw}
              title="Minhas Revisões"
              description={pendingReviews > 0 ? `${pendingReviews} cards vencidos` : "Tudo em dia"}
              accent={pendingReviews > 0}
              onClick={() => trackAndGo("start_review", "/dashboard/sessao-estudo?focus=reviews&auto=1", { pendingReviews })}
            />
            <ActionCard
              icon={AlertTriangle}
              title="Banco de Erros"
              description={errorsCount > 0 ? `${errorsCount} temas críticos` : "Sem pendências"}
              onClick={() => trackAndGo("open_errors", "/dashboard/banco-erros", { errorsCount })}
            />
            <ActionCard
              icon={FileText}
              title="Simulados"
              description="Provas de residência"
              onClick={() => trackAndGo("start_simulado", "/dashboard/simulados")}
            />
            <ActionCard
              icon={Sparkles}
              title="Tutor Mentor"
              description="Dúvida pontual"
              onClick={() => trackAndGo("open_tutor", "/dashboard/chatgpt")}
            />
          </div>
        </Section>

        {/* ÁREA 1 — HOJE
            Em mobile: linha condensada (sem cards gigantes que geram ansiedade no fold).
            Em ≥sm: grid de StatCards original. */}
        <Section title="Hoje" icon={Target} className="order-2 sm:order-1">
          {/* Mobile: linha contextual discreta */}
          <div className="sm:hidden flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => trackAndGo("start_review", "/dashboard/sessao-estudo?focus=reviews&auto=1", { pendingReviews })}
              className={cn(
                "tabular-nums hover:text-foreground transition-colors",
                pendingReviews > 0 ? "text-foreground" : ""
              )}
            >
              <span className="font-semibold">{pendingReviews}</span> revisões
            </button>
            <span className="opacity-40">·</span>
            <button
              type="button"
              onClick={() => navigate("/dashboard/daily-plan")}
              className="tabular-nums hover:text-foreground transition-colors"
            >
              <span className="font-semibold">{todayCompleted}/{todayTotal || "—"}</span> hoje
            </button>
            <span className="opacity-40">·</span>
            <span className="tabular-nums">
              <span className="font-semibold">{streak > 0 ? `${streak}d` : "—"}</span> streak
            </span>
            {daysUntilExam !== null && (
              <>
                <span className="opacity-40">·</span>
                <span className="tabular-nums">
                  <span className={cn("font-semibold", daysUntilExam <= 30 && "text-foreground")}>{daysUntilExam}d</span> banca
                </span>
              </>
            )}
          </div>

          {/* ≥sm: grid original */}
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Clock}
              label="Revisões vencidas"
              value={pendingReviews}
              tone={pendingReviews > 0 ? "urgent" : "neutral"}
              onClick={() => trackAndGo("start_review", "/dashboard/sessao-estudo?focus=reviews&auto=1", { pendingReviews })}
            />
            <StatCard
              icon={ListChecks}
              label="Tarefas do dia"
              value={`${todayCompleted}/${todayTotal || "—"}`}
              tone="neutral"
              onClick={() => navigate("/dashboard/daily-plan")}
            />
            <StatCard
              icon={Flame}
              label="Sequência"
              value={streak > 0 ? `${streak}d` : "—"}
              tone={streak >= 3 ? "good" : "neutral"}
            />
            <StatCard
              icon={CalendarDays}
              label="Dias até banca"
              value={daysUntilExam ?? "—"}
              tone={daysUntilExam !== null && daysUntilExam <= 30 ? "urgent" : "neutral"}
            />
          </div>
        </Section>

        {/* PROGRESSO panorâmico vive em /dashboard (Hoje) — não duplicar aqui */}

        {/* ÁREA 4 — ORGANIZAÇÃO */}
        <Section title="Organização" icon={CalendarRange} className="order-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard
              icon={CalendarRange}
              title="Cronograma"
              description="Planejamento estratégico"
              onClick={() => navigate("/dashboard/planner")}
            />
            <ActionCard
              icon={ListChecks}
              title="Plano do dia"
              description="Tarefas guiadas"
              onClick={() => navigate("/dashboard/daily-plan")}
            />
            <ActionCard
              icon={Target}
              title="Smart Planner"
              description="Estratégia macro"
              onClick={() => navigate("/dashboard/planner")}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ────────────────────────  Subcomponentes  ──────────────────────── */

function Section({
  title,
  icon: Icon,
  subtitle,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
          <Icon className="h-3 w-3 text-primary/70" />
          {title}
        </h2>
        {subtitle && <span className="text-[11px] font-bold text-muted-foreground/40">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "neutral" | "urgent" | "good";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border bg-card p-3 transition-colors",
        onClick && "hover:border-primary/40 hover:bg-muted/40 cursor-pointer",
        tone === "urgent" && "border-destructive/30",
        tone === "good" && "border-primary/30",
        tone === "neutral" && "border-border",
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "urgent" && "text-destructive",
            tone === "good" && "text-primary",
            tone === "neutral" && "text-muted-foreground",
          )}
        />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </Comp>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  accent = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border-0 bg-card/40 p-4 transition-all shadow-sm cursor-pointer",
        "hover:bg-card hover:shadow-glow-sm hover:scale-[1.02]",
        accent ? "ring-1 ring-primary/30 bg-primary/[0.03]" : "",
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
          accent ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[14px] font-black tracking-tight">{title}</span>
      </div>
      <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wide">{description}</p>
      {accent && (
        <Badge variant="outline" className="mt-2 h-5 px-2 text-[9px] font-black uppercase border-0 bg-primary/20 text-primary rounded-md">
          Prioritário
        </Badge>
      )}
    </button>
  );
}

function ProgressCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border border-border bg-card p-4 transition-colors",
        onClick && "hover:border-primary/40 hover:bg-muted/40 cursor-pointer",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </Comp>
  );
}
