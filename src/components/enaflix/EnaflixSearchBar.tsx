import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function EnaflixSearchBar({ value, onChange, placeholder, autoFocus, onEnter }: Props & { onEnter?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div
      className={cn(
        "relative flex items-center w-full max-w-xl rounded-full",
        "bg-white/5 backdrop-blur-md border border-white/10",
        "transition-all focus-within:border-primary/60 focus-within:bg-white/10",
      )}
    >
      <Search className="ml-4 h-4 w-4 text-white/60 shrink-0" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            onEnter();
          }
        }}
        placeholder={placeholder ?? "Buscar módulos..."}
        aria-label="Buscar módulos"
        className="flex-1 bg-transparent border-0 outline-none text-sm text-white placeholder:text-white/50 px-3 py-2.5"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="mr-2 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
