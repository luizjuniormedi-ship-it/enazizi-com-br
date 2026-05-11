/**
 * @legacy-write
 * @deprecated-flow — APOSENTADO na sprint final do Planner.
 *
 * Componente do shape semanal (weeklySchedule). Lê e escreve em study_plans + study_tasks (legado).
 * NÃO é mais montado pelo CronogramaInteligente nem por nenhuma rota ativa do ENAZIZI.
 *
 * Fonte viva oficial do Planner: daily_plans + daily_plan_tasks (estrutura diária).
 *
 * NÃO REMONTAR sem redesign do shape semanal para o shape diário.
 */
import { CalendarDays, Clock, BookOpen, Upload, Loader2, Settings2, Trash2, GraduationCap, Plus, Pencil, Check, FileDown, Bell, BellOff, GripVertical, CheckCircle2, Circle, MessageSquare, Layers, Sparkles, ArrowRight } from "lucide-react";
import StudyBlockActions from "./StudyBlockActions";
import { useNavigate } from "react-router-dom";
import { encodeStudyContext } from "@/lib/studyContext";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useStudyReminders } from "@/hooks/useStudyReminders";

interface Task {
  time: string;
  subject: string;
  duration: string;
  type?: string;
  details?: string;
}

interface DaySchedule {
  day: string;
  tasks: Task[];
}

interface TopicMapItem {
  topic: string;
  subtopics: string[];
}

interface PlanJson {
  weeklySchedule?: DaySchedule[];
  subjects?: string[];
  topicMap?: TopicMapItem[];
  tips?: string;
  detectedSpecialty?: string;
  totalTopicsExtracted?: number;
  config?: {
    examDate: string;
    hoursPerDay: number;
    daysPerWeek: number;
    hasEdital: boolean;
  };
}

interface SyncSummary {
  temasRegistrados: number;
  flashcardsCriados: number;
  questoesVinculadas: number;
  revisoesAgendadas: number;
}

interface StudyPlanContentProps {
  onSubjectsGenerated?: (subjects: string[]) => Promise<SyncSummary | void>;
  onSyncComplete?: () => void;
}

