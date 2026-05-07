import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Plus, Loader2, Sparkles, PenLine, Send, ArrowLeft, CheckCircle2, Users, FileText, Calendar, ShieldCheck, Target, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useCreateSimuladoForm } from "./useCreateSimuladoForm";
import SimuladoBasicForm from "./SimuladoBasicForm";
import SimuladoAssignmentManager from "./SimuladoAssignmentManager";
import SimuladoTopicsPicker from "./SimuladoTopicsPicker";
import SimuladoDifficultyMix from "./SimuladoDifficultyMix";
import SimuladoManualForm from "./SimuladoManualForm";
import SimuladoQuestionsPreview from "./SimuladoQuestionsPreview";
import SimuladoSchedulingSettings from "./SimuladoSchedulingSettings";
import { useIsMobile } from "@/hooks/use-mobile";

type CallAPI = (body: Record<string, unknown>) => Promise<any>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callAPI: CallAPI;
  onCreated: () => void;
}

/**
 * Orquestrador do diálogo de criação de simulado com posição no topo e arraste.
 */
const CreateSimuladoDialog = memo(function CreateSimuladoDialog({
  open, onOpenChange, callAPI, onCreated,
}: Props) {
  const f = useCreateSimuladoForm({ open, callAPI, onCreated, onOpenChange });
  
  // LOG PARA DEBUG
  useEffect(() => {
    if (open) {
      console.log("[CreateSimuladoDialog] Dialog montado e aberto");
    }
  }, [open]);

  // Se o diálogo não estiver aberto, não renderizamos nada além do próprio wrapper do Dialog
  // Isso garante que o estado interno do formulário não cause efeitos colaterais enquanto fechado
  if (!open) return null;

  const isMobile = useIsMobile();
  
  const dialogRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  
  // Reset position when opening
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    
    // Only drag from the header area, not buttons or interactive elements
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [isMobile, position.x, position.y]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Basic bounds to keep it somewhat in view
      const boundedX = Math.min(Math.max(newX, -window.innerWidth / 2 + 100), window.innerWidth / 2 - 100);
      const boundedY = Math.min(Math.max(newY, -20), window.innerHeight - 100);
      
      setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={dialogRef}
        data-testid="create-simulado-dialog"
        className={`
          fixed left-1/2 -translate-x-1/2 p-0 overflow-hidden rounded-2xl border-white/10 shadow-2xl transition-none z-[110] bg-[#0a0a0e]
          ${isMobile ? "top-2 w-[calc(100vw-1rem)] max-h-[96vh]" : "top-6 w-[calc(100vw-2rem)] max-w-4xl max-h-[92vh]"}
        `}
        style={!isMobile ? {
          transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
        } : undefined}
      >
        <div className="flex flex-col h-full max-h-inherit" data-testid="dialog-container">
          <header 
            onMouseDown={handleMouseDown}
            data-testid="dialog-header"
            className={`
              shrink-0 border-b px-6 py-4 bg-background/95 backdrop-blur-md select-none
              ${!isMobile ? "cursor-move" : ""}
            `}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> {f.showConfirm ? "Confirmar Publicação" : "Criar Simulado"}
              </DialogTitle>
              <DialogDescription>
                {f.showConfirm ? "Revise os detalhes abaixo antes de disponibilizar o simulado aos alunos." : "Configure o simulado, gere questões e atribua aos alunos."}
              </DialogDescription>
            </DialogHeader>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6" data-testid="dialog-body">
            <SimuladoBasicForm
              title={f.title}
              description={f.description}
              onTitleChange={f.setTitle}
              onDescriptionChange={f.setDescription}
            />

            <SimuladoAssignmentManager
              assignmentMode={f.assignmentMode}
              onAssignmentModeChange={f.setAssignmentMode}
              faculdadeFilter={f.faculdadeFilter}
              periodoFilter={f.periodoFilter}
              onFaculdadeChange={f.setFaculdadeFilter}
              onPeriodoChange={f.setPeriodoFilter}
              previewStudents={f.previewStudents}
              previewLoading={f.previewLoading}
              selectedStudentIds={f.selectedStudentIds}
              selectedClassIds={f.selectedClassIds}
              onSelectedClassIdsChange={f.setSelectedClassIds}
              studentSearch={f.studentSearch}
              searchResults={f.searchResults}
              searchingStudents={f.searchingStudents}
              onStudentSearchChange={f.setStudentSearch}
              onPreviewMatchingStudents={f.previewMatchingStudents}
              onSearchStudentGlobal={f.searchStudentGlobal}
              onAddSearchedStudent={f.addSearchedStudent}
              onToggleStudent={f.toggleStudentSelection}
              onToggleAllStudents={f.toggleAllStudents}
            />

            <SimuladoTopicsPicker
              selectedTopics={f.selectedTopics}
              newTopicInput={f.newTopicInput}
              subtopics={f.subtopics}
              questionMode={f.questionMode}
              questionCount={f.questionCount}
              useDistribution={f.useDistribution}
              topicDistribution={f.topicDistribution}
              onNewTopicInputChange={f.setNewTopicInput}
              onAddTopic={f.addTopic}
              onRemoveTopic={f.removeTopic}
              onSubtopicChange={f.setSubtopicFor}
              onToggleDistribution={f.toggleDistribution}
              onUpdateTopicDistribution={f.updateTopicDistribution}
            />

            <div className="space-y-3">
              <Label className="text-base font-semibold">Questões</Label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={f.questionMode === "ai" ? "default" : "outline"}
                  size="sm"
                  onClick={() => f.setQuestionMode("ai")}
                  className="gap-1.5 flex-1"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
                </Button>
                <Button
                  type="button"
                  variant={f.questionMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => f.setQuestionMode("manual")}
                  className="gap-1.5 flex-1"
                >
                  <PenLine className="h-3.5 w-3.5" /> Criar Manual
                </Button>
              </div>

              {f.questionMode === "ai" && (
                <SimuladoDifficultyMix
                  questionCount={f.questionCount}
                  timeLimit={f.timeLimit}
                  difficulty={f.difficulty}
                  difficultyMix={f.difficultyMix}
                  examBoard={f.examBoard}
                  selectedTopics={f.selectedTopics}
                  onQuestionCountChange={f.setQuestionCount}
                  onTimeLimitChange={f.setTimeLimit}
                  onDifficultyChange={f.setDifficulty}
                  onUpdateDifficultyMix={f.updateDifficultyMix}
                  onExamBoardChange={f.handleExamBoardChange}
                />
              )}

              {f.questionMode === "manual" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tempo Limite</Label>
                    <div className="flex items-center gap-2 bg-background/50 border rounded-xl px-3 h-10 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                      <Send className="h-3.5 w-3.5 text-muted-foreground" />
                      <input 
                        type="number"
                        value={f.timeLimit}
                        onChange={(e) => f.setTimeLimit(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
                      />
                      <span className="text-[10px] font-bold text-muted-foreground">MIN</span>
                    </div>
                  </div>
                </div>
              )}

              {f.questionMode === "ai" && (
                <Button
                  type="button"
                  onClick={f.generateQuestionsAI}
                  disabled={f.generating || f.selectedTopics.length === 0}
                  className="gap-2 w-full"
                >
                  {f.generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {f.generating ? "Gerando..." : "Gerar Questões com IA"}
                </Button>
              )}

              {f.questionMode === "manual" && (
                <SimuladoManualForm
                  manualStatement={f.manualStatement}
                  manualOptions={f.manualOptions}
                  manualCorrect={f.manualCorrect}
                  manualTopic={f.manualTopic}
                  onStatementChange={f.setManualStatement}
                  onOptionChange={f.updateManualOption}
                  onCorrectChange={f.setManualCorrect}
                  onTopicChange={f.setManualTopic}
                  onAddManualQuestion={f.addManualQuestion}
                />
              )}
            </div>

            <SimuladoQuestionsPreview
              allQs={f.allQs}
              groupedBlocks={f.groupedBlocks}
              target={f.target}
              deficit={f.deficit}
              questionMode={f.questionMode}
              expandedQuestion={f.expandedQuestion}
              generating={f.generating}
              onSetExpanded={f.setExpandedQuestion}
              onRegenerateMissing={f.regenerateMissing}
              onRemoveGenerated={f.removeGeneratedQuestion}
              onRemoveManual={f.removeManualQuestion}
            />

            <SimuladoSchedulingSettings
              scheduledAt={f.scheduledAt}
              onScheduledAtChange={f.setScheduledAt}
              endAt={f.endAt}
              onEndAtChange={f.setEndAt}
              timeLimit={f.timeLimit}
              onTimeLimitChange={f.setTimeLimit}
              maxAttempts={f.maxAttempts}
              onMaxAttemptsChange={f.setMaxAttempts}
              feedbackPolicy={f.feedbackPolicy}
              onFeedbackPolicyChange={f.setFeedbackPolicy}
              allowRetake={f.allowRetake}
              onAllowRetakeChange={f.setAllowRetake}
            />
          </div>

          <footer className="shrink-0 border-t p-6 bg-background/95 backdrop-blur-md" data-testid="dialog-footer">
            <DialogFooter className="sm:justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-11 px-6 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[10px]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={f.createSimulado}
                disabled={
                  f.creating ||
                  f.generating ||
                  (f.questionMode === "ai"
                    ? f.generatedQuestions.length === 0 ||
                      f.generatedQuestions.length < parseInt(f.questionCount)
                    : f.manualQuestions.length === 0)
                }
                className="h-11 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-glow-sm gap-2"
              >
                {f.creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {f.creating ? "CRIANDO..." : f.scheduledAt ? "AGENDAR E ATRIBUIR" : "CRIAR E ATRIBUIR"}
              </Button>
            </DialogFooter>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default CreateSimuladoDialog;
