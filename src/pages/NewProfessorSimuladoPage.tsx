import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  GraduationCap, 
  ChevronLeft, 
  Save, 
  ClipboardCheck, 
  Loader2,
  FileText,
  BrainCircuit,
  Users,
  Settings2,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CinematicHero } from "@/components/cinematic";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { useCreateSimuladoForm } from "@/components/professor/useCreateSimuladoForm";

// Reusing sub-components
import SimuladoBasicForm from "@/components/professor/SimuladoBasicForm";
import SimuladoTopicsPicker from "@/components/professor/SimuladoTopicsPicker";
import SimuladoDifficultyMix from "@/components/professor/SimuladoDifficultyMix";
import SimuladoManualForm from "@/components/professor/SimuladoManualForm";
import SimuladoQuestionsPreview from "@/components/professor/SimuladoQuestionsPreview";
import SimuladoSchedulingSettings from "@/components/professor/SimuladoSchedulingSettings";
import SimuladoAssignmentManager from "@/components/professor/SimuladoAssignmentManager";

const NewProfessorSimuladoPage = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("geral");
  const [loadingInitial, setLoadingInitial] = useState(!!id);
  const [editingSimulado, setEditingSimulado] = useState<any>(null);

  const callAPI = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke("professor-simulado", {
      body: payload,
    });
    if (error) throw error;
    return data;
  };

  useEffect(() => {
    if (id) {
      const fetchSimulado = async () => {
        try {
          const { data, error } = await supabase
            .from('teacher_simulados')
            .select('*')
            .eq('id', id)
            .single();
          
          if (error) throw error;
          setEditingSimulado(data);
        } catch (error) {
          console.error("Error fetching simulado:", error);
          toast({
            title: "Erro ao carregar simulado",
            description: "Não foi possível encontrar o simulado para edição.",
            variant: "destructive"
          });
          navigate("/dashboard/professor");
        } finally {
          setLoadingInitial(false);
        }
      };
      fetchSimulado();
    }
  }, [id, navigate, toast]);

  const form = useCreateSimuladoForm({
    open: true,
    onOpenChange: () => {},
    onCreated: () => {
      toast({ title: "Simulado salvo com sucesso!" });
      navigate("/dashboard/professor");
    },
    callAPI,
    initialData: editingSimulado
  });

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasQuestions = form.allQs.length > 0;

  return (
    <div className="min-h-screen relative z-10 animate-fade-in pb-24">
      <EnaflixBackgroundFX intensity="medium" />
      
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard/professor")}
            className="text-white/60 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> VOLTAR
          </Button>
        </div>

        <CinematicHero
          module="professor"
          eyebrow={<><GraduationCap className="h-3.5 w-3.5" /> {id ? "Edição" : "Criação"}</>}
          title={id ? "Editar Simulado" : "Criar Simulado"}
          subtitle="Configure o simulado, adicione questões e publique para os alunos selecionados."
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="rounded-2xl border border-white/5 bg-card/20 backdrop-blur-md p-2 mb-6">
            <TabsList className="grid grid-cols-4 bg-transparent p-0">
              <TabsTrigger value="geral" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="h-3.5 w-3.5" /> GERAL
              </TabsTrigger>
              <TabsTrigger value="questoes" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BrainCircuit className="h-3.5 w-3.5" /> QUESTÕES
              </TabsTrigger>
              <TabsTrigger value="alunos" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="h-3.5 w-3.5" /> ALUNOS
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings2 className="h-3.5 w-3.5" /> AJUSTES
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="space-y-6">
            <TabsContent value="geral" className="space-y-8 animate-in fade-in slide-in-from-left-2 mt-0">
              <SimuladoBasicForm
                title={form.title}
                description={form.description}
                onTitleChange={form.setTitle}
                onDescriptionChange={form.setDescription}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SimuladoTopicsPicker
                  selectedTopics={form.selectedTopics}
                  newTopicInput={form.newTopicInput}
                  subtopics={form.subtopics}
                  questionMode={form.questionMode}
                  questionCount={form.questionCount}
                  useDistribution={form.useDistribution}
                  topicDistribution={form.topicDistribution}
                  onNewTopicInputChange={form.setNewTopicInput}
                  onAddTopic={form.addTopic}
                  onRemoveTopic={form.removeTopic}
                  onSubtopicChange={form.setSubtopicFor}
                  onToggleDistribution={form.toggleDistribution}
                  onUpdateTopicDistribution={form.updateTopicDistribution}
                />
                <SimuladoDifficultyMix
                  questionCount={form.questionCount}
                  timeLimit={form.timeLimit}
                  difficulty={form.difficulty}
                  difficultyMix={form.difficultyMix}
                  examBoard={form.examBoard}
                  selectedTopics={form.selectedTopics}
                  onQuestionCountChange={form.setQuestionCount}
                  onTimeLimitChange={form.setTimeLimit}
                  onDifficultyChange={form.setDifficulty}
                  onUpdateDifficultyMix={form.updateDifficultyMix}
                  onExamBoardChange={form.handleExamBoardChange}
                />
              </div>
            </TabsContent>

            <TabsContent value="questoes" className="space-y-6 animate-in fade-in slide-in-from-left-2 mt-0">
              <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl w-fit">
                <Button
                  variant={form.questionMode === "ai" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => form.setQuestionMode("ai")}
                  className="text-[10px] font-black uppercase tracking-widest h-8 px-4 rounded-lg"
                >
                  GERADOR IA
                </Button>
                <Button
                  variant={form.questionMode === "manual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => form.setQuestionMode("manual")}
                  className="text-[10px] font-black uppercase tracking-widest h-8 px-4 rounded-lg"
                >
                  MANUAL
                </Button>
              </div>

              {form.questionMode === "ai" && (
                <div className="p-8 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center text-center space-y-4">
                  <BrainCircuit className="h-12 w-12 text-primary" />
                  <div className="space-y-1">
                    <h4 className="text-base font-black uppercase tracking-tight">Gerar Questões com IA</h4>
                    <p className="text-sm text-white/50 max-w-md">
                      A IA criará {form.questionCount} questões baseadas nos temas e dificuldade selecionados.
                    </p>
                  </div>
                  <Button
                    onClick={() => form.generateQuestionsAI()}
                    disabled={form.generating || form.selectedTopics.length === 0}
                    className="h-12 px-10 gap-2 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-[11px] shadow-glow"
                  >
                    {form.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {form.generating ? "GERANDO..." : "COMEÇAR GERAÇÃO"}
                  </Button>
                </div>
              )}

              {form.questionMode === "manual" && (
                <SimuladoManualForm
                  manualStatement={form.manualStatement}
                  manualOptions={form.manualOptions}
                  manualCorrect={form.manualCorrect}
                  manualTopic={form.manualTopic}
                  onStatementChange={form.setManualStatement}
                  onOptionChange={form.updateManualOption}
                  onCorrectChange={form.setManualCorrect}
                  onTopicChange={form.setManualTopic}
                  onAddManualQuestion={form.addManualQuestion}
                />
              )}

              <SimuladoQuestionsPreview
                allQs={form.allQs}
                groupedBlocks={form.groupedBlocks}
                target={form.target}
                deficit={form.deficit}
                questionMode={form.questionMode}
                expandedQuestion={form.expandedQuestion}
                generating={form.generating}
                onSetExpanded={form.setExpandedQuestion}
                onRegenerateMissing={form.regenerateMissing}
                onRemoveGenerated={form.removeGeneratedQuestion}
                onRemoveManual={form.removeManualQuestion}
              />
            </TabsContent>

            <TabsContent value="alunos" className="space-y-6 animate-in fade-in slide-in-from-left-2 mt-0">
              <SimuladoAssignmentManager
                assignmentMode={form.assignmentMode}
                onAssignmentModeChange={form.setAssignmentMode}
                faculdadeFilters={form.faculdadeFilters}
                periodoFilters={form.periodoFilters}
                onFaculdadeChange={(v) => form.setFaculdadeFilters(v)}
                onPeriodoChange={(v) => form.setPeriodoFilters(v)}
                previewStudents={form.previewStudents}
                previewLoading={form.previewLoading}
                selectedStudentIds={form.selectedStudentIds}
                selectedClassIds={form.selectedClassIds}
                onSelectedClassIdsChange={form.setSelectedClassIds}
                selectedProfessorTurmaIds={form.selectedProfessorTurmaIds}
                onSelectedProfessorTurmaIdsChange={form.setSelectedProfessorTurmaIds}
                studentSearch={form.studentSearch}
                searchResults={form.searchResults}
                searchingStudents={form.searchingStudents}
                onStudentSearchChange={form.setStudentSearch}
                onPreviewMatchingStudents={form.previewMatchingStudents}
                onSearchStudentGlobal={form.searchStudentGlobal}
                onAddSearchedStudent={form.addSearchedStudent}
                onToggleStudent={form.toggleStudentSelection}
                onToggleAllStudents={form.toggleAllStudents}
                onClearStudentSelection={form.clearStudentSelection}
                onRemoveSelectedStudent={form.removeSelectedStudent}
                studentPagination={form.studentPagination}
                selectedStudentsData={form.selectedStudentsData}
              />
            </TabsContent>

            <TabsContent value="config" className="space-y-6 animate-in fade-in slide-in-from-left-2 mt-0">
              <SimuladoSchedulingSettings
                scheduledAt={form.scheduledAt}
                onScheduledAtChange={form.setScheduledAt}
                endAt={form.endAt}
                onEndAtChange={form.setEndAt}
                timeLimit={form.timeLimit}
                onTimeLimitChange={form.setTimeLimit}
                maxAttempts={form.maxAttempts}
                onMaxAttemptsChange={form.setMaxAttempts}
                feedbackPolicy={form.feedbackPolicy}
                onFeedbackPolicyChange={form.setFeedbackPolicy}
                allowRetake={form.allowRetake}
                onAllowRetakeChange={form.setAllowRetake}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Floating Footer Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/5 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                {form.allQs.length} questões • {form.selectedStudentIds.length + form.selectedClassIds.length + form.selectedProfessorTurmaIds.length} públicos
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/professor")}
                className="flex-1 sm:flex-none border-white/10 hover:bg-white/5 text-white/60 font-bold uppercase tracking-widest text-[10px]"
              >
                CANCELAR
              </Button>
              <Button
                variant="outline"
                onClick={() => form.confirmCreate("draft")}
                disabled={form.creating || form.generating}
                className="flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary/10 font-black uppercase tracking-widest text-[10px] gap-2"
              >
                {form.creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                SALVAR RASCUNHO
              </Button>
              <Button
                onClick={() => {
                  if (form.allQs.length === 0) {
                    toast({ title: "Adicione questões", description: "O simulado precisa de pelo menos uma questão para ser publicado.", variant: "destructive" });
                    return;
                  }
                  if (form.selectedStudentIds.length === 0 && form.selectedClassIds.length === 0 && form.selectedProfessorTurmaIds.length === 0 && form.assignmentMode !== 'all') {
                    toast({ title: "Selecione o público", description: "Selecione pelo menos um aluno ou turma.", variant: "destructive" });
                    return;
                  }
                  form.confirmCreate();
                }}
                disabled={form.creating || form.generating || !hasQuestions}
                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] gap-2 px-8 shadow-glow-sm"
              >
                {form.creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                {form.scheduledAt ? "AGENDAR" : "PUBLICAR"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewProfessorSimuladoPage;