const StudyPlanContent = ({ onSubjectsGenerated, onSyncComplete }: StudyPlanContentProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [examDate, setExamDate] = useState<Date>();
  const [hoursPerDay, setHoursPerDay] = useState("4");
  const [daysPerWeek, setDaysPerWeek] = useState("5");
  const [editalText, setEditalText] = useState("");
  const [editalFileName, setEditalFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [planId, setPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const reminders = useStudyReminders(schedule);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topicMap, setTopicMap] = useState<TopicMapItem[]>([]);
  const [detectedSpecialty, setDetectedSpecialty] = useState("");
  const [tips, setTips] = useState("");
  const [generating, setGenerating] = useState(false);
  const [processingEdital, setProcessingEdital] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [editingTask, setEditingTask] = useState<{ day: number; task: number } | null>(null);
  const [editValues, setEditValues] = useState<Task>({ time: "", subject: "", duration: "" });
  const [generationStep, setGenerationStep] = useState(0);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [dragSource, setDragSource] = useState<{ day: number; task: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ day: number; task: number } | null>(null);
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, string>>({});

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
        setTopicMap(plan.topicMap || []);
        setDetectedSpecialty(plan.detectedSpecialty || "");
        setTips(plan.tips || "");
        if (plan.config) {
          if (plan.config.examDate) setExamDate(new Date(plan.config.examDate));
          setHoursPerDay(String(plan.config.hoursPerDay || 4));
          setDaysPerWeek(String(plan.config.daysPerWeek || 5));
        }

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
    setProcessingEdital(true);
    
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      try {
        const buffer = await file.arrayBuffer();
        let text: string;
        try {
          const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
          text = utf8;
        } catch {
          text = new TextDecoder("latin1").decode(buffer);
        }
        setEditalText(text);
        toast({ title: "Edital carregado!", description: `${file.name} processado.` });
      } catch (err) {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      } finally {
        setProcessingEdital(false);
      }
    } else if (file.type === "application/pdf" || 
               file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
               file.name.endsWith(".docx") || 
               file.name.endsWith(".doc")) {
      if (!user) {
        setProcessingEdital(false);
        return;
      }
      try {
        const ext = file.name.split(".").pop();
        const storagePath = `${user.id}/edital-${Date.now()}.${ext}`;
        const { error: storageError } = await supabase.storage.from("user-uploads").upload(storagePath, file);
        if (storageError) throw storageError;
        
        const { data: uploadRecord, error: dbError } = await supabase
          .from("uploads")
          .insert({ 
            user_id: user.id, 
            filename: file.name, 
            file_type: ext || "pdf", 
            category: "edital", 
            storage_path: storagePath, 
            status: "uploaded" 
          })
          .select()
          .single();
          
        if (dbError) throw dbError;
        
        const { data: session } = await supabase.auth.getSession();
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({ uploadId: uploadRecord.id }),
        });
        
        if (resp.ok) {
          let attempts = 0;
          const maxAttempts = 60; // Increased from 20 to 60 (2 minutes)
          const pollInterval = setInterval(async () => {
            attempts++;
            const { data: updated } = await supabase
              .from("uploads")
              .select("extracted_text, status, extracted_json")
              .eq("id", uploadRecord.id)
              .single();
            
            if (updated?.extracted_text) {
              setEditalText(updated.extracted_text);
              toast({ title: "Edital processado!", description: `Conteúdo completo extraído de ${file.name}.` });
              setProcessingEdital(false);
              clearInterval(pollInterval);
            } else if (updated?.status === "error" || attempts >= maxAttempts) {
              const errorMsg = (updated?.extracted_json as any)?.error || "Tempo limite excedido no processamento.";
              toast({ title: "Erro no processamento", description: errorMsg, variant: "destructive" });
              setProcessingEdital(false);
              clearInterval(pollInterval);
            }
          }, 2000);
        } else {
          setProcessingEdital(false);
          throw new Error("Falha ao iniciar processamento");
        }
      } catch (err: any) {
        setProcessingEdital(false);
        toast({ title: "Erro ao processar edital", description: err.message, variant: "destructive" });
      }
    } else {
      setProcessingEdital(false);
      toast({ title: "Formato não suportado", description: "Envie PDF, TXT ou DOCX.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generatePlan = async () => {
    if (!user || !examDate) {
      toast({ title: "Preencha a data da prova", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGenerationStep(1);
    setSyncSummary(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      setGenerationStep(2);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 160000); // 160s frontend timeout
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({
          examDate: format(examDate, "yyyy-MM-dd"),
          hoursPerDay: Number(hoursPerDay),
          daysPerWeek: Number(daysPerWeek),
          editalText: editalText || null,
          currentPlanId: planId,
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "A IA não conseguiu gerar seu cronograma. Tente novamente ou use um edital mais curto.");
      setGenerationStep(3);
      const plan = result.plan.plan_json as PlanJson;
      setPlanId(result.plan.id);
      setSchedule(plan.weeklySchedule || []);
      setSubjects(plan.subjects || []);
      setTopicMap(plan.topicMap || []);
      setDetectedSpecialty(plan.detectedSpecialty || "");
      setTips(plan.tips || "");
      setShowConfig(false);
      if (onSubjectsGenerated && plan.subjects && plan.subjects.length > 0) {
        setGenerationStep(4);
        const syncResult = await onSubjectsGenerated(plan.subjects);
        if (syncResult) {
          setSyncSummary(syncResult);
        }
      }
      toast({ title: "Cronograma gerado!", description: "Plano de estudos criado e módulos sincronizados." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar cronograma", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setGenerationStep(0);
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
      const taskId = completedTaskIds[key];
      if (taskId) await supabase.from("study_tasks").delete().eq("id", taskId);
      setCompletedKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
      setCompletedTaskIds((prev) => { const next = { ...prev }; delete next[key]; return next; });
    } else {
      const { data } = await supabase.from("study_tasks").insert({
        user_id: user.id, study_plan_id: planId, completed: true,
        task_json: { key, subject: task.subject, duration: task.duration, time: task.time, day: schedule[dayIndex].day },
      }).select("id").single();
      if (data) {
        setCompletedKeys((prev) => new Set(prev).add(key));
        setCompletedTaskIds((prev) => ({ ...prev, [key]: data.id }));
      }
    }
  };

  const removeTask = async (dayIndex: number, taskIndex: number) => {
    const updated = schedule.map((day, di) => di !== dayIndex ? day : { ...day, tasks: day.tasks.filter((_, ti) => ti !== taskIndex) });
    setSchedule(updated);
    await savePlan(updated);
  };

  const startEdit = (dayIndex: number, taskIndex: number) => {
    setEditingTask({ day: dayIndex, task: taskIndex });
    setEditValues({ ...schedule[dayIndex].tasks[taskIndex] });
  };

  const saveEdit = async () => {
    if (!editingTask) return;
    const updated = schedule.map((day, di) => di !== editingTask.day ? day : { ...day, tasks: day.tasks.map((t, ti) => ti === editingTask.task ? { ...t, ...editValues } : t) });
    setSchedule(updated);
    setEditingTask(null);
    await savePlan(updated);
    toast({ title: "Bloco atualizado!" });
  };

  const handleDragStart = (dayIndex: number, taskIndex: number, e: React.DragEvent) => {
    setDragSource({ day: dayIndex, task: taskIndex });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${dayIndex}-${taskIndex}`);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
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
    setDragOver({ day: dayIndex, task: schedule[dayIndex].tasks.length });
  };

  const handleDrop = async (targetDay: number, targetTask: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragSource) return;
    const updated = schedule.map((d) => ({ ...d, tasks: [...d.tasks] }));
    const [removed] = updated[dragSource.day].tasks.splice(dragSource.task, 1);
    let adjustedTarget = targetTask;
    if (dragSource.day === targetDay && dragSource.task < targetTask) adjustedTarget--;
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
      case "revisao": return "border-l-4 border-l-amber-500";
      case "simulado": return "border-l-4 border-l-rose-500";
      case "questoes": return "border-l-4 border-l-emerald-500";
      default: return "border-l-4 border-l-primary";
    }
  };

  const typeBadge = (type?: string) => {
    switch (type) {
      case "revisao": return { label: "Revisão", className: "bg-amber-500/10 text-amber-600" };
      case "simulado": return { label: "Simulado", className: "bg-rose-500/10 text-rose-600" };
      case "questoes": return { label: "Questões", className: "bg-emerald-500/10 text-emerald-600" };
      default: return { label: "Estudo", className: "bg-primary/10 text-primary" };
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Plano de Estudos até a Prova
          </h2>
          <p className="text-sm text-muted-foreground">
            {daysUntilExam !== null && daysUntilExam > 0
              ? `${daysUntilExam} dias até a prova • ${hoursPerDay}h/dia • ${daysPerWeek} dias/semana`
              : "Configure data da prova e envie o edital para gerar seu plano."}
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
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Configurar
          </Button>
          <Button size="sm" onClick={() => {
            setPlanId(null); setSchedule([]); setSubjects([]); setTopicMap([]); setDetectedSpecialty(""); setTips("");
            setExamDate(undefined); setHoursPerDay("4"); setDaysPerWeek("5");
            setEditalText(""); setEditalFileName(""); setShowConfig(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </div>
      </div>

      {showConfig && (
        <div className="glass-card p-6 space-y-5">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Configurações do Plano
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Calendar mode="single" selected={examDate} onSelect={setExamDate} disabled={(date) => date < new Date()} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Horas de estudo por dia</Label>
              <Select value={hoursPerDay} onValueChange={setHoursPerDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((h) => (
                    <SelectItem key={h} value={String(h)}>{h}h por dia</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dias de estudo por semana</Label>
              <Select value={daysPerWeek} onValueChange={setDaysPerWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Edital do concurso (opcional)</Label>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx,.doc" className="hidden" onChange={handleEditalUpload} />
            <div 
              className={cn(
                "border-2 border-dashed border-primary/30 rounded-lg p-4 text-center transition-colors cursor-pointer",
                processingEdital ? "bg-primary/5 cursor-wait" : "hover:border-primary/50"
              )} 
              onClick={() => !processingEdital && fileInputRef.current?.click()}
            >
              {processingEdital ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium">Extraindo texto do documento...</p>
                  <p className="text-xs text-muted-foreground">Aguarde, isso pode levar alguns segundos.</p>
                </div>
              ) : editalFileName ? (
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{editalFileName}</span>
                  <span className="text-xs text-muted-foreground">✓ carregado</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-primary/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Envie o edital (PDF, DOCX ou TXT) para personalizar seu plano</p>
                </>
              )}
            </div>
          </div>
          <Button onClick={generatePlan} disabled={generating || processingEdital || !examDate} className="w-full">
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{
                generationStep === 1 ? "Analisando documento..." :
                generationStep === 2 ? "Extraindo temas e subtópicos..." :
                generationStep === 3 ? "Gerando cronograma semanal..." :
                generationStep === 4 ? "Sincronizando módulos..." :
                "Preparando..."
              }</>
            ) : (
              <><CalendarDays className="h-4 w-4 mr-2" />{schedule.length > 0 ? "Regenerar Cronograma" : "Gerar Cronograma com IA"}</>
            )}
          </Button>
          {generating && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span>{Math.round((generationStep / 4) * 100)}%</span>
              </div>
              <Progress value={(generationStep / 4) * 100} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className={generationStep >= 1 ? "text-primary font-medium" : ""}>Análise</span>
                <span className={generationStep >= 2 ? "text-primary font-medium" : ""}>Extração</span>
                <span className={generationStep >= 3 ? "text-primary font-medium" : ""}>Cronograma</span>
                <span className={generationStep >= 4 ? "text-primary font-medium" : ""}>Sincronização</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post-sync summary card */}
      {syncSummary && !generating && (
        <div className="glass-card p-5 border-l-4 border-l-primary animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Plano Gerado com Sucesso!</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Seu cronograma foi criado. Agora vamos transformar planejamento em ação.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{syncSummary.temasRegistrados}</p>
              <p className="text-xs text-muted-foreground">Temas registrados</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{syncSummary.flashcardsCriados}</p>
              <p className="text-xs text-muted-foreground">Flashcards criados</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{syncSummary.questoesVinculadas}</p>
              <p className="text-xs text-muted-foreground">Questões encontradas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{syncSummary.revisoesAgendadas}</p>
              <p className="text-xs text-muted-foreground">Revisões agendadas</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="lg" className="flex-1 h-12 text-base font-semibold gap-2" onClick={() => navigate("/dashboard?autostart=true&source=planner")}>
              <Sparkles className="h-5 w-5" /> Começar a estudar agora
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSyncComplete?.()}>
              <ArrowRight className="h-4 w-4 mr-1" /> Ver agenda
            </Button>
          </div>
        </div>
      )}

      {tips && (
        <div className="glass-card p-4 border-l-4 border-l-accent">
          <p className="text-sm text-muted-foreground">💡 {tips}</p>
        </div>
      )}

      {schedule.length > 0 ? (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 items-center text-xs text-muted-foreground">
            <span className="font-medium">Legenda:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary" /> Estudo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500" /> Revisão</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Questões</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-500" /> Simulado</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedule.map((day, dayIndex) => (
            <div key={day.day} className="glass-card p-5" onDragOver={(e) => handleDragOverDay(dayIndex, e)} onDrop={(e) => handleDrop(dayIndex, schedule[dayIndex].tasks.length, e)}>
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
                        <Input value={editValues.time} onChange={(e) => setEditValues(v => ({ ...v, time: e.target.value }))} placeholder="08:00" className="h-8 text-xs" />
                        <Input value={editValues.duration} onChange={(e) => setEditValues(v => ({ ...v, duration: e.target.value }))} placeholder="2h" className="h-8 text-xs" />
                      </div>
                      <Input value={editValues.subject} onChange={(e) => setEditValues(v => ({ ...v, subject: e.target.value }))} placeholder="Matéria" className="h-8 text-xs" />
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTask(null)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="default" size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
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
                      className={`p-3 rounded-lg transition-all cursor-grab active:cursor-grabbing ${typeColor(task.type)} ${isDragTarget ? "ring-2 ring-primary/50 ring-offset-1" : ""} ${isCompleted ? "bg-primary/5 opacity-75" : "bg-secondary/50"}`}
                    >
                      <div className="flex gap-2 items-start">
                        <button onClick={() => toggleComplete(dayIndex, taskIndex)} className="mt-0.5 flex-shrink-0 transition-colors">
                          {isCompleted ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground/50 hover:text-primary" />}
                        </button>
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>{task.subject}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeBadge(task.type).className}`}>{typeBadge(task.type).label}</span>
                          </div>
                          {task.details && <div className="text-xs text-muted-foreground/80 mt-0.5 mb-1 line-clamp-2">{task.details}</div>}
                          <div className="text-xs text-muted-foreground">{task.time} • {task.duration}</div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => startEdit(dayIndex, taskIndex)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeTask(dayIndex, taskIndex)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {/* Quick action buttons - direct links */}
                      {!isCompleted && (
                        <div className="flex gap-1.5 mt-2 ml-10">
                          <button
                            onClick={() => navigate(`/dashboard/mentor?${encodeStudyContext({ source: "planner", topic: task.subject, objective: "new_content" })}`)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors font-medium"
                          >
                            <MessageSquare className="h-3 w-3" /> Tutor IA
                          </button>
                          <button
                            onClick={() => navigate(`/dashboard/flashcards?${encodeStudyContext({ source: "planner", topic: task.subject, objective: "review" })}`)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition-colors font-medium"
                          >
                            <Layers className="h-3 w-3" /> Flashcards
                          </button>
                          <button
                            onClick={() => navigate(`/dashboard/gerador-questoes?topic=${encodeURIComponent(task.subject)}`)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors font-medium"
                          >
                            <BookOpen className="h-3 w-3" /> Questões
                          </button>
                          <StudyBlockActions subject={task.subject} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </>
      ) : !showConfig ? (
        <div className="glass-card p-12 text-center">
          <GraduationCap className="h-12 w-12 text-primary/30 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Nenhum plano configurado</p>
          <p className="text-sm text-muted-foreground mb-4">Configure a data da prova e envie o edital para gerar seu plano de estudos.</p>
          <Button onClick={() => setShowConfig(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Configurar agora
          </Button>
        </div>
      ) : null}

      {/* Topic Map with subtopics */}
      {topicMap.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Mapa de Tópicos{detectedSpecialty ? ` — ${detectedSpecialty}` : ""}</h3>
            <span className="text-xs text-muted-foreground ml-auto">{topicMap.length} temas</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topicMap.map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/50 border-l-4 border-l-primary">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">{item.topic}</span>
                  <button
                    onClick={() => navigate(`/dashboard/mentor?${encodeStudyContext({ source: "planner", topic: item.topic, objective: "new_content" })}`)}
                    className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors font-medium"
                  >
                    <MessageSquare className="h-3 w-3" /> Estudar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.subtopics.map((sub, j) => (
                    <span key={j} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{sub}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: simple subjects list if no topicMap */}
      {topicMap.length === 0 && subjects.length > 0 && (
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

export default StudyPlanContent;
