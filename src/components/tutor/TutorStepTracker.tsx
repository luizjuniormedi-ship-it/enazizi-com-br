import { RefreshCw, ArrowRight, ArrowLeft, Zap, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TutorStepTrackerProps {
  currentTopic: string;
  enaziziStep: number;
  sessionQuestions: number;
  sessionCorrect: number;
  isLoading: boolean;
  changingTopic: boolean;
  setChangingTopic: (v: boolean) => void;
  newTopic: string;
  setNewTopic: (v: string) => void;
  onChangeTopic: () => void;
  onPhaseAction: (key: string) => void;
  onGoBackStep: () => void;
  nextPhase: { key: string; label: string; icon: string; desc: string } | null;
}

const TutorStepTracker = ({
  currentTopic, enaziziStep, sessionQuestions, sessionCorrect,
  isLoading, changingTopic, setChangingTopic, newTopic, setNewTopic,
  onChangeTopic, onPhaseAction, onGoBackStep, nextPhase,
}: TutorStepTrackerProps) => {
  const navigate = useNavigate();
  const progressPercent = Math.round((enaziziStep / 16) * 100);

  return (
    <div className="mb-2 sm:mb-3">
      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
        <span className="px-2 sm:px-3 py-1 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] sm:text-xs font-medium truncate max-w-[40%] border border-primary/20">
          📚 {currentTopic}
        </span>
        <span className="px-2 py-1 rounded-full bg-secondary text-muted-foreground text-[10px] sm:text-xs font-medium">
          Etapa {enaziziStep}/16
        </span>
        {sessionQuestions > 0 && (
          <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${Math.round((sessionCorrect / sessionQuestions) * 100) >= 70 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            {sessionQuestions}Q • {Math.round((sessionCorrect / sessionQuestions) * 100)}%
          </span>
        )}
        <Button variant="ghost" size="sm" className="gap-1 text-[10px] sm:text-xs h-7 ml-auto px-2" onClick={() => setChangingTopic(!changingTopic)} disabled={isLoading}>
          <RefreshCw className="h-3 w-3" /> Tema
        </Button>
      </div>
      {changingTopic && (
        <div className="flex gap-2 mb-2">
          <Input placeholder="Novo tema médico..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onChangeTopic()} className="bg-secondary border-border text-sm h-8" autoFocus />
          <Button size="sm" className="h-8 text-xs flex-shrink-0" onClick={onChangeTopic} disabled={!newTopic.trim()}>Iniciar</Button>
        </div>
      )}
      <div className="mb-2">
        <div className="h-1 w-full rounded-full bg-muted mb-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-xs">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-semibold text-primary cursor-default">
                  {nextPhase ? `${nextPhase.icon} ${nextPhase.label}` : `✅ Completo`}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {nextPhase ? (
                  <>
                    <p className="font-semibold">{nextPhase.icon} Etapa {enaziziStep}/16</p>
                    <p className="text-muted-foreground">{nextPhase.desc}</p>
                  </>
                ) : <p>Todas as etapas concluídas!</p>}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{enaziziStep}/16 ({progressPercent}%)</span>
          {enaziziStep > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] sm:text-xs gap-1 text-muted-foreground hover:text-primary"
                onClick={onGoBackStep}
                disabled={isLoading}
              >
                <ArrowLeft className="h-3 w-3" /> Voltar
              </Button>
          )}
          {nextPhase && (
            <>
              <Button
                size="sm"
                className="ml-auto h-6 px-2.5 text-[10px] sm:text-xs gap-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 font-semibold"
                onClick={() => onPhaseAction(nextPhase.key)}
                disabled={isLoading}
              >
                Avançar <ArrowRight className="h-3 w-3" />
              </Button>
              {enaziziStep < 8 && (
                <>
                  <button onClick={() => onPhaseAction("questions")} disabled={isLoading} className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                    <Zap className="h-2.5 w-2.5" /> Questões
                  </button>
                   <button onClick={() => onPhaseAction("consolidation")} disabled={isLoading} className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                     <RefreshCw className="h-2.5 w-2.5" /> Consolidar
                   </button>
                   <button
                     onClick={() => navigate(`/dashboard/mapas-mentais?generate=${encodeURIComponent(currentTopic)}`)}
                     className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                   >
                     <Brain className="h-2.5 w-2.5" /> Mapa Mental
                   </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorStepTracker;
