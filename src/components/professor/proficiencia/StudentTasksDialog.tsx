import { useState } from "react";
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
import { ListChecks, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStudentPlanTasks } from "@/hooks/useStudentPlanTasks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  planId: string | null;
  planName?: string;
  userId: string | null;
  studentName?: string | null;
}

const taskTypeLabel: Record<string, string> = {
  theory: "Teoria",
  questions: "Questões",
  review: "Revisão",
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  completed: { label: "Concluída", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  skipped: { label: "Pulada", cls: "bg-muted text-muted-foreground" },
  overdue: { label: "Atrasada", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
};

const StudentTasksDialog = ({
  open,
  onOpenChange,
  planId,
  planName,
  userId,
  studentName,
}: Props) => {
  const [status, setStatus] = useState<string>("all");
  const [taskType, setTaskType] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data: tasks, isLoading } = useStudentPlanTasks({
    planId: open ? planId : null,
    userId: open ? userId : null,
    status,
    taskType,
    fromDate: fromDate || null,
    toDate: toDate || null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl teacher-modal-content">
        <DialogHeader className="p-6 sm:p-8 pb-0 sm:pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Tarefas — {studentName ?? "Aluno"}
          </DialogTitle>
          <DialogDescription>
            {planName ? `Plano: ${planName}` : "Drill-down das tarefas atribuídas neste plano."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="skipped">Puladas</SelectItem>
              <SelectItem value="overdue">Atrasadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="theory">Teoria</SelectItem>
              <SelectItem value="questions">Questões</SelectItem>
              <SelectItem value="review">Revisão</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="De"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="Até"
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma tarefa encontrada com os filtros atuais.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead>Subtema</TableHead>
                  <TableHead className="w-[120px]">Origem</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[160px]">Concluída em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const sb = statusBadge[t.status] ?? {
                    label: t.status,
                    cls: "bg-muted text-muted-foreground",
                  };
                  const originLabel =
                    t.source === "replan_missed_goal"
                      ? "Replan · meta"
                      : t.source === "replan_teacher_update"
                        ? "Replan · prof."
                        : t.source === "planner_auto"
                          ? "Auto"
                          : "Planner";
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">
                        {format(new Date(t.planned_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {taskTypeLabel[t.task_type] ?? t.task_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.subtopic_name ?? (
                          <span className="text-muted-foreground italic">sem subtema</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {originLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={sb.cls}>
                          {sb.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.completed_at
                          ? format(new Date(t.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default StudentTasksDialog;
