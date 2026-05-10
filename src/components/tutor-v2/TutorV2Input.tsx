import { useState, useRef, useEffect } from "react";
import { Send, Mic, Paperclip, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";


interface TutorV2InputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export default function TutorV2Input({ onSendMessage, disabled }: TutorV2InputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSendMessage(text);
    setText("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  return (
    <div className="max-w-4xl mx-auto w-full relative">
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
        
        <div className="relative flex items-end gap-2 bg-slate-900/80 border border-white/10 rounded-[1.8rem] p-2.5 backdrop-blur-xl focus-within:border-indigo-500/40 transition-all shadow-2xl ring-1 ring-white/5">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-11 w-11 rounded-2xl text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte ao Tutor ou peça uma explicação..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] py-3.5 resize-none max-h-[200px] text-slate-100 placeholder:text-slate-600 font-medium"
            rows={1}
            autoFocus
            disabled={disabled}
          />

          <div className="flex gap-1.5 pb-1 pr-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-11 w-11 rounded-2xl text-slate-500 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex"
            >
              <Mic className="h-5 w-5" />
            </Button>
            <Button 
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95 group/btn"
            >
              <Send className="h-4 w-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
            Medical Intelligence Active
          </p>
        </div>
        <div className="h-1 w-1 rounded-full bg-white/10" />
        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
          Protocolo Feynman V2
        </p>
      </div>
    </div>
  );
}
