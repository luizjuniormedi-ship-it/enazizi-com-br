import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MindMapViewer } from "@/components/mind-maps/MindMapViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Loader2, FlipVertical, FileText, CheckCircle2, BookOpen,
  Network, Brain, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const COLOR_LEGEND = [
  { color: "#3b82f6", label: "Definição" },
  { color: "#06b6d4", label: "Epidemiologia" },
  { color: "#8b5cf6", label: "Fisiopatologia" },
  { color: "#eab308", label: "Diagnóstico" },
  { color: "#22c55e", label: "Tratamento" },
  { color: "#ef4444", label: "Complicações" },
  { color: "#6b7280", label: "Prognóstico" },
  { color: "#f97316", label: "Diferenciais" },
  { color: "#ec4899", label: "Pontos de Prova" },
];

const DIFFICULTY_LABELS: Record<string, { label: string; class: string }> = {
  easy: { label: "Básico", class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  medium: { label: "Intermediário", class: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  hard: { label: "Avançado", class: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function MindMapFullscreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: map, isLoading } = useQuery({
    queryKey: ["mental-map", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mental_maps" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!session && !!id,
  });

  const { data: derivedStats } = useQuery({
    queryKey: ["map-derived-stats", id],
    queryFn: async () => {
      const fcRes = await (supabase.from("flashcards").select("id", { count: "exact", head: true }) as any).eq("source_map_id", id);
      const qRes = await (supabase.from("questions_bank").select("id", { count: "exact", head: true }) as any).eq("source_map_id", id);
      return { flashcards: fcRes.count || 0, questions: qRes.count || 0 };
    },
    enabled: !!session && !!id,
  });

  const generateFlashcards = useMutation({
    mutationFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-map-flashcards`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ map_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["map-derived-stats", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateQuestions = useMutation({
    mutationFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-map-questions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${s?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ map_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["map-derived-stats", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Brain className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando mapa mental...</p>
        </div>
      </div>
    );
  }

  if (!map) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Network className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Mapa não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/mapas-mentais")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const diffInfo = DIFFICULTY_LABELS[map.difficulty] || DIFFICULTY_LABELS.medium;
  const hasFlashcards = (derivedStats?.flashcards || 0) > 0;
  const hasQuestions = (derivedStats?.questions || 0) > 0;
  const nodeCount = map.content_json?.nodes?.length || 0;
  const childCount = map.content_json?.nodes?.reduce((acc: number, n: any) => acc + (n.children?.length || 0), 0) || 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen flex flex-col bg-background">
        {/* Premium header */}
        <header className="flex items-center gap-3 px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm flex-shrink-0 z-10">
          {/* Left: back + title */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/mapas-mentais")}
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold truncate">{map.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {map.specialty && (
                <span className="text-[10px] text-muted-foreground">{map.specialty}</span>
              )}
              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${diffInfo.class}`}>
                {diffInfo.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Network className="h-2.5 w-2.5" />
                {nodeCount + childCount} nós
              </span>
            </div>
          </div>

          {/* Stats badges */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            {hasFlashcards && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 bg-emerald-500/10 rounded-full px-2.5 py-1">
                <FlipVertical className="h-3 w-3" />
                {derivedStats?.flashcards} flashcards
              </div>
            )}
            {hasQuestions && (
              <div className="flex items-center gap-1.5 text-[10px] text-blue-500 bg-blue-500/10 rounded-full px-2.5 py-1">
                <FileText className="h-3 w-3" />
                {derivedStats?.questions} questões
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={hasFlashcards ? "outline" : "default"}
                  className="gap-1.5 text-xs h-8"
                  disabled={generateFlashcards.isPending || hasFlashcards}
                  onClick={() => generateFlashcards.mutate()}
                >
                  {generateFlashcards.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : hasFlashcards ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <FlipVertical className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {hasFlashcards ? "Flashcards ✓" : "Flashcards"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasFlashcards
                  ? `${derivedStats?.flashcards} flashcards gerados`
                  : "Gerar flashcards a partir deste mapa"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={hasQuestions ? "outline" : "default"}
                  className="gap-1.5 text-xs h-8"
                  disabled={generateQuestions.isPending || hasQuestions}
                  onClick={() => generateQuestions.mutate()}
                >
                  {generateQuestions.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : hasQuestions ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {hasQuestions ? "Questões ✓" : "Questões"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasQuestions
                  ? `${derivedStats?.questions} questões geradas`
                  : "Gerar questões clínicas deste mapa"}
              </TooltipContent>
            </Tooltip>

            {hasFlashcards && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => navigate("/dashboard/flashcards")}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Revisar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Revisar flashcards gerados</TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>

        {/* Color legend */}
        <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-muted/10 overflow-x-auto flex-shrink-0">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
            Legenda
          </span>
          {COLOR_LEGEND.map((c) => (
            <div key={c.label} className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-1 ring-black/5"
                style={{ background: c.color }}
              />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Map canvas */}
        <div className="flex-1 min-h-0">
          <MindMapViewer mapData={map.content_json} />
        </div>
      </div>
    </TooltipProvider>
  );
}
