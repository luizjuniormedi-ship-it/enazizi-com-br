import { Maximize2, Minimize2, MoreVertical, Plus, History, HelpCircle, LogOut, Target, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";

interface TutorHeaderProps {
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  studyStarted: boolean;
  taxaAcerto: number;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  onFinishSession: () => void;
  onNewSession: () => void;
  onShowOnboarding: () => void;
}

const TutorHeader = ({
  isFullscreen, setIsFullscreen, studyStarted, taxaAcerto,
  showHistory, setShowHistory, onFinishSession, onNewSession, onShowOnboarding,
}: TutorHeaderProps) => {
  const navigate = useNavigate();
  return (
  <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
    <div className="min-w-0 flex-1 flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/dashboard")}
        className="h-9 w-9 flex-shrink-0"
        title="Voltar ao Dashboard"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="h-14 w-11 sm:h-[4.5rem] sm:w-14 rounded-2xl overflow-hidden flex-shrink-0 tutor-glow float-gentle ring-2 ring-primary/30 shadow-lg bg-primary/10 p-1">
        <img src="/src/assets/enazizi-mascot.png" alt="Tutor" className="h-full w-full object-contain" />
      </div>
      <div className="min-w-0">
        <h1 className="text-base sm:text-xl font-bold truncate">Tutor</h1>
        <p className="text-[10px] sm:text-xs text-muted-foreground">Protocolo ENAZIZI • GPT-4o</p>
      </div>
    </div>
    <div className="flex gap-1.5 flex-shrink-0 items-center">
      {studyStarted && (
        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold border border-primary/20">
          <Target className="h-3 w-3" /> {taxaAcerto}%
        </span>
      )}
      <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="h-8 gap-1 hidden sm:flex" title="Sair do Tutor">
        <LogOut className="h-3.5 w-3.5" /> Sair
      </Button>
      <Button variant="outline" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8" title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {studyStarted && (
            <DropdownMenuItem onClick={onFinishSession} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Finalizar sessão
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onNewSession}>
            <Plus className="h-4 w-4 mr-2" /> Nova sessão
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}>
            <History className="h-4 w-4 mr-2" /> Histórico
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShowOnboarding}>
            <HelpCircle className="h-4 w-4 mr-2" /> Como usar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
  );
};

export default TutorHeader;
