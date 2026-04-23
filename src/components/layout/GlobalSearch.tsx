import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, FlipVertical, AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "question" | "flashcard" | "error" | "summary";
  title: string;
  subtitle?: string;
  path: string;
}

const TYPE_META: Record<string, { icon: typeof Search; label: string; color: string }> = {
  question: { icon: FileText, label: "Questão", color: "text-primary" },
  flashcard: { icon: FlipVertical, label: "Flashcard", color: "text-amber-500" },
  error: { icon: AlertTriangle, label: "Erro", color: "text-destructive" },
  summary: { icon: BookOpen, label: "Resumo", color: "text-emerald-500" },
};

interface Props {
  /** Variante visual: 'pill' (default) = tab streaming compacto, 'icon' = só lupa */
  variant?: "pill" | "icon";
}

const GlobalSearch = ({ variant = "pill" }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!user || q.length < 2) { setResults([]); return; }
    setLoading(true);

    const term = `%${q}%`;
    const [questionsRes, flashcardsRes, errorsRes, summariesRes] = await Promise.all([
      supabase.from("questions_bank").select("id, statement, topic").or(`user_id.eq.${user.id},is_global.eq.true`).eq("review_status", "approved").ilike("statement", term).limit(5),
      supabase.from("flashcards").select("id, question, topic").or(`user_id.eq.${user.id},is_global.eq.true`).ilike("question", term).limit(5),
      supabase.from("error_bank").select("id, tema, conteudo").eq("user_id", user.id).or(`tema.ilike.${term},conteudo.ilike.${term}`).limit(5),
      supabase.from("summaries").select("id, topic, content").eq("user_id", user.id).or(`topic.ilike.${term},content.ilike.${term}`).limit(5),
    ]);

    const mapped: SearchResult[] = [
      ...(questionsRes.data || []).map((q) => ({ id: q.id, type: "question" as const, title: q.statement?.slice(0, 100) || "", subtitle: q.topic || undefined, path: "/dashboard/simulados" })),
      ...(flashcardsRes.data || []).map((f) => ({ id: f.id, type: "flashcard" as const, title: f.question?.slice(0, 100) || "", subtitle: f.topic || undefined, path: "/dashboard/flashcards" })),
      ...(errorsRes.data || []).map((e) => ({ id: e.id, type: "error" as const, title: e.conteudo?.slice(0, 100) || e.tema, subtitle: e.tema, path: "/dashboard/banco-erros" })),
      ...(summariesRes.data || []).map((s) => ({ id: s.id, type: "summary" as const, title: s.topic, subtitle: s.content?.slice(0, 80) || undefined, path: "/dashboard/resumos" })),
    ];

    setResults(mapped);
    setLoading(false);
  }, [user]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const selectResult = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(r.path);
  };

  if (!open) {
    if (variant === "icon") {
      return (
        <button
          onClick={() => setOpen(true)}
          aria-label="Buscar conteúdo (⌘K)"
          className={cn(
            "h-9 w-9 inline-flex items-center justify-center rounded-full",
            "text-muted-foreground hover:text-foreground hover:bg-white/5",
            "transition-all duration-200 hover:scale-105",
          )}
        >
          <Search className="h-4 w-4" />
        </button>
      );
    }
    // pill: discreto, mas com kbd shortcut visível em desktop
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar (⌘K)"
        className={cn(
          "group h-9 inline-flex items-center gap-2 px-3 rounded-full text-sm",
          "text-muted-foreground hover:text-foreground",
          "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/10",
          "transition-all duration-200",
        )}
      >
        <Search className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
        <span className="hidden sm:inline text-xs">Buscar</span>
        <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono border border-white/10 text-muted-foreground/80">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Buscar questões, flashcards, erros, resumos..."
            className="flex-1 py-3 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum resultado encontrado</p>
          )}

          {!loading && results.length > 0 && (
            <ul className="py-2">
              {results.map((r) => {
                const meta = TYPE_META[r.type];
                const Icon = meta.icon;
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      onClick={() => selectResult(r)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground line-clamp-1">{r.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
                          {r.subtitle && <span className="text-[10px] text-muted-foreground truncate">{r.subtitle}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && query.length < 2 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <p>Digite pelo menos 2 caracteres</p>
              <p className="text-xs mt-1">Busca em questões, flashcards, erros e resumos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
