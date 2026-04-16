import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MindMapViewer } from "@/components/mind-maps/MindMapViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";

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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Compact top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b bg-background/95 backdrop-blur-sm flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard/mapas-mentais")}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="h-5 w-px bg-border" />

        <h1 className="text-sm font-bold truncate flex-1">{map.title}</h1>

        <div className="flex items-center gap-2">
          {map.specialty && (
            <Badge variant="outline" className="text-[10px] hidden sm:flex">{map.specialty}</Badge>
          )}
          <Badge className={`text-[10px] border ${diffInfo.class}`}>
            {diffInfo.label}
          </Badge>
        </div>
      </header>

      {/* Legend bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-muted/30 overflow-x-auto flex-shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Legenda:</span>
        {COLOR_LEGEND.map(c => (
          <div key={c.label} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`h-2.5 w-2.5 rounded-full ${c.color} flex-shrink-0`} />
            <span className="text-[10px] text-muted-foreground">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Map — fills all remaining space */}
      <div className="flex-1 min-h-0">
        <MindMapViewer mapData={map.content_json} />
      </div>
    </div>
  );
}
