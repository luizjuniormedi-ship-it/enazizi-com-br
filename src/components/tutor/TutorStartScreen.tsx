import { GraduationCap, ArrowRight, Target, Zap, History, FileText, ChevronDown, Lightbulb } from "lucide-react";
import { MascotAvatar } from "../mascot/MascotAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { QUICK_TOPICS } from "@/components/tutor/TutorConstants";
import type { StudyPerformance, Upload } from "@/components/tutor/TutorConstants";

interface TutorStartScreenProps {
  displayName: string;
  topic: string;
  setTopic: (v: string) => void;
  onStartStudy: (topic?: string) => void;
  /** Inicia uma sessão socrática no Modo Feynman (10 passos). */
  onStartFeynman?: (topic?: string) => void;
  performance: StudyPerformance;
  availableUploads: Upload[];
  selectedUploadIds: Set<string>;
  showUploads: boolean;
  setShowUploads: (v: boolean) => void;
  toggleUpload: (id: string) => void;
}

const TutorStartScreen = ({
  displayName, topic, setTopic, onStartStudy, onStartFeynman, performance,
  availableUploads, selectedUploadIds, showUploads, setShowUploads, toggleUpload,
}: TutorStartScreenProps) => {
  const recentHistory = performance.historico_estudo.slice(-5).reverse();

  return (
    <>
      {/* Hero + Input */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 p-3 sm:p-8 mb-3 sm:mb-4 text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 gradient-shift">
        <div className="absolute inset-0 pattern-dots opacity-30 pointer-events-none" />
        <div className="relative z-10 space-y-2 sm:space-y-4">
          <div className="mx-auto mb-4">
            <MascotAvatar state="idle" size="xl" />
          </div>
          <div>
            <h2 className="text-base sm:text-2xl font-bold">
              Olá, <span className="gradient-text">{displayName}</span>! 👋
            </h2>
            <p className="text-xs sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
              Escolha um tema para começar.
            </p>
          </div>
          <div className="flex gap-2 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Input
                placeholder="Ex: Sepse, IAM, Pneumonia..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onStartStudy()}
                className="bg-background/60 backdrop-blur-sm border-border/60 text-sm h-10 sm:h-12 rounded-xl pl-4 pr-4"
              />
            </div>
            <Button onClick={() => onStartStudy()} className="glow gap-2 px-4 sm:px-8 flex-shrink-0 text-sm h-10 sm:h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 font-semibold" disabled={!topic.trim()}>
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Estudar</span>
              <ArrowRight className="h-4 w-4 sm:hidden" />
            </Button>
          </div>

          {onStartFeynman && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => onStartFeynman()}
                disabled={!topic.trim()}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium border border-yellow-400/30 bg-gradient-to-r from-yellow-400/10 to-amber-300/10 text-yellow-700 dark:text-yellow-300 hover:from-yellow-400/20 hover:to-amber-300/20 hover:border-yellow-400/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={topic.trim() ? "Iniciar Modo Feynman com este tema" : "Digite um tema acima para usar o Modo Feynman"}
              >
                <Lightbulb className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
                <span>Modo Feynman</span>
                <span className="hidden sm:inline text-muted-foreground/70">— explique para fixar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Weak topics */}
      {performance.temas_fracos.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-warning" />
            <span className="text-warning">Recomendado para você</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {performance.temas_fracos.map((t, i) => (
              <button key={i} onClick={() => onStartStudy(t)} className="card-3d flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-warning/10 to-destructive/5 border border-warning/20 hover:border-warning/40 transition-all group">
                <span className="text-lg group-hover:scale-110 transition-transform">🔴</span>
                <span className="text-[10px] sm:text-xs font-medium text-foreground truncate w-full text-center">{t}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Topics */}
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> Temas Populares
        </h3>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:grid sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:overflow-x-visible sm:pb-0 scrollbar-hide">
          {QUICK_TOPICS.map((qt) => (
            <button key={qt.label} onClick={() => onStartStudy(qt.label)} className={`card-3d flex items-center gap-1.5 p-1.5 sm:p-2.5 sm:flex-col rounded-lg sm:rounded-xl bg-gradient-to-br ${qt.color} border backdrop-blur-sm hover:border-primary/30 transition-all group flex-shrink-0`}>
              <span className="text-sm sm:text-lg group-hover:scale-110 transition-transform drop-shadow-sm">{qt.emoji}</span>
              <span className="text-[9px] sm:text-xs font-medium text-foreground whitespace-nowrap sm:truncate sm:w-full sm:text-center">{qt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent History */}
      {recentHistory.length > 0 && (
        <div className="glass-card p-3 sm:p-4 mb-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
            <History className="h-3.5 w-3.5 text-muted-foreground" /> Continuar Estudando
          </h3>
          <div className="space-y-1.5">
            {recentHistory.map((h, i) => (
              <button key={i} onClick={() => onStartStudy(h.tema)} className="flex items-center justify-between text-xs w-full px-3 py-2 rounded-lg hover:bg-secondary/80 transition-colors group">
                <span className="text-foreground truncate mr-2 group-hover:text-primary transition-colors">{h.tema}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{new Date(h.data).toLocaleDateString("pt-BR")}</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${h.acerto >= 70 ? "bg-success/10 text-success" : h.acerto >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                    {h.acerto}%
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Materials */}
      <button
        onClick={() => availableUploads.length > 0 && setShowUploads(!showUploads)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors mx-auto mb-3 ${
          availableUploads.length > 0
            ? selectedUploadIds.size > 0 ? "bg-primary/10 text-primary hover:bg-primary/15" : "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
        {availableUploads.length === 0 ? <span>Nenhum material disponível</span> : (
          <><span>Meus materiais</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${showUploads ? "rotate-180" : ""}`} /></>
        )}
      </button>
      {showUploads && availableUploads.length > 0 && (
        <div className="glass-card p-3 max-h-40 overflow-y-auto space-y-1 max-w-lg mx-auto text-left mb-3">
          {availableUploads.map((u) => (
            <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer text-xs">
              <Checkbox checked={selectedUploadIds.has(u.id)} onCheckedChange={() => toggleUpload(u.id)} className="h-3.5 w-3.5" />
              <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{u.filename}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
};

export default TutorStartScreen;
