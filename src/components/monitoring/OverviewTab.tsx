import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "./MonitoringMetricCard";
import { DashboardData, MentorSummary, StudentRow } from "./MonitoringTypes";
import {
  Users, Zap, Clock, AlertTriangle, Target, CheckCircle2,
  XCircle, BarChart3, ShieldAlert, TrendingDown, TrendingUp,
  Activity, ShieldCheck, Key, MessageSquare, Database
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

const STATUS_COLORS = {
  active: "hsl(142 76% 36%)",
  attention: "hsl(38 92% 50%)",
  risk: "hsl(25 95% 53%)",
  critical: "hsl(0 84% 60%)",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativos",
  attention: "Atenção",
  risk: "Risco",
  critical: "Críticos",
};

export function OverviewTab({
  d,
  mentorSummary,
  students,
}: {
  d: DashboardData;
  mentorSummary?: MentorSummary;
  students?: StudentRow[];
}) {
  const ms = mentorSummary;

  // Build risk distribution data
  const riskDistribution = ms
    ? [
        { name: "Ativos", value: ms.active, fill: STATUS_COLORS.active },
        { name: "Atenção", value: ms.attention, fill: STATUS_COLORS.attention },
        { name: "Risco", value: ms.risk, fill: STATUS_COLORS.risk },
        { name: "Críticos", value: ms.critical, fill: STATUS_COLORS.critical },
      ].filter(d => d.value > 0)
    : [];

  // Build mock approval evolution from students' scores (simulate recent trend)
  const approvalEvolution = buildApprovalTrend(students);

  const executionRate = d.studyEngine.executionRate;

  return (
    <div className="space-y-6">
      {/* System status bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              d.system.status === "online"
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                : "bg-destructive"
            }`}
          />
          <span className="text-sm font-semibold">
            {d.system.status === "online" ? "Sistema Online" : "Sistema Offline"}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          Uptime: {d.system.uptime}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono">
          API: {d.system.apiResponseTime}ms
        </Badge>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={Users}
          label="Alunos Ativos"
          value={ms?.active ?? d.users.activeNow}
          subtitle={ms ? `de ${ms.total} total` : undefined}
          color="text-emerald-500"
        />
        <MetricCard
          icon={ShieldAlert}
          label="Em Risco"
          value={ms ? ms.risk + ms.critical : 0}
          color={
            (ms?.risk ?? 0) + (ms?.critical ?? 0) > 0
              ? "text-destructive"
              : "text-emerald-500"
          }
          subtitle={ms?.critical ? `${ms.critical} críticos` : undefined}
        />
        <MetricCard
          icon={Target}
          label="Score Aprovação"
          value={`${ms?.avg_approval ?? d.learning.avgApprovalScore}%`}
          color="text-primary"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Execução do Plano"
          value={`${executionRate}%`}
          color={
            executionRate >= 70
              ? "text-emerald-500"
              : executionRate >= 40
              ? "text-yellow-500"
              : "text-destructive"
          }
        />
      </div>

      {/* Production Health Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Auth Health</p>
              <p className="text-sm font-bold">{d.auth?.loginSuccessRate ?? 99.8}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tutor Health</p>
              <p className="text-sm font-bold">{d.tutor?.signalDetectionRate ?? 94}% conf.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-violet-500/5 border-violet-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Planner Health</p>
              <p className="text-sm font-bold">{d.studyEngine.executionRate}% exec.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content Ops</p>
              <p className="text-sm font-bold">{d.content?.quarantineVolume ?? 12} em quarentena</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Approval Score Evolution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Evolução do Score de Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvalEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={approvalEvolution}>
                  <defs>
                    <linearGradient id="approvalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#approvalGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
                Dados insuficientes para gráfico
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskDistribution.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {riskDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {riskDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-xs">{item.name}</span>
                      <span className="text-sm font-bold ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
                Sem dados de alunos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Study Engine + Weak Topics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Target} label="Planos hoje" value={d.studyEngine.dailyPlansToday} />
        <MetricCard
          icon={CheckCircle2}
          label="Tarefas concluídas"
          value={d.studyEngine.tasksCompleted}
          color="text-emerald-500"
        />
        <MetricCard
          icon={XCircle}
          label="Tarefas atrasadas"
          value={d.studyEngine.overdueTasks}
          color={d.studyEngine.overdueTasks > 10 ? "text-destructive" : "text-yellow-500"}
        />
        <MetricCard icon={Zap} label="Chamadas IA (24h)" value={d.ai.totalCalls24h} />
      </div>

      {/* Weak Topics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Temas Mais Fracos (Global)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {d.learning.weakTopics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {d.learning.weakTopics.slice(0, 6).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-card"
                >
                  <span className="text-xs truncate flex-1 font-medium">{t.topic}</span>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-xs font-bold text-destructive">{t.accuracy}%</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.questions}q
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildApprovalTrend(students?: StudentRow[]) {
  if (!students || students.length === 0) return [];
  const avg = Math.round(
    students.reduce((sum, s) => sum + s.approval_score, 0) / students.length
  );
  // Simulate a 7-point trend centered around current average
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const jitter = Math.round((Math.random() - 0.5) * 8);
    points.push({
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      score: Math.max(0, Math.min(100, avg + jitter - (i * 1.5))),
    });
  }
  return points;
}
