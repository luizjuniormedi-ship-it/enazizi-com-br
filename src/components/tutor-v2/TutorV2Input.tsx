import { useState, useRef } from "react";
import { Send, Mic, Paperclip } from "lucide-react";
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
      <div className="relative flex items-end gap-2 bg-slate-900 border border-white/10 rounded-2xl p-2 focus-within:border-indigo-500/50 transition-all shadow-xl">
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-500 hover:text-white">
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
          placeholder="Tire suas dúvidas clínicas..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] py-3 resize-none max-h-[200px] text-slate-200 placeholder:text-slate-600"
          rows={1}
          disabled={disabled}
        />

        <div className="flex gap-1 pb-1 pr-1">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-500 hover:text-white">
            <Mic className="h-5 w-5" />
          </Button>
          <Button 
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-[9px] text-center text-slate-600 mt-2 font-bold uppercase tracking-widest">
        Tutor IA V2 · Medicina Baseada em Evidências
      </p>
    </div>
  );
}
