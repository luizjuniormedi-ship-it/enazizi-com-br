import { useState } from "react";
import { 
  Plus, 
  Loader2, 
  Save, 
  FileText, 
  Pencil, 
  Settings2, 
  Users, 
  BrainCircuit, 
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TeacherDialogContent } from "@/components/teacher/TeacherDialogContent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCreateSimuladoForm } from "./useCreateSimuladoForm";
import { useToast } from "@/hooks/use-toast";

// Sub-components
import SimuladoBasicForm from "./SimuladoBasicForm";
import SimuladoTopicsPicker from "./SimuladoTopicsPicker";
import SimuladoDifficultyMix from "./SimuladoDifficultyMix";
import SimuladoManualForm from "./SimuladoManualForm";
import SimuladoQuestionsPreview from "./SimuladoQuestionsPreview";
import SimuladoSchedulingSettings from "./SimuladoSchedulingSettings";
import SimuladoAssignmentManager from "./SimuladoAssignmentManager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editingSimulado?: any;
}

export function CreateSimuladoDialog({ open, onOpenChange, onCreated, editingSimulado }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("geral");

  const callAPI = async (payload: any) => {
    console.log("[CreateSimuladoDialog] calling Edge Function professor-simulado:", payload.action);
    const { data, error } = await supabase.functions.invoke("professor-simulado", {
      body: payload,
    });
    if (error) {
      console.error("[CreateSimuladoDialog] Edge Function error:", error);
      throw error;
    }
    return data;
  };

  const form = useCreateSimuladoForm({
    open,
    onOpenChange,
    onCreated,
    callAPI,
    initialData: editingSimulado
  });

  const isManual = form.questionMode === "manual";
  const hasQuestions = form.allQs.length > 0;

  if (form.successData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <TeacherDialogContent
          maxWidth="sm:max-w-[500px]"
          header={
            <div className="flex flex-col items-center text-center space-y-2 py-4">
              <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                Simulado Criado!
              </DialogTitle>
              <DialogDescription className="text-white/60">
                O simulado foi gerado e atribuído com sucesso.
              </DialogDescription>
            </div>
          }
          footer={
            <Button 
              onClick={() => {
                form.setSuccessData(null);
                onOpenChange(false);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-widest"
            >
              CONCLUÍDO
            </Button>
          }
        >
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Status</p>
                <p className="text-sm font-bold text-emerald-400 uppercase tracking-tight">
                  {form.successData.status === 'draft' ? 'Rascunho' : 'Publicado'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Alunos</p>
                <p className="text-sm font-bold uppercase tracking-tight">
                  {form.successData.students_assigned} Atribuídos
                </p>
              </div>
            </div>

            {form.successData.warnings && form.successData.warnings.length > 0 && (
              <Alert variant="default" className="bg-amber-500/10 border-amber-500/20 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs font-bold uppercase tracking-widest">Avisos</AlertTitle>
                <AlertDescription className="text-[11px] font-medium">
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {form.successData.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <p className="text-xs text-center opacity-80">
                O simulado já está disponível para os alunos selecionados na aba de simulados deles.
              </p>
            </div>
          </div>
        </TeacherDialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TeacherDialogContent
        maxWidth="sm:max-w-[800px]"
        header={
          <div className="flex items-center justify-between w-full">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                {editingSimulado ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingSimulado ? "Editar Simulado" : "Criar Novo Simulado"}
              </DialogTitle>
              <DialogDescription className="text-white/50 text-[11px] font-medium uppercase tracking-widest mt-0.5">
                {activeTab === 'geral' && "Informações básicas e temas"}
                {activeTab === 'questoes' && "Banco de questões e geração IA"}
                {activeTab === 'config' && "Prazos, regras e tentativas"}
                {activeTab === 'alunos' && "Público-alvo e atribuição"}
              </DialogDescription>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.creating || form.generating}
                className="border-white/10 hover:bg-white/5 text-white/60 font-bold uppercase tracking-widest text-[10px]"
              >
                CANCELAR
              </Button>
              {activeTab !== 'geral' && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const order = ["geral", "questoes", "alunos", "config"];
                    const idx = order.indexOf(activeTab);
                    if (idx > 0) setActiveTab(order[idx - 1]);
                  }}
                  className="text-white/40 hover:text-white font-bold uppercase tracking-widest text-[10px]"
                >
                  VOLTAR
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'config' ? (
                <Button
                  onClick={() => {
                    const order = ["geral", "questoes", "alunos", "config"];
                    const idx = order.indexOf(activeTab);
                    if (idx < order.length - 1) setActiveTab(order[idx + 1]);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-[10px] px-6"
                >
                  PRÓXIMO
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => form.confirmCreate("draft")}
                    disabled={form.creating || form.generating}
                    className="border-primary/30 text-primary hover:bg-primary/10 font-black uppercase tracking-widest text-[10px] gap-2"
                  >
                    {form.creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    SALVAR RASCUNHO
                  </Button>
                  <Button
                    onClick={() => form.initiateCreate()}
                    disabled={form.creating || form.generating || !hasQuestions}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] gap-2 px-8 shadow-glow-sm"
                  >
                    {form.creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                    {form.scheduledAt ? "AGENDAR SIMULADO" : "PUBLICAR SIMULADO"}
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        {form.showConfirm ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
              <ClipboardCheck className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tight">Confirmar Publicação</h3>
              <p className="text-white/60 max-w-sm mx-auto">
                Você está prestes a publicar o simulado <strong>"{form.title}"</strong> para <strong>{form.impactedCount} alunos</strong>.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Questões</p>
                <p className="text-lg font-black">{form.allQs.length}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Dificuldade</p>
                <p className="text-lg font-black uppercase tracking-tight">{form.difficulty}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full max-w-md">
              <Button
                variant="outline"
                onClick={() => form.setShowConfirm(false)}
                className="flex-1 h-12 border-white/10 hover:bg-white/5 font-bold uppercase tracking-widest"
              >
                REVISAR
              </Button>
              <Button
                onClick={() => form.confirmCreate()}
                disabled={form.creating}
                className="flex-1 h-12 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest shadow-glow"
              >
                {form.creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "CONFIRMAR E PUBLICAR"}
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 bg-white/5 p-1 rounded-xl mb-6">
              <TabsTrigger value="geral" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <FileText className="h-3.5 w-3.5" /> GERAL
              </TabsTrigger>
              <TabsTrigger value="questoes" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BrainCircuit className="h-3.5 w-3.5" /> QUESTÕES
              </TabsTrigger>
              <TabsTrigger value="alunos" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="h-3.5 w-3.5" /> ALUNOS
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings2 className="h-3.5 w-3.5" /> AJUSTES
              </TabsTrigger>
            </TabsList>

            <div className="space-y-6 min-h-[400px]">
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
                  <div className="space-y-6">
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
                  <div className="space-y-4">
                    <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center text-center space-y-4">
                      <BrainCircuit className="h-10 w-10 text-primary" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-tight">Gerar Questões com IA</h4>
                        <p className="text-xs text-white/50 max-w-md">
                          Nossa IA criará {form.questionCount} questões baseadas nos temas e dificuldade selecionados.
                        </p>
                      </div>
                      <Button
                        onClick={() => form.generateQuestionsAI()}
                        disabled={form.generating || form.selectedTopics.length === 0}
                        className="h-11 px-8 gap-2 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-[11px] shadow-glow"
                      >
                        {form.generating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> GERANDO...
                          </>
                        ) : (
                          <>
                            <BrainCircuit className="h-4 w-4" /> COMEÇAR GERAÇÃO
                          </>
                        )}
                      </Button>
                    </div>
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
                onFaculdadeChange={form.setFaculdadeFilters}
                onPeriodoChange={form.setPeriodoFilters}
                  previewStudents={form.previewStudents}
                  previewLoading={form.previewLoading}
                  selectedStudentIds={form.selectedStudentIds}
                  selectedClassIds={form.selectedClassIds}
                  onSelectedClassIdsChange={form.setSelectedClassIds}
                  studentSearch={form.studentSearch}
                  searchResults={form.searchResults}
                  searchingStudents={form.searchingStudents}
                  onStudentSearchChange={form.setStudentSearch}
                  onPreviewMatchingStudents={form.previewMatchingStudents}
                  onSearchStudentGlobal={form.searchStudentGlobal}
                  onAddSearchedStudent={form.addSearchedStudent}
                  onToggleStudent={form.toggleStudentSelection}
                  onToggleAllStudents={form.toggleAllStudents}
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
        )}
      </TeacherDialogContent>
    </Dialog>
  );
}

export default CreateSimuladoDialog;