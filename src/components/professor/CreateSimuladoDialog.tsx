import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Plus, Loader2, Sparkles, PenLine, Send, ArrowLeft, CheckCircle2, Users, FileText, Calendar, ShieldCheck, Target, AlertTriangle, ExternalLink, Copy, Check } from "lucide-react";
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

const CreateSimuladoDialog = memo(function CreateSimuladoDialog({
  open, onOpenChange, callAPI, onCreated,
}: Props) {
  const f = useCreateSimuladoForm({ open, callAPI, onCreated, onOpenChange });
  
  if (!open) return null;

  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
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
            {f.successData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping opacity-25" />
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">
                  {f.successData.status === 'draft' ? "Rascunho Salvo!" : "Sucesso Total!"}
                </h3>
                
                <p className="text-muted-foreground max-w-md mb-8">
                  {f.successData.status === 'draft' 
                    ? "Seu simulado foi salvo como rascunho e não está visível para alunos." 
                    : `O simulado foi publicado e atribuído a ${f.successData.students_assigned} aluno(s).`}
                </p>

                {f.successData.warnings && f.successData.warnings.length > 0 && (
                  <div className="w-full max-w-md p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-8 flex items-start gap-3 text-left">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Avisos de processamento</p>
                      <ul className="space-y-1">
                        {f.successData.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-amber-200/80">• {w}</li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-amber-500/60 mt-2 italic">O simulado foi criado, mas as etapas acima falharam ou foram suprimidas.</p>
                    </div>
                  </div>
                )}

                <div className="w-full max-w-md space-y-4">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trace ID de Rastreio</span>
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                        TRACE-{f.traceId.split('-')[0].toUpperCase()}
                      </code>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 h-12 rounded-2xl border-white/10 bg-white/5 gap-2 font-bold text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(f.traceId);
                          // A toast here is fine but we already have visual feedback
                        }}
                      >
                        <Copy className="h-4 w-4" /> Copiar ID
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="flex-1 h-12 rounded-2xl border-white/10 bg-white/5 gap-2 font-bold text-xs"
                        onClick={() => {
                          // Aqui redirecionamos para a aba de auditoria
                          // O componente ProfessorDashboard já deve estar lidando com o estado da aba
                          window.location.hash = "#auditoria";
                          onOpenChange(false);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" /> Ver Auditoria
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="default" 
                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs"
                    onClick={() => onOpenChange(false)}
                  >
                    Fechar e Voltar ao Painel
                  </Button>
                </div>
              </div>
            ) : !f.showConfirm ? (
              <>
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
              </>
            ) : (
              <div className="space-y-8 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground max-w-md">{f.description || "Sem descrição adicional."}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                       <FileText className="h-4 w-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Conteúdo</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Quantidade: <span className="text-white font-bold">{f.allQs.length} questões</span></p>
                      <p className="text-xs text-muted-foreground">Dificuldade: <span className="text-white font-bold capitalize">{f.difficulty === 'misto' ? 'Personalizada' : f.difficulty}</span></p>
                      <p className="text-xs text-muted-foreground">Tempo: <span className="text-white font-bold">{f.timeLimit} minutos</span></p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                       <Users className="h-4 w-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Público Alvo</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Impacto: <span className="text-white font-bold">{f.impactedCount} aluno(s) impactado(s)</span></p>
                      <p className="text-xs text-muted-foreground">Modo: <span className="text-white font-bold uppercase">{f.assignmentMode === 'filter' ? 'Filtros' : f.assignmentMode === 'manual' ? 'Seleção Manual' : f.assignmentMode === 'classes' ? 'Turmas' : 'Todos'}</span></p>
                      {f.assignmentMode === 'filter' && (
                        <p className="text-xs text-muted-foreground">Filtro: <span className="text-white font-bold">{f.faculdadeFilter || 'Todas'} · {f.periodoFilter ? `${f.periodoFilter}º Período` : 'Todos'}</span></p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                       <Calendar className="h-4 w-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Agenda</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Início: <span className="text-white font-bold">{f.scheduledAt ? new Date(f.scheduledAt).toLocaleString() : 'Imediato'}</span></p>
                      <p className="text-xs text-muted-foreground">Deadline: <span className="text-white font-bold">{f.endAt ? new Date(f.endAt).toLocaleString() : 'Sem prazo'}</span></p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                       <ShieldCheck className="h-4 w-4" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Políticas</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Gabarito: <span className="text-white font-bold uppercase">{f.feedbackPolicy === 'immediate' ? 'Imediato' : f.feedbackPolicy === 'after_deadline' ? 'Após Prazo' : 'Manual'}</span></p>
                      <p className="text-xs text-muted-foreground">Tentativas: <span className="text-white font-bold">{f.maxAttempts}</span></p>
                    </div>
                  </div>
                </div>

                {f.assignmentMode === 'all' && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Aviso de impacto global</p>
                      <p className="text-xs text-amber-200/80">Este simulado será enviado para TODOS os alunos da plataforma. Verifique se as configurações estão corretas.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!f.successData && (
            <footer className="shrink-0 border-t p-6 bg-background/95 backdrop-blur-md" data-testid="dialog-footer">
            <div className="flex flex-col gap-3">
              {!f.showConfirm && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => f.confirmCreate("draft")}
                  disabled={f.creating || f.generating || !f.title.trim()}
                  className="w-full h-10 rounded-xl border border-dashed border-white/10 hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] gap-2 text-muted-foreground"
                >
                  <PenLine className="h-3.5 w-3.5" /> Salvar como Rascunho (sem publicar)
                </Button>
              )}
              
              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => f.showConfirm ? f.setShowConfirm(false) : onOpenChange(false)}
                  className="h-11 px-6 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[10px] gap-2"
                >
                  {f.showConfirm ? <ArrowLeft className="h-4 w-4" /> : null}
                  {f.showConfirm ? "VOLTAR E EDITAR" : "Cancelar"}
                </Button>
                
                <Button
                  type="button"
                  onClick={() => f.showConfirm ? f.confirmCreate() : f.initiateCreate()}
                  disabled={
                    f.creating ||
                    f.generating ||
                    (!f.showConfirm && (f.questionMode === "ai"
                      ? f.generatedQuestions.length === 0 ||
                        f.generatedQuestions.length < parseInt(f.questionCount)
                      : f.manualQuestions.length === 0))
                  }
                  className="h-11 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-glow-sm gap-2"
                >
                  {f.creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {f.creating ? "PROCESSANDO..." : f.showConfirm ? "CONFIRMAR E PUBLICAR" : f.scheduledAt ? "AGENDAR E ATRIBUIR" : "REVISAR E ATRIBUIR"}
                </Button>
              </DialogFooter>
            </div>
            </footer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default CreateSimuladoDialog;
