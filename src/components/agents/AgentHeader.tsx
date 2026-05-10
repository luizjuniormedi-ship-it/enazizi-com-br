import { memo } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Paperclip, Maximize2, Minimize2, MoreVertical, Plus, History, Volume2, Upload, Film, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";

interface AgentHeaderProps {
  title: string;
  subtitle: string;
  selectedCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onNewConversation: () => void;
  onToggleHistory: () => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  showUploadButton?: boolean;
  isUploading: boolean;
  onUploadClick: () => void;
  onTransformSession?: () => void;
  hasMessages?: boolean;
  lessonStatus?: 'idle' | 'processing' | 'ready' | 'failed';
  onToggleDiagnostic?: () => void;
  isAdmin?: boolean;
}

const AgentHeader = memo(({
  title, subtitle, selectedCount, isFullscreen, onToggleFullscreen,
  onNewConversation, onToggleHistory, autoSpeak, onToggleAutoSpeak,
  showUploadButton, isUploading, onUploadClick,
  onTransformSession, hasMessages, lessonStatus = 'idle',
  onToggleDiagnostic, isAdmin
}: AgentHeaderProps) => {
  return (
    <div className="pt-2 pb-6 px-4 sm:px-12 flex items-center justify-between gap-4 border-b border-white/5 bg-transparent backdrop-blur-3xl">
      <div className="min-w-0 flex-1 flex items-center gap-4">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl overflow-hidden flex-shrink-0 tutor-glow float-gentle ring-1 ring-primary/30 shadow-2xl bg-black">
          <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black tracking-tight truncate text-white">{title}</h1>
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
          <p className="text-[10px] sm:text-xs font-medium text-white/40 tracking-wider uppercase">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0 items-center">
        {selectedCount > 0 && (
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold border border-primary/20">
            <Paperclip className="h-3 w-3" /> {selectedCount} material(is)
          </span>
        )}

        {hasMessages && onTransformSession && (
          <Button 
            variant={lessonStatus === 'ready' ? "default" : "outline"} 
            size="sm" 
            onClick={onTransformSession}
             className={cn(
               "hidden md:flex h-10 text-[10px] gap-2 shadow-xl px-5 font-black uppercase tracking-[0.2em] transition-all rounded-full",
               lessonStatus === 'ready' 
                ? "bg-white text-black hover:bg-white/90 scale-105" 
                : lessonStatus === 'failed'
                ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
             )}
          >
            {lessonStatus === 'ready' ? (
              <><Play className="h-4 w-4 fill-current" /> Assistir Aula</>
            ) : lessonStatus === 'processing' ? (
              <><Clock className="h-4 w-4 animate-spin" /> Em Produção</>
            ) : lessonStatus === 'failed' ? (
              <>Tentar Novamente</>
            ) : (
              <><Film className="h-4 w-4" /> Gerar Aula</>
            )}
          </Button>
        )}

        <Button variant="outline" size="icon" onClick={onToggleFullscreen} className="h-8 w-8" title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasMessages && onTransformSession && (
              <DropdownMenuItem onClick={onTransformSession} className="md:hidden text-amber-500">
                <Film className="h-4 w-4 mr-2" /> 🎓 Gerar Aula Interativa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onNewConversation}>
              <Plus className="h-4 w-4 mr-2" /> Nova conversa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleHistory}>
              <History className="h-4 w-4 mr-2" /> Histórico
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleAutoSpeak}>
              <Volume2 className="h-4 w-4 mr-2" /> {autoSpeak ? "Desativar auto-fala" : "Ativar auto-fala"}
            </DropdownMenuItem>
            {showUploadButton && (
              <DropdownMenuItem onClick={onUploadClick} disabled={isUploading}>
                <Upload className="h-4 w-4 mr-2" /> {isUploading ? "Enviando..." : "Enviar material"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
AgentHeader.displayName = "AgentHeader";
export default AgentHeader;
