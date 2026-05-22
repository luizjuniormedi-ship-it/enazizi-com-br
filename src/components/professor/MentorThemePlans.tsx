import { useState, useEffect, useCallback } from "react";
import { BookMarked, Plus, Loader2, Users, Trash2, Calendar, BarChart3 } from "lucide-react";
import MentorshipReport from "@/components/professor/MentorshipReport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import StudentInstitutionPicker from "./proficiencia/StudentInstitutionPicker";

interface MentorPlan {
  id: string;
  name: string;
  description: string | null;
  exam_date: string | null;
  status: string;
  created_at: string;
  topics?: { id: string; topic: string; subtopic: string | null; priority: number }[];
  targets?: { id: string; target_type: string; target_id: string }[];
}

interface SelectedStudent {
  user_id: string;
  display_name: string;
}

const MentorThemePlans = ({ callAPI }: { callAPI?: (body: Record<string, unknown>) => Promise<any> }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<MentorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examDate, setExamDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<{ topic: string; subtopic: string }[]>([]);
  const [currentTopic, setCurrentTopic] = useState("");
  const [currentSubtopic, setCurrentSubtopic] = useState("");

  // Distribution
  const [selectedStudents, setSelectedStudents] = useState<{ id: string; name: string }[]>([]);

  // Detail view
  const [reportPlan, setReportPlan] = useState<MentorPlan | null>(null);

  const loadPlans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: plansData } = await supabase
        .from("mentor_theme_plans")
        .select("*")
        .eq("professor_id", user.id)
        .order("created_at", { ascending: false });

      if (plansData && plansData.length > 0) {
        const planIds = plansData.map(p => p.id);
        const [{ data: topics }, { data: targets }] = await Promise.all([
          supabase.from("mentor_theme_plan_topics").select("*").in("plan_id", planIds),
          supabase.from("mentor_theme_plan_targets").select("*").in("plan_id", planIds),
        ]);

        const enriched = plansData.map(p => ({
          ...p,
          topics: (topics || []).filter(t => t.plan_id === p.id),
          targets: (targets || []).filter(t => t.plan_id === p.id),
        }));
        setPlans(enriched);
      } else {
        setPlans([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const addTopic = () => {
    if (!currentTopic.trim()) return;
    setSelectedTopics(prev => [...prev, { topic: currentTopic.trim(), subtopic: currentSubtopic.trim() }]);
    setCurrentTopic("");
    setCurrentSubtopic("");
  };

  const removeTopic = (idx: number) => {
    setSelectedTopics(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!user || !name.trim() || selectedTopics.length === 0 || selectedStudents.length === 0) {
      toast({ title: "Preencha nome, temas e selecione alunos", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const { data: plan, error: planErr } = await supabase
        .from("mentor_theme_plans")
        .insert({
          professor_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          exam_date: examDate || null,
          status: "active",
        })
        .select("id")
        .single();
      if (planErr || !plan) throw planErr;

      const topicRows = selectedTopics.map((t, i) => ({
        plan_id: plan.id,
        topic: t.topic,
        subtopic: t.subtopic || null,
        priority: selectedTopics.length - i,
      }));
      await supabase.from("mentor_theme_plan_topics").insert(topicRows);

      // Insert targets - always as individual students for simplicity and precision
      const targetInserts = selectedStudents.map(s => ({
        plan_id: plan.id,
        target_type: "student",
        target_id: s.id
      }));

      if (targetInserts.length > 0) {
        const { error: targetErr } = await supabase.from("mentor_theme_plan_targets").insert(targetInserts);
        if (targetErr) throw targetErr;
      }

      // Collect all student IDs for progress
      const studentIds = selectedStudents.map(s => s.id);

      if (studentIds.length > 0) {
        const { data: insertedTopics } = await supabase
          .from("mentor_theme_plan_topics")
          .select("id")
          .eq("plan_id", plan.id);

        if (insertedTopics && insertedTopics.length > 0) {
          const progressRows = studentIds.flatMap(uid =>
            insertedTopics.map(t => ({
              plan_id: plan.id,
              topic_id: t.id,
              user_id: uid,
              status: "pending" as const,
            }))
          );
          
          // Batch inserts of 100
          for (let i = 0; i < progressRows.length; i += 100) {
            const { error: progErr } = await supabase
              .from("mentor_theme_plan_progress")
              .insert(progressRows.slice(i, i + 100));
            if (progErr) throw progErr;
          }
        }
      }

      toast({ title: "Mentoria criada!", description: `"${name}" publicada para ${studentIds.length} aluno(s).` });
      setShowCreate(false);
      resetForm();
      loadPlans();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Erro ao criar", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setExamDate("");
    setSelectedTopics([]);
    setCurrentTopic("");
    setCurrentSubtopic("");
    setSelectedStudents([]);
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta mentoria?")) return;
    await supabase.from("mentor_theme_plans").delete().eq("id", planId);
    toast({ title: "Mentoria removida" });
    loadPlans();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  if (reportPlan) {
    return <MentorshipReport plan={reportPlan} onBack={() => { setReportPlan(null); loadPlans(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-primary" />
          Mentoria de Temas
        </h2>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nova Mentoria
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <BookMarked className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Nenhuma mentoria criada</p>
            <p className="text-xs">Crie uma mentoria para sugerir temas e data da prova aos seus alunos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {plans.map(plan => (
            <Card key={plan.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{plan.name}</h3>
                      <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {plan.status === "active" ? "Ativa" : "Rascunho"}
                      </Badge>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{plan.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {plan.topics?.map(t => (
                        <Badge key={t.id} variant="outline" className="text-[10px]">
                          {t.topic}{t.subtopic ? ` → ${t.subtopic}` : ""}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      {plan.exam_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Prova: {new Date(plan.exam_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {plan.targets?.length || 0} alunos
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReportPlan(plan)}>
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePlan(plan.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <TeacherDialogContent
          maxWidth="max-w-2xl"
          header={<DialogTitle>Nova Mentoria de Temas</DialogTitle>}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar e Publicar
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label>Nome da mentoria *</Label>
                <Input placeholder="Ex: Preparatório Clínica Médica" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea placeholder="Objetivos e orientações..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Data da prova (opcional)</Label>
                <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
              </div>

              {/* Topics */}
              <div className="space-y-2">
                <Label className="font-semibold">Temas de Estudo *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o tema (ex: Cardiologia)"
                    value={currentTopic}
                    onChange={e => setCurrentTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTopic())}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={addTopic} disabled={!currentTopic.trim()}>Add</Button>
                </div>
                <Input
                  placeholder="Subtópico (opcional)"
                  value={currentSubtopic}
                  onChange={e => setCurrentSubtopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTopic())}
                />
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
                  {selectedTopics.map((t, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 py-1">
                      {t.topic}{t.subtopic ? ` → ${t.subtopic}` : ""}
                      <button type="button" onClick={() => removeTopic(i)} className="hover:text-destructive ml-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedTopics.length === 0 && <p className="text-[10px] text-muted-foreground">Nenhum tema adicionado.</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4 border-l pl-6 border-border">
              <Label className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Distribuição *
              </Label>
              <StudentInstitutionPicker
                selected={selectedStudents}
                onChange={setSelectedStudents}
              />
            </div>
          </div>
        </TeacherDialogContent>
      </Dialog>
    </div>
  );
};

export default MentorThemePlans;
