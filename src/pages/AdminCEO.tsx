import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Activity, Target, AlertTriangle, BookOpen,
  Zap, TrendingUp, RefreshCw, BarChart3, Clock,
  CheckCircle, XCircle, Stethoscope, Brain, FlipVertical,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CEOMetrics {
  activeToday: number;
  activeWeek: number;
  avgSessionMinutes: number;
  studyStarts: number;
  startRate: number;
  missionsStarted: number;
  missionsCompleted: number;
  missionCompletionRate: number;
  criticalErrors: number;
  topFailures: string[];
  avgAccuracy: number;
  reviewsDone: number;
  tutorSessions: number;
  questionsSessions: number;
  plantaoSessions: number;
  osceSessions: number;
  returnRate: number;
  dropoffRate: number;
  totalUsers: number;
}

function MetricBox({ icon: Icon, label, value, trend, color = "text-primary" }: {
  icon: any; label: string; value: string | number; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-black tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
          {trend && (
            trend === "up" ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> :
            trend === "down" ? <ArrowDownRight className="h-4 w-4 text-destructive" /> :
            <Minus className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children, icon: Icon }: { children: string; icon: any }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mt-6 mb-3">
      <Icon className="h-4 w-4" /> {children}
    </h2>
  );
}

export default function AdminCEO() {
  const { session } = useAuth();

  const { data: m, isLoading, refetch, isFetching } = useQuery<CEOMetrics>({
    queryKey: ["admin-ceo-dashboard"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = subDays(now, 7).toISOString();
      const twoWeeksStart = subDays(now, 14).toISOString();

      const [
        { count: activeToday },
        { count: activeWeek },
        { data: moduleSessions },
        { data: dailyPlans },
        { data: completedPlans },
        { data: reviews },
        { data: practiceAttempts },
        { data: chatConvos },
        { data: clinicalSessions },
        { data: osceSessions },
        { data: aiLogs },
        { count: totalUsers },
        { count: prevWeekActive },
      ] = await Promise.all([
        // Active today — unique users with module_sessions today
        supabase.from("module_sessions" as any).select("*", { count: "exact", head: true })
          .gte("created_at", todayStart),
        // Active this week
        supabase.from("module_sessions" as any).select("*", { count: "exact", head: true })
          .gte("created_at", weekStart),
        // Module sessions this week (for avg duration — no duration col, count as proxy)
        supabase.from("module_sessions" as any).select("user_id, created_at")
          .gte("created_at", weekStart).limit(500),
        // Daily plans created (study starts)
        supabase.from("daily_plans").select("id, completed_count, total_blocks, user_id")
          .gte("created_at", weekStart),
        // Completed missions (at least 1 block done)
        supabase.from("daily_plans").select("id")
          .gte("created_at", weekStart).gt("completed_count", 0),
        // Reviews done
        supabase.from("revisoes" as any).select("id")
          .gte("created_at", weekStart).eq("status", "concluida"),
        // Practice attempts
        supabase.from("practice_attempts" as any).select("correct")
          .gte("created_at", weekStart).limit(1000),
        // Tutor sessions
        supabase.from("chat_conversations").select("id")
          .gte("created_at", weekStart).eq("agent_type", "tutor"),
        // Plantão (clinical cases)
        supabase.from("clinical_cases").select("id")
          .gte("created_at", weekStart),
        // OSCE sessions
        supabase.from("chronicle_osce_sessions").select("id")
          .gte("created_at", weekStart),
        // AI errors
        supabase.from("ai_usage_logs" as any).select("function_name, success, error_message")
          .gte("created_at", weekStart).eq("success", false),
        // Total users
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        // Previous week active
        supabase.from("module_sessions" as any).select("*", { count: "exact", head: true })
          .gte("created_at", twoWeeksStart).lt("created_at", weekStart),
      ]);

      // Unique users from module_sessions as proxy for active users
      const uniqueUsersToday = new Set((moduleSessions || [])
        .filter((s: any) => s.created_at >= todayStart)
        .map((s: any) => s.user_id)).size;

      const uniqueUsersWeek = new Set((moduleSessions || []).map((s: any) => s.user_id)).size;

      const missionsStarted = (dailyPlans || []).length;
      const missionsCompleted = (completedPlans || []).length;

      // Accuracy
      const attempts = practiceAttempts || [];
      const correct = attempts.filter((a: any) => a.correct).length;
      const avgAccuracy = attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0;

      // AI errors breakdown
      const errors = aiLogs || [];
      const errorsByFn: Record<string, number> = {};
      errors.forEach((e: any) => {
        errorsByFn[e.function_name] = (errorsByFn[e.function_name] || 0) + 1;
      });
      const topFailures = Object.entries(errorsByFn)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([fn, count]) => `${fn}: ${count}`);

      // Engagement
      const currentActive = uniqueUsersWeek || (activeWeek || 0);
      const prevActive = prevWeekActive || 0;
      const returnRate = prevActive > 0 ? Math.round((Math.min(currentActive, prevActive) / prevActive) * 100) : 0;
      const total = totalUsers || 1;
      const dropoffRate = Math.round(((total - currentActive) / total) * 100);

      // Study start rate
      const uniqueStarters = new Set((dailyPlans || []).map((p: any) => p.user_id)).size;
      const startRate = currentActive > 0 ? Math.round((uniqueStarters / currentActive) * 100) : 0;

      return {
        activeToday: uniqueUsersToday || (activeToday || 0),
        activeWeek: uniqueUsersWeek || (activeWeek || 0),
        avgSessionMinutes: 0, // no duration column available
        studyStarts: uniqueStarters,
        startRate,
        missionsStarted,
        missionsCompleted,
        missionCompletionRate: missionsStarted > 0 ? Math.round((missionsCompleted / missionsStarted) * 100) : 0,
        criticalErrors: errors.length,
        topFailures,
        avgAccuracy,
        reviewsDone: (reviews || []).length,
        tutorSessions: (chatConvos || []).length,
        questionsSessions: attempts.length,
        plantaoSessions: (clinicalSessions || []).length,
        osceSessions: (osceSessions || []).length,
        returnRate,
        dropoffRate,
        totalUsers: totalUsers || 0,
      };
    },
    enabled: !!session,
    staleTime: 60_000,
  });

  const systemStatus = !m ? "Carregando" :
    m.criticalErrors > 10 ? "Crítico" :
    m.criticalErrors > 3 ? "Atenção" :
    m.missionCompletionRate > 40 ? "Excelente" : "Bom";

  const statusColor = systemStatus === "Excelente" ? "bg-emerald-500" :
    systemStatus === "Bom" ? "bg-blue-500" :
    systemStatus === "Atenção" ? "bg-amber-500" :
    systemStatus === "Crítico" ? "bg-destructive" : "bg-muted";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Painel CEO
          </h1>
          <p className="text-xs text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} • {m?.totalUsers ?? "—"} usuários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColor} text-white`}>{systemStatus}</Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : m ? (
        <>
          <SectionTitle icon={Users}>Uso do Sistema</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricBox icon={Users} label="Ativos hoje" value={m.activeToday} trend={m.activeToday > 0 ? "up" : "neutral"} />
            <MetricBox icon={Activity} label="Ativos na semana" value={m.activeWeek} trend={m.activeWeek > 5 ? "up" : "neutral"} />
            <MetricBox icon={Users} label="Total cadastrados" value={m.totalUsers} />
          </div>

          <SectionTitle icon={Zap}>Início de Estudo</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <MetricBox icon={Zap} label="Clicaram 'Começar'" value={m.studyStarts} />
            <MetricBox icon={TrendingUp} label="Taxa de início" value={`${m.startRate}%`} trend={m.startRate > 50 ? "up" : "down"} />
          </div>

          <SectionTitle icon={Target}>Missão</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricBox icon={Target} label="Missões iniciadas" value={m.missionsStarted} />
            <MetricBox icon={CheckCircle} label="Missões concluídas" value={m.missionsCompleted} color="text-emerald-500" />
            <MetricBox icon={TrendingUp} label="Taxa de conclusão" value={`${m.missionCompletionRate}%`} trend={m.missionCompletionRate > 50 ? "up" : "down"} />
          </div>

          <SectionTitle icon={AlertTriangle}>Erros do Sistema</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <MetricBox icon={XCircle} label="Erros de IA (semana)" value={m.criticalErrors} color="text-destructive" trend={m.criticalErrors > 5 ? "down" : "up"} />
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Principais falhas</p>
                {m.topFailures.length === 0 ? (
                  <p className="text-xs text-emerald-500">Nenhuma falha detectada ✓</p>
                ) : (
                  <ul className="space-y-1">
                    {m.topFailures.map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-mono">{f}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <SectionTitle icon={BookOpen}>Qualidade do Estudo</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricBox icon={CheckCircle} label="Taxa de acerto" value={`${m.avgAccuracy}%`} trend={m.avgAccuracy >= 60 ? "up" : "down"} color="text-emerald-500" />
            <MetricBox icon={BookOpen} label="Revisões realizadas" value={m.reviewsDone} />
            <MetricBox icon={TrendingUp} label="Questões respondidas" value={m.questionsSessions} />
          </div>

          <SectionTitle icon={Brain}>Uso dos Módulos</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBox icon={Brain} label="Tutor IA" value={m.tutorSessions} />
            <MetricBox icon={FlipVertical} label="Questões" value={m.questionsSessions} />
            <MetricBox icon={Stethoscope} label="Plantão" value={m.plantaoSessions} />
            <MetricBox icon={Activity} label="OSCE" value={m.osceSessions} />
          </div>

          <SectionTitle icon={TrendingUp}>Engajamento</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <MetricBox icon={ArrowUpRight} label="Taxa de retorno" value={`${m.returnRate}%`} trend={m.returnRate > 50 ? "up" : "down"} color="text-emerald-500" />
            <MetricBox icon={ArrowDownRight} label="Taxa de abandono" value={`${m.dropoffRate}%`} trend={m.dropoffRate < 50 ? "up" : "down"} color="text-destructive" />
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm">Erro ao carregar dados</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
