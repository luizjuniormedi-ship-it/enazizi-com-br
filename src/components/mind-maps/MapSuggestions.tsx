import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapSuggestion {
  topic: string;
  reason: string;
  specialty?: string;
  source: "error_bank" | "weak_area" | "simulado";
}

export function useMapSuggestions() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["map-suggestions"],
    queryFn: async (): Promise<MapSuggestion[]> => {
      if (!session?.user?.id) return [];
      const suggestions: MapSuggestion[] = [];

      // 1. From error_bank — topics with most errors
      const { data: errors } = await supabase
        .from("error_bank")
        .select("tema, subtema, vezes_errado")
        .eq("user_id", session.user.id)
        .eq("dominado", false)
        .order("vezes_errado", { ascending: false })
        .limit(5);

      if (errors) {
        // Check which topics already have maps
        const { data: existingMaps } = await supabase
          .from("mental_maps" as any)
          .select("source_topic")
          .eq("user_id", session.user.id);

        const existingTopics = new Set(
          (existingMaps || []).map((m: any) => m.source_topic?.toLowerCase())
        );

        for (const err of errors) {
          const topic = err.subtema || err.tema;
          if (!existingTopics.has(topic.toLowerCase())) {
            suggestions.push({
              topic,
              reason: `Você errou ${err.vezes_errado}x em "${err.tema}"`,
              source: "error_bank",
            });
          }
        }
      }

      return suggestions.slice(0, 3);
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function MapSuggestionsBar({ onGenerate }: { onGenerate: (topic: string, specialty?: string) => void }) {
  const { data: suggestions = [], isLoading } = useMapSuggestions();

  if (isLoading || suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Mapas sugeridos para você</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 border-primary/30 hover:bg-primary/10"
            onClick={() => onGenerate(s.topic, s.specialty)}
          >
            <Brain className="h-3 w-3" />
            {s.topic}
            <span className="text-muted-foreground text-[10px] ml-1">({s.reason})</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
