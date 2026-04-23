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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8">
        {/* Header silencioso */}
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Modo Estudar
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Sua jornada de hoje
          </h1>
          <p className="text-sm text-muted-foreground">
            Comece pela ação certa — sem ruído, sem distração.
          </p>
        </header>

        {/*
         * Ordem mobile: EXECUÇÃO primeiro (ação > ansiedade), HOJE depois.
         * Ordem ≥sm: HOJE primeiro (panorâmico), EXECUÇÃO depois.
         * Conseguimos isso com `order-*` sem duplicar markup.
         */}

        {/* ÁREA 2 — EXECUÇÃO */}
        <Section title="Execução" icon={Play} subtitle="Comece agora" className="order-1 sm:order-2">
          {/* Quick start: tópico livre */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Estudar um tema</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={topicInput}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="Ex: Insuficiência Cardíaca, TEP, AVC..."
                onKeyDown={(e) => e.key === "Enter" && onStartStudy()}
                className="flex-1"
              />
              <Button onClick={onStartStudy} disabled={!topicInput.trim()}>
                <Play className="h-4 w-4 mr-1.5" /> Iniciar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTopicChange(t)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <ActionCard
              icon={RotateCcw}
              title="Iniciar revisão"
              description={pendingReviews > 0 ? `${pendingReviews} pendente${pendingReviews === 1 ? "" : "s"}` : "Sem pendências"}
              accent={pendingReviews > 0}
              onClick={() => navigate("/dashboard/sessao-estudo?focus=reviews&auto=1")}
            />
            <ActionCard
              icon={AlertTriangle}
              title="Revisar erros"
              description={errorsCount > 0 ? `${errorsCount} no banco` : "Sem erros recentes"}
              onClick={() => navigate("/dashboard/banco-erros")}
            />
            <ActionCard
              icon={FileText}
              title="Iniciar simulado"
              description="Treino com bancas"
              onClick={() => navigate("/dashboard/simulados")}
            />
            <ActionCard
              icon={Sparkles}
              title="Tutor IA"
              description="Tirar dúvida agora"
              onClick={() => navigate("/dashboard/chatgpt")}
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
              onClick={() => navigate("/dashboard/sessao-estudo?focus=reviews&auto=1")}
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
              onClick={() => navigate("/dashboard/sessao-estudo?focus=reviews&auto=1")}
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

        {/* PROGRESSO panorâmico vive em /dashboard (Visão Geral) — não duplicar aqui */}

        {/* ÁREA 4 — ORGANIZAÇÃO */}
        <Section title="Organização" icon={CalendarRange} className="order-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionCard
              icon={CalendarRange}
              title="Cronograma"
              description="Planejamento estratégico"
              onClick={() => navigate("/dashboard/cronograma-inteligente")}
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
    <section className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </h2>
        {subtitle && <span className="text-[11px] text-muted-foreground/70">{subtitle}</span>}
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
        "text-left rounded-lg border bg-card p-3.5 transition-all",
        "hover:border-primary/40 hover:bg-muted/40",
        accent ? "border-primary/30" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon
          className={cn(
            "h-4 w-4",
            accent ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="text-sm font-medium">{title}</span>
        {accent && (
          <Badge variant="outline" className="ml-auto h-4 px-1.5 text-[9px] border-primary/30 text-primary">
            Agora
          </Badge>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{description}</p>
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
