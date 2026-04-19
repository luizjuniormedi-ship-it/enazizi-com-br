import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Mic, MicOff } from "lucide-react";

interface AgentInputBarProps {
  input: string;
  onInputChange: (v: string) => void;
  placeholder: string;
  isLoading: boolean;
  sendCooldown: boolean;
  onSend: () => void;
  hasSpeechRecognition: boolean;
  isListening: boolean;
  onToggleListening: () => void;
}

const AgentInputBar = memo(({
  input, onInputChange, placeholder, isLoading, sendCooldown, onSend,
  hasSpeechRecognition, isListening, onToggleListening,
}: AgentInputBarProps) => (
  <div className="flex gap-2">
    <Input
      placeholder={isListening ? "🎤 Ouvindo..." : placeholder}
      className={`bg-background/60 backdrop-blur-sm border-border/60 text-sm h-10 sm:h-11 rounded-xl ${
        isListening ? "ring-2 ring-red-400/50 border-red-400/50" : ""
      }`}
      value={input}
      onChange={(e) => onInputChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSend()}
      disabled={isLoading}
    />
    {hasSpeechRecognition && (
      <Button
        onClick={onToggleListening}
        size="icon"
        variant={isListening ? "destructive" : "outline"}
        className={`flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${isListening ? "animate-pulse" : ""}`}
        title={isListening ? "Parar de ouvir" : "Falar"}
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    )}
    <Button
      onClick={onSend}
      size="icon"
      className="glow flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      disabled={isLoading || sendCooldown || !input.trim()}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
    </Button>
  </div>
));
AgentInputBar.displayName = "AgentInputBar";
export default AgentInputBar;
