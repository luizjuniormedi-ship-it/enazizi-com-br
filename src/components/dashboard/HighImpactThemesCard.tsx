import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BookOpen, ChevronRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCoreData } from "@/hooks/useCoreData";

interface ImpactfulTheme {
  theme: string;
  specialty: string;
  impact: number;
  incidence: number;
  studied: boolean;
  mastery: number; // Domínio atual (0-100)
  priority: number; // Prioridade calculada
}

export default function HighImpactThemesCard() {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();

  const { data: impactfulThemes, isLoading } = useQuery({
    queryKey: ["high-impact-themes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enamed_theme_weights')
        .select(`
          historical_incidence,
          approval_impact_score,
          global_weight,
          enamed_curriculum_matrix (
            theme,
            specialty
          )
        `)
        .eq('exam_type', 'ENAMED')
        .order('approval_impact_score', { ascending: false })
        .limit(5);

      if (error) throw error;

      const studiedThemesMap = new Map(
        coreData?.temasEstudados.map(t => [t.tema.toLowerCase(), t.progresso || 0]) || []
      );

      return data.map((item: any) => {
        const themeName = item.enamed_curriculum_matrix?.theme || "Desconhecido";
        const mastery = studiedThemesMap.get(themeName.toLowerCase()) || 0;
        
        // Use global_weight if available, otherwise fallback to impact_score
        const priority = item.global_weight || (item.approval_impact_score * 10);

        return {
          theme: themeName,
          specialty: item.enamed_curriculum_matrix?.specialty || "Geral",
          impact: Number(item.approval_impact_score || 0),
          incidence: Number(item.historical_incidence || 0),
          studied: studiedThemesMap.has(themeName.toLowerCase()),
          mastery,
          priority: Number(priority)
        };
      }) as ImpactfulTheme[];
    },
    enabled: !!user && !!coreData
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!impactfulThemes || impactfulThemes.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Aumente sua nota
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Temas com maior peso curricular para o ENAMED que você ainda pode dominar.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {impactfulThemes.map((theme, i) => (
          <div 
            key={i} 
            className={`flex flex-col gap-2 p-3 rounded-lg border bg-card transition-all hover:shadow-sm ${theme.studied ? 'opacity-80' : 'border-primary/30 shadow-sm'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold line-clamp-1">{theme.theme}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase">{theme.specialty}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-[8px] h-3.5 px-1 ${
                      theme.incidence > 8 ? "bg-red-50 text-red-600 border-red-200" : 
                      theme.incidence > 5 ? "bg-orange-50 text-orange-600 border-orange-200" :
                      "bg-blue-50 text-blue-600 border-blue-200"
                    }`}
                  >
                    INCIDÊNCIA: {theme.incidence > 8 ? "ALTA" : theme.incidence > 5 ? "MÉDIA" : "BAIXA"}
                  </Badge>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1 text-primary font-bold">
                    <Zap className="h-3 w-3 fill-primary" />
                    <span className="text-sm">+{theme.impact}%</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground uppercase">Impacto estimado</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-1 pt-2 border-t border-dashed">
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Domínio atual</span>
                  <span className="font-medium">{theme.mastery}%</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${theme.mastery}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-muted-foreground uppercase">Prioridade</span>
                <span className={`text-xs font-black ${theme.priority > 80 ? 'text-red-600' : 'text-primary'}`}>
                  {theme.priority.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
