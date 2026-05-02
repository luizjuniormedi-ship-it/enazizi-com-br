import { memo } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Paperclip, Maximize2, Minimize2, MoreVertical, Plus, History, Volume2, Upload, Film } from "lucide-react";
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
}

const AgentHeader = memo(({
  title, subtitle, selectedCount, isFullscreen, onToggleFullscreen,
  onNewConversation, onToggleHistory, autoSpeak, onToggleAutoSpeak,
  showUploadButton, isUploading, onUploadClick,
  onTransformSession, hasMessages
}: AgentHeaderProps) => {
  return (
    <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <div className="h-14 w-11 sm:h-[4.5rem] sm:w-14 rounded-2xl overflow-hidden flex-shrink-0 tutor-glow float-gentle ring-2 ring-primary/30 shadow-lg">
          <img src={tutorAvatar} alt={title} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold truncate">{title}</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{subtitle}</p>
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
            variant="outline" 
            size="sm" 
            onClick={onTransformSession}
             className="hidden md:flex h-8 text-[10px] gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 shadow-sm shadow-amber-500/20 px-3"
          >
            <Film className="h-3.5 w-3.5" /> 🎓 Gerar Aula Interativa
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
