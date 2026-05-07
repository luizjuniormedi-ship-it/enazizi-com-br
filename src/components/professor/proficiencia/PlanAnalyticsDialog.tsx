import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Search,
  RefreshCcw,
  TrendingUp,
  Download,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePlanAnalytics, type PlanAnalyticsStudentRow } from "@/hooks/useProficiencyAnalytics";
import type { ProfessorPlan } from "@/hooks/useProfessorPlans";
import StudentTasksDialog from "./StudentTasksDialog";
import { buildPlanCsvWithBom } from "./csvExport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: ProfessorPlan | null;
}

const weeklyBadge: Record<string, { label: string; cls: string }> = {
  done: { label: "Em dia", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  partial: { label: "Parcial", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  missed: { label: "Atrasado", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
};

const SummaryCard = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </CardContent>
  </Card>
);

const PlanAnalyticsDialog = ({ open, onOpenChange, plan }: Props) => {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<PlanAnalyticsStudentRow | null>(null);

  const { data, isLoading } = usePlanAnalytics(open ? plan?.id ?? null : null);

  const filteredStudents = useMemo(() => {
    if (!data) return [] as PlanAnalyticsStudentRow[];
    return data.students.filter((s) => {
      if (classFilter !== "all") {
        if (classFilter === "__direct__" && s.source !== "direct") return false;
        if (classFilter !== "__direct__" && s.class_id !== classFilter) return false;
      }
      if (statusFilter !== "all") {
        if (statusFilter === "on_track" && !(s.overdue_tasks === 0 && s.weekly_goal_status !== "missed"))
          return false;
        if (statusFilter === "late" && !(s.overdue_tasks > 0 || s.weekly_goal_status === "missed"))
          return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (s.display_name ?? "").toLowerCase();
        const email = (s.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, classFilter, statusFilter]);

  const handleExportCsv = () => {
    if (!plan) return;
    const csv = buildPlanCsvWithBom(plan.name, filteredStudents);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = plan.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
    a.download = `proficiencia_${safeName}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TeacherDialogContent
        className="z-[120]"
        maxWidth="sm:max-w-5xl"
        header={
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Relatório do plano — {plan?.name ?? ""}
              </DialogTitle>
              <DialogDescription>
                Acompanhamento agregado e por aluno. Dados calculados a partir do progresso vivo do plano.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!data || filteredStudents.length === 0}
              className="shrink-0 gap-2"
              title="Exportar CSV (respeita filtros aplicados)"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        }

        <DialogBody className="space-y-6">

        {isLoading || !data ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                icon={Users}
                label="Alunos no plano"
                value={data.summary.totalStudents}
                hint={`${data.summary.onTrackCount} em dia · ${data.summary.lateCount} atrasados`}
              />
              <SummaryCard
                icon={TrendingUp}
                label="Progresso médio"
                value={`${data.summary.avgProgress}%`}
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Tarefas concluídas"
                value={data.summary.completedTasks}
                hint={`${data.summary.pendingTasks} pendentes`}
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Tarefas atrasadas"
                value={data.summary.overdueTasks}
              />
            </div>

            {/* Recálculos */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recálculos</span>
                </div>
                <Badge variant="outline">Total: {data.summary.totalRecalcs}</Badge>
                <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400" variant="secondary">
                  Meta perdida: {data.summary.missedGoalRecalcs}
                </Badge>
                <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-400" variant="secondary">
                  Atualização do professor: {data.summary.teacherUpdateRecalcs}
                </Badge>
              </CardContent>
            </Card>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar aluno por nome ou email"
                  className="pl-9"
                />
              </div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  <SelectItem value="__direct__">Atribuição direta</SelectItem>
                  {data.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Turma · {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="on_track">Em dia</SelectItem>
                  <SelectItem value="late">Atrasados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela de alunos */}
            {filteredStudents.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum aluno encontrado com os filtros atuais.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="w-[180px]">Progresso</TableHead>
                      <TableHead className="w-[110px]">Semana</TableHead>
                      <TableHead className="w-[80px] text-center">Concl.</TableHead>
                      <TableHead className="w-[80px] text-center">Pend.</TableHead>
                      <TableHead className="w-[80px] text-center">Atras.</TableHead>
                      <TableHead className="w-[80px] text-center">Recalc.</TableHead>
                      <TableHead className="w-[140px]">Última atividade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s) => {
                      const wb = s.weekly_goal_status ? weeklyBadge[s.weekly_goal_status] : null;
                      return (
                        <TableRow
                          key={s.user_id}
                          className="cursor-pointer"
                          onClick={() => setSelectedStudent(s)}
                          title="Ver tarefas do aluno"
                        >
                          <TableCell>
                            <div className="min-w-0">
                              <div className="font-medium truncate flex items-center gap-1.5">
                                {s.display_name ?? "Aluno"}
                                {s.is_inactive && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                                    title="Sem atividade nos últimos 3 dias"
                                  >
                                    inativo
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {s.email ?? ""}
                                {s.source === "class" && (
                                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                                    {s.class_label ? `turma · ${s.class_label}` : "turma"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={s.progress_percent} className="h-2" />
                              <span className="text-[11px] text-muted-foreground">
                                {Math.round(s.progress_percent)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {wb ? (
                              <Badge variant="secondary" className={wb.cls}>
                                {wb.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{s.completed_tasks}</TableCell>
                          <TableCell className="text-center">{s.pending_tasks}</TableCell>
                          <TableCell className="text-center">
                            {s.overdue_tasks > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                {s.overdue_tasks}
                              </span>
                            ) : (
                              s.overdue_tasks
                            )}
                          </TableCell>
                          <TableCell className="text-center">{s.recalc_count}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {s.last_activity_at
                                ? formatDistanceToNow(new Date(s.last_activity_at), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })
                                : "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        )}
        </DialogBody>
      </DialogContent>

      <StudentTasksDialog
        open={!!selectedStudent}
        onOpenChange={(v) => !v && setSelectedStudent(null)}
        planId={plan?.id ?? null}
        planName={plan?.name}
        userId={selectedStudent?.user_id ?? null}
        studentName={selectedStudent?.display_name ?? selectedStudent?.email ?? null}
      />
    </Dialog>
  );
};

export default PlanAnalyticsDialog;
