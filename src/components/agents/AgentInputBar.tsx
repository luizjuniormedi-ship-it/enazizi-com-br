import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Mic, MicOff, Brain, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

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
  <div className="relative w-full max-w-4xl mx-auto pb-4 sm:pb-6 px-4 sm:px-0 mb-[env(safe-area-inset-bottom,1rem)]">
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="relative group/input shadow-2xl shadow-primary/10 rounded-[32px] overflow-hidden transition-all duration-500 hover:shadow-primary/20"
    >
      <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl border border-white/10 group-focus-within/input:border-primary/40 transition-colors duration-500" />
      
      <div className="relative flex items-center p-2 sm:p-3 pl-6">
        <Brain className="h-5 w-5 text-primary/40 mr-4 hidden sm:block" />
        <input
          data-testid="agent-input"
          placeholder={isListening ? "Ouvindo sua pergunta..." : placeholder}
          className="bg-transparent border-0 outline-none flex-1 text-white placeholder:text-white/20 text-sm sm:text-base py-3 sm:py-4 selection:bg-primary/30"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          disabled={isLoading}
        />
        
        <div className="flex items-center gap-2 pr-1">
          {hasSpeechRecognition && (
            <Button
              onClick={onToggleListening}
              size="icon"
              variant="ghost"
              className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl transition-all ${
                isListening ? "bg-red-500/20 text-red-400 animate-pulse" : "text-white/30 hover:text-white hover:bg-white/5"
              }`}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          
          <Button
            data-testid="agent-send-button"
            onClick={onSend}
            disabled={isLoading || sendCooldown || !input.trim()}
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 fill-current" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
    
    <div className="mt-4 flex justify-center gap-6 opacity-30 select-none pointer-events-none">
       <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white">
          <Sparkles className="h-3 w-3 text-primary" /> Multi-Agent Engine
       </div>
       <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white">
          <Brain className="h-3 w-3 text-primary" /> ENAZIZI Restore v5
       </div>
    </div>
  </div>
));

AgentInputBar.displayName = "AgentInputBar";
export default AgentInputBar;