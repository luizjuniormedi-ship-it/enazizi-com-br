import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MindMapViewer } from "@/components/mind-maps/MindMapViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, FlipVertical, FileText, Sparkles, CheckCircle2, BookOpen } from "lucide-react";
import { toast } from "sonner";

const COLOR_LEGEND = [
  { color: "bg-blue-500", label: "Definição" },
  { color: "bg-sky-400", label: "Epidemiologia" },
  { color: "bg-purple-500", label: "Fisiopatologia" },
  { color: "bg-yellow-500", label: "Diagnóstico" },
  { color: "bg-green-500", label: "Tratamento" },
  { color: "bg-red-500", label: "Complicações" },
  { color: "bg-gray-400", label: "Prognóstico" },
  { color: "bg-orange-500", label: "Diferenciais" },
  { color: "bg-pink-500", label: "Pontos de Prova" },
];

const DIFFICULTY_LABELS: Record<string, { label: string; class: string }> = {
  easy: { label: "Básico", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  medium: { label: "Intermediário", class: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  hard: { label: "Avançado", class: "bg-red-500/15 text-red-400 border-red-500/30" },
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

  // Derived content counts
  const { data: derivedStats } = useQuery({
    queryKey: ["map-derived-stats", id],
    queryFn: async () => {
      const fcRes = await (supabase.from("flashcards").select("id", { count: "exact", head: true }) as any).eq("source_map_id", id);
      const qRes = await (supabase.from("questions_bank").select("id", { count: "exact", head: true }) as any).eq("source_map_id", id);
      return {
        flashcards: fcRes.count || 0,
        questions: qRes.count || 0,
      };
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!map) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 py-2 border-b bg-background/95 backdrop-blur-sm flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard/mapas-mentais")}
          className="gap-1 text-muted-foreground hover:text-foreground px-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <h1 className="text-sm font-bold truncate flex-1">{map.title}</h1>

        <div className="flex items-center gap-1.5">
          {map.specialty && (
            <Badge variant="outline" className="text-[10px] hidden md:flex">{map.specialty}</Badge>
          )}
          <Badge className={`text-[10px] border ${diffInfo.class}`}>
            {diffInfo.label}
          </Badge>
        </div>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
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
              {hasFlashcards ? `${derivedStats?.flashcards} Flashcards` : "Gerar Flashcards"}
            </span>
            <span className="sm:hidden">
              {hasFlashcards ? derivedStats?.flashcards : <FlipVertical className="h-3.5 w-3.5" />}
            </span>
          </Button>

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
              {hasQuestions ? `${derivedStats?.questions} Questões` : "Gerar Questões"}
            </span>
          </Button>

          {hasFlashcards && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={() => navigate("/dashboard/flashcards")}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Revisar</span>
            </Button>
          )}
        </div>
      </header>

      {/* Legend bar */}
      <div className="flex items-center gap-3 px-3 py-1 border-b bg-muted/20 overflow-x-auto flex-shrink-0">
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Legenda:</span>
        {COLOR_LEGEND.map(c => (
          <div key={c.label} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`h-2 w-2 rounded-full ${c.color} flex-shrink-0`} />
            <span className="text-[10px] text-muted-foreground">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MindMapViewer mapData={map.content_json} />
      </div>
    </div>
  );
}
