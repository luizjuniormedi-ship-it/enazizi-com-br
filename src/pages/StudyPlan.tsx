/**
 * @legacy-write — Página /study-plan (atualmente órfã, sem rota em App.tsx).
 * Lê e escreve em study_plans/study_tasks (shape semanal). Fonte viva oficial: daily_plans/daily_plan_tasks.
 * NÃO migrar sem redesign de UX — daily_plans é diário; weeklySchedule não tem equivalente direto.
 * Mantido para retrocompatibilidade. Não exibir esta página sem reavaliação.
 */
import { CalendarDays, Clock, BookOpen, Upload, Loader2, Settings2, Trash2, GraduationCap, Plus, Pencil, Check, FileDown, Bell, BellOff, GripVertical, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useStudyReminders } from "@/hooks/useStudyReminders";

interface Task {
  time: string;
  subject: string;
  duration: string;
  type?: string;
}

interface DaySchedule {
  day: string;
  tasks: Task[];
}

interface PlanJson {
  weeklySchedule?: DaySchedule[];
  subjects?: string[];
  tips?: string;
  config?: {
    examDate: string;
    hoursPerDay: number;
    daysPerWeek: number;
    hasEdital: boolean;
  };
}

const StudyPlan = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Config state
  const [examDate, setExamDate] = useState<Date>();
  const [hoursPerDay, setHoursPerDay] = useState("4");
  const [daysPerWeek, setDaysPerWeek] = useState("5");
  const [editalText, setEditalText] = useState("");
  const [editalFileName, setEditalFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Plan state
  const [planId, setPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const reminders = useStudyReminders(schedule);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [tips, setTips] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [editingTask, setEditingTask] = useState<{ day: number; task: number } | null>(null);
  const [editValues, setEditValues] = useState<Task>({ time: "", subject: "", duration: "" });
  const [dragSource, setDragSource] = useState<{ day: number; task: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ day: number; task: number } | null>(null);
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, string>>({});
  const [showReprocess, setShowReprocess] = useState(false);
  const [newExamDate, setNewExamDate] = useState<Date>();
  const [reprocessing, setReprocessing] = useState(false);

  const reprocessPlan = async () => {
    if (!user || !newExamDate) {
      toast({ title: "Selecione a nova data da prova", variant: "destructive" });
      return;
    }
    setReprocessing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          examDate: format(newExamDate, "yyyy-MM-dd"),
          hoursPerDay: Number(hoursPerDay),
          daysPerWeek: Number(daysPerWeek),
          editalText: editalText || null,
          currentPlanId: planId,
          existingSubjects: subjects,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      const plan = result.plan.plan_json as PlanJson;
      setPlanId(result.plan.id);
      setSchedule(plan.weeklySchedule || []);
      setSubjects(plan.subjects || []);
      setTips(plan.tips || "");
      setExamDate(newExamDate);
      setShowReprocess(false);
      toast({ title: "Plano reprocessado!", description: "Cronograma atualizado com a nova data." });
    } catch (err: any) {
      toast({ title: "Erro ao reprocessar", description: err.message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  };

  // Load existing plan
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("study_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.plan_json) {
        const plan = data.plan_json as PlanJson;
        setPlanId(data.id);
        setSchedule(plan.weeklySchedule || []);
        setSubjects(plan.subjects || []);
        setTips(plan.tips || "");
        if (plan.config) {
          if (plan.config.examDate) setExamDate(new Date(plan.config.examDate));
          setHoursPerDay(String(plan.config.hoursPerDay || 4));
          setDaysPerWeek(String(plan.config.daysPerWeek || 5));
        }

        // Load completed tasks for this plan
        const { data: tasksData } = await supabase
          .from("study_tasks")
          .select("id, task_json, completed")
          .eq("user_id", user.id)
          .eq("study_plan_id", data.id)
          .eq("completed", true);

        if (tasksData) {
          const keys = new Set<string>();
          const idMap: Record<string, string> = {};
          for (const t of tasksData) {
            const tj = t.task_json as any;
            if (tj?.key) {
              keys.add(tj.key);
              idMap[tj.key] = t.id;
            }
          }
          setCompletedKeys(keys);
          setCompletedTaskIds(idMap);
        }
      } else {
        setShowConfig(true);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleEditalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditalFileName(file.name);

    if (file.type === "text/plain") {
      const text = await file.text();
      setEditalText(text);
      toast({ title: "Edital carregado!", description: `${file.name} processado.` });
    } else if (file.type === "application/pdf") {
      // For PDF, upload to storage and use process-upload to extract
      if (!user) return;
      try {
        const ext = file.name.split(".").pop();
        const storagePath = `${user.id}/edital-${Date.now()}.${ext}`;
        const { error: storageError } = await supabase.storage.from("user-uploads").upload(storagePath, file);
        if (storageError) throw storageError;

        // Create upload record for processing
        const { data: uploadRecord, error: dbError } = await supabase
          .from("uploads")
          .insert({
            user_id: user.id,
            filename: file.name,
            file_type: ext || "pdf",
            category: "edital",
            storage_path: storagePath,
            status: "uploaded",
          })
          .select()
          .single();
        if (dbError) throw dbError;

        // Process to extract text
        const { data: session } = await supabase.auth.getSession();
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({ uploadId: uploadRecord.id }),
        });

        if (resp.ok) {
          // Fetch the extracted text
          const { data: updated } = await supabase
            .from("uploads")
            .select("extracted_text")
            .eq("id", uploadRecord.id)
            .single();
          if (updated?.extracted_text) {
            setEditalText(updated.extracted_text);
          }
        }
        toast({ title: "Edital processado!", description: "Texto extraído do PDF." });
      } catch (err: any) {
        toast({ title: "Erro ao processar edital", description: err.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Formato não suportado", description: "Envie PDF ou TXT.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generatePlan = async () => {
    if (!user || !examDate) {
      toast({ title: "Preencha a data da prova", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          examDate: format(examDate, "yyyy-MM-dd"),
          hoursPerDay: Number(hoursPerDay),
          daysPerWeek: Number(daysPerWeek),
          editalText: editalText || null,
          currentPlanId: planId,
        }),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      const plan = result.plan.plan_json as PlanJson;
      setPlanId(result.plan.id);
      setSchedule(plan.weeklySchedule || []);
      setSubjects(plan.subjects || []);
      setTips(plan.tips || "");
      setShowConfig(false);
      toast({ title: "Cronograma gerado!", description: "Você pode editar os blocos manualmente." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar cronograma", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const savePlan = async (updatedSchedule: DaySchedule[]) => {
    if (planId) {
      await supabase.from("study_plans").update({
        plan_json: JSON.parse(JSON.stringify({ weeklySchedule: updatedSchedule, subjects, tips, config: { examDate: examDate?.toISOString() || "", hoursPerDay: Number(hoursPerDay), daysPerWeek: Number(daysPerWeek), hasEdital: !!editalText } })),
      }).eq("id", planId);
    }
  };

  const taskKey = (dayIndex: number, taskIndex: number) => {
    const day = schedule[dayIndex];
    const task = day.tasks[taskIndex];
    return `${day.day}-${task.time}-${task.subject}`;
  };

  const toggleComplete = async (dayIndex: number, taskIndex: number) => {
    if (!user || !planId) return;
    const key = taskKey(dayIndex, taskIndex);
    const task = schedule[dayIndex].tasks[taskIndex];
    const isCompleted = completedKeys.has(key);

    if (isCompleted) {
      // Uncomplete
      const taskId = completedTaskIds[key];
      if (taskId) {
        await supabase.from("study_tasks").delete().eq("id", taskId);
      }
      setCompletedKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
      setCompletedTaskIds((prev) => { const next = { ...prev }; delete next[key]; return next; });
    } else {
      // Complete
      const { data } = await supabase.from("study_tasks").insert({
        user_id: user.id,
        study_plan_id: planId,
        completed: true,
        task_json: { key, subject: task.subject, duration: task.duration, time: task.time, day: schedule[dayIndex].day },
      }).select("id").single();
      if (data) {
        setCompletedKeys((prev) => new Set(prev).add(key));
        setCompletedTaskIds((prev) => ({ ...prev, [key]: data.id }));
      }
    }
  };

  const removeTask = async (dayIndex: number, taskIndex: number) => {
    const updated = schedule.map((day, di) => {
      if (di !== dayIndex) return day;
      return { ...day, tasks: day.tasks.filter((_, ti) => ti !== taskIndex) };
    });
    setSchedule(updated);
    await savePlan(updated);
  };

  const startEdit = (dayIndex: number, taskIndex: number) => {
    setEditingTask({ day: dayIndex, task: taskIndex });
    setEditValues({ ...schedule[dayIndex].tasks[taskIndex] });
  };

  const saveEdit = async () => {
    if (!editingTask) return;
    const updated = schedule.map((day, di) => {
      if (di !== editingTask.day) return day;
      return { ...day, tasks: day.tasks.map((t, ti) => ti === editingTask.task ? { ...t, ...editValues } : t) };
    });
    setSchedule(updated);
    setEditingTask(null);
    await savePlan(updated);
    toast({ title: "Bloco atualizado!" });
  };

  const handleDragStart = (dayIndex: number, taskIndex: number, e: React.DragEvent) => {
    setDragSource({ day: dayIndex, task: taskIndex });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${dayIndex}-${taskIndex}`);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragSource(null);
    setDragOver(null);
  };

  const handleDragOver = (dayIndex: number, taskIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver({ day: dayIndex, task: taskIndex });
  };

  const handleDragOverDay = (dayIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const daySchedule = schedule[dayIndex];
    setDragOver({ day: dayIndex, task: daySchedule.tasks.length });
  };

  const handleDrop = async (targetDay: number, targetTask: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragSource) return;

    const updated = schedule.map((d) => ({ ...d, tasks: [...d.tasks] }));
    const [removed] = updated[dragSource.day].tasks.splice(dragSource.task, 1);

    // Adjust target index if moving within same day and source was before target
    let adjustedTarget = targetTask;
    if (dragSource.day === targetDay && dragSource.task < targetTask) {
      adjustedTarget--;
    }

    updated[targetDay].tasks.splice(adjustedTarget, 0, removed);
    setSchedule(updated);
    setDragSource(null);
    setDragOver(null);
    await savePlan(updated);
  };

  const daysUntilExam = examDate ? Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rows = schedule.flatMap((day) =>
      day.tasks.map((t) => `<tr><td>${day.day}</td><td>${t.time}</td><td>${t.subject}</td><td>${t.duration}</td><td>${t.type === "revisao" ? "Revisão" : t.type === "simulado" ? "Simulado" : "Estudo"}</td></tr>`)
    ).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Cronograma de Estudos</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#1a1a1a}h1{font-size:22px;margin-bottom:4px}p{color:#666;margin-bottom:20px;font-size:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}.tip{margin-top:20px;padding:12px;background:#f0f9ff;border-left:4px solid #3b82f6;font-size:13px;border-radius:4px}.subjects{margin-top:16px;font-size:13px}.subjects span{display:inline-block;background:#e0e7ff;color:#3730a3;padding:2px 10px;border-radius:12px;margin:2px 4px;font-size:12px}</style></head><body>
<h1>📅 Cronograma de Estudos</h1>
<p>${daysUntilExam && daysUntilExam > 0 ? `${daysUntilExam} dias até a prova • ${hoursPerDay}h/dia • ${daysPerWeek} dias/semana` : ""}</p>
<table><thead><tr><th>Dia</th><th>Horário</th><th>Matéria</th><th>Duração</th><th>Tipo</th></tr></thead><tbody>${rows}</tbody></table>
${tips ? `<div class="tip">💡 ${tips}</div>` : ""}
${subjects.length > 0 ? `<div class="subjects"><strong>Matérias:</strong> ${subjects.map(s => `<span>${s}</span>`).join("")}</div>` : ""}
</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const typeColor = (type?: string) => {
    switch (type) {
      case "revisao": return "border-l-4 border-l-accent";
      case "simulado": return "border-l-4 border-l-warning";
      default: return "border-l-4 border-l-primary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Cronograma de Estudos
          </h1>
          <p className="text-muted-foreground">
            {daysUntilExam !== null && daysUntilExam > 0
              ? `${daysUntilExam} dias até a prova • ${hoursPerDay}h/dia • ${daysPerWeek} dias/semana`
              : "Configure seu plano de estudos personalizado."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {schedule.length > 0 && (
            <>
              <Button variant={reminders.enabled ? "default" : "outline"} size="sm" onClick={reminders.toggle}>
                {reminders.enabled ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
                {reminders.enabled ? "Lembretes On" : "Lembretes"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowReprocess(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reprocessar Plano
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Configurar
          </Button>
          <Button size="sm" onClick={() => {
            setPlanId(null);
            setSchedule([]);
            setSubjects([]);
            setTips("");
            setExamDate(undefined);
            setHoursPerDay("4");
            setDaysPerWeek("5");
            setEditalText("");
            setEditalFileName("");
            setShowConfig(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cronograma
          </Button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="glass-card p-6 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Configurações do Plano
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Exam Date */}
            <div className="space-y-2">
              <Label>Data da prova</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !examDate && "text-muted-foreground")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {examDate ? format(examDate, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={examDate}
                    onSelect={setExamDate}
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hours per day */}
            <div className="space-y-2">
              <Label>Horas de estudo por dia</Label>
              <Select value={hoursPerDay} onValueChange={setHoursPerDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((h) => (
                    <SelectItem key={h} value={String(h)}>{h}h por dia</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Days per week */}
            <div className="space-y-2">
              <Label>Dias de estudo por semana</Label>
              <Select value={daysPerWeek} onValueChange={setDaysPerWeek}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Edital Upload */}
          <div className="space-y-2">
            <Label>Edital do concurso (opcional)</Label>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={handleEditalUpload} />
            <div
              className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {editalFileName ? (
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{editalFileName}</span>
                  <span className="text-xs text-muted-foreground">✓ carregado</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-primary/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Envie o edital (PDF ou TXT) para personalizar seu plano</p>
                </>
              )}
            </div>
          </div>

          <Button onClick={generatePlan} disabled={generating || !examDate} className="w-full">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando cronograma com IA...
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4 mr-2" />
                {schedule.length > 0 ? "Regenerar Cronograma" : "Gerar Cronograma com IA"}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Reprocess Panel */}
      {showReprocess && (
        <div className="glass-card p-6 space-y-4 border-2 border-primary/30">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Reprocessar Plano com Nova Data
          </h2>
          <p className="text-sm text-muted-foreground">
            O plano será regenerado mantendo os conteúdos/matérias existentes, redistribuindo os blocos para a nova data da prova.
          </p>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Nova data da prova</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal", !newExamDate && "text-muted-foreground")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {newExamDate ? format(newExamDate, "dd/MM/yyyy") : "Selecionar nova data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newExamDate}
                    onSelect={setNewExamDate}
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={reprocessPlan} disabled={reprocessing || !newExamDate}>
              {reprocessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {reprocessing ? "Reprocessando..." : "Reprocessar"}
            </Button>
            <Button variant="ghost" onClick={() => setShowReprocess(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {tips && (
        <div className="glass-card p-4 border-l-4 border-l-accent">
          <p className="text-sm text-muted-foreground">💡 {tips}</p>
        </div>
      )}

      {/* Schedule Grid */}
      {schedule.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedule.map((day, dayIndex) => (
            <div
              key={day.day}
              className="glass-card p-5"
              onDragOver={(e) => handleDragOverDay(dayIndex, e)}
              onDrop={(e) => handleDrop(dayIndex, schedule[dayIndex].tasks.length, e)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-primary">{day.day}</h3>
                <span className="text-xs text-muted-foreground">
                  {day.tasks.filter((t) => completedKeys.has(`${day.day}-${t.time}-${t.subject}`)).length}/{day.tasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {day.tasks.map((task, taskIndex) => {
                  const isEditing = editingTask?.day === dayIndex && editingTask?.task === taskIndex;
                  const isDragTarget = dragOver?.day === dayIndex && dragOver?.task === taskIndex;
                  const key = `${day.day}-${task.time}-${task.subject}`;
                  const isCompleted = completedKeys.has(key);
                  return isEditing ? (
                    <div key={taskIndex} className={`p-3 rounded-lg bg-secondary/50 space-y-2 ${typeColor(task.type)}`}>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={editValues.time}
                          onChange={(e) => setEditValues(v => ({ ...v, time: e.target.value }))}
                          placeholder="08:00"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={editValues.duration}
                          onChange={(e) => setEditValues(v => ({ ...v, duration: e.target.value }))}
                          placeholder="2h"
                          className="h-8 text-xs"
                        />
                      </div>
                      <Input
                        value={editValues.subject}
                        onChange={(e) => setEditValues(v => ({ ...v, subject: e.target.value }))}
                        placeholder="Matéria"
                        className="h-8 text-xs"
                      />
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTask(null)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="default" size="icon" className="h-7 w-7" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={taskIndex}
                      draggable
                      onDragStart={(e) => handleDragStart(dayIndex, taskIndex, e)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(dayIndex, taskIndex, e)}
                      onDrop={(e) => { e.stopPropagation(); handleDrop(dayIndex, taskIndex, e); }}
                      className={`flex gap-2 items-start p-3 rounded-lg transition-all cursor-grab active:cursor-grabbing ${typeColor(task.type)} ${isDragTarget ? "ring-2 ring-primary/50 ring-offset-1" : ""} ${isCompleted ? "bg-primary/5 opacity-75" : "bg-secondary/50"}`}
                    >
                      <button
                        aria-label={isCompleted ? "Desmarcar como concluído" : "Marcar como concluído"}
                        title={isCompleted ? "Desmarcar" : "Concluir"}
                        onClick={() => toggleComplete(dayIndex, taskIndex)}
                        className="mt-0.5 flex-shrink-0 transition-colors"
                      >
                        {isCompleted
                          ? <CheckCircle2 className="h-4 w-4 text-primary" />
                          : <Circle className="h-4 w-4 text-muted-foreground/50 hover:text-primary" />
                        }
                      </button>
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${isCompleted ? "line-through text-muted-foreground" : ""}`}>{task.subject}</div>
                        <div className="text-xs text-muted-foreground">{task.time} • {task.duration}</div>
                      </div>
                      <button aria-label="Editar bloco" title="Editar" onClick={() => startEdit(dayIndex, taskIndex)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button aria-label="Remover bloco" title="Remover" onClick={() => removeTask(dayIndex, taskIndex)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : !showConfig ? (
        <div className="glass-card p-12 text-center">
          <GraduationCap className="h-12 w-12 text-primary/30 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Nenhum cronograma configurado</p>
          <p className="text-sm text-muted-foreground mb-4">Configure a data da prova e horas de estudo para gerar seu plano.</p>
          <Button onClick={() => setShowConfig(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Configurar agora
          </Button>
        </div>
      ) : null}

      {/* Subjects */}
      {subjects.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">Matérias do plano</h3>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <span key={s} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPlan;
