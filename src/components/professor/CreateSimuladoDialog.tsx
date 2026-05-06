import { memo } from "react";
import { Plus, Loader2, Sparkles, PenLine, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useCreateSimuladoForm } from "./useCreateSimuladoForm";
import SimuladoBasicForm from "./SimuladoBasicForm";
import SimuladoStudentPicker from "./SimuladoStudentPicker";
import SimuladoTopicsPicker from "./SimuladoTopicsPicker";
import SimuladoDifficultyMix from "./SimuladoDifficultyMix";
import SimuladoManualForm from "./SimuladoManualForm";
import SimuladoManualQuantityFields from "./SimuladoManualQuantityFields";
import SimuladoQuestionsPreview from "./SimuladoQuestionsPreview";
import SimuladoSchedule from "./SimuladoSchedule";

type CallAPI = (body: Record<string, unknown>) => Promise<any>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callAPI: CallAPI;
  onCreated: () => void;
}

/**
 * Orquestrador puro do diálogo de criação de simulado com estrutura de scroll corrigida.
 */
const CreateSimuladoDialog = memo(function CreateSimuladoDialog({
  open, onOpenChange, callAPI, onCreated,
}: Props) {
  const f = useCreateSimuladoForm({ open, callAPI, onCreated, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col items-stretch !translate-y-[-50%]">
        <header className="shrink-0 border-b px-6 py-4 bg-background/50 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Criar Simulado
            </DialogTitle>
            <DialogDescription>
              Configure o simulado, gere questões e atribua aos alunos.
            </DialogDescription>
          </DialogHeader>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimuladoBasicForm
            title={f.title}
            description={f.description}
            onTitleChange={f.setTitle}
            onDescriptionChange={f.setDescription}
          />

          <SimuladoStudentPicker
            faculdadeFilter={f.faculdadeFilter}
            periodoFilter={f.periodoFilter}
            onFaculdadeChange={f.setFaculdadeFilter}
            onPeriodoChange={f.setPeriodoFilter}
            previewStudents={f.previewStudents}
            previewLoading={f.previewLoading}
            selectedStudentIds={f.selectedStudentIds}
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

          {/* Generation method */}
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
              <SimuladoManualQuantityFields
                questionCount={f.questionCount}
                timeLimit={f.timeLimit}
                onQuestionCountChange={f.setQuestionCount}
                onTimeLimitChange={f.setTimeLimit}
              />
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

          <SimuladoSchedule
            scheduledAt={f.scheduledAt}
            autoAssign={f.autoAssign}
            onScheduledAtChange={f.setScheduledAt}
            onAutoAssignChange={f.setAutoAssign}
          />
        </div>

        <footer className="shrink-0 border-t p-6 bg-background/50 backdrop-blur-md">
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
      </DialogContent>
    </Dialog>
  );
});

export default CreateSimuladoDialog;