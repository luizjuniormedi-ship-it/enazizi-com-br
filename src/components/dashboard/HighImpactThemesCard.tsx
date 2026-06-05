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
          enamed_curriculum_matrix (
            theme,
            specialty
          )
        `)
        .eq('exam_type', 'ENAMED')
        .order('approval_impact_score', { ascending: false })
        .limit(5);

      if (error) throw error;

      const studiedThemes = new Set(coreData?.temasEstudados.map(t => t.tema.toLowerCase()) || []);

      return data.map((item: any) => ({
        theme: item.enamed_curriculum_matrix?.theme || "Desconhecido",
        specialty: item.enamed_curriculum_matrix?.specialty || "Geral",
        impact: Number(item.approval_impact_score || 0),
        incidence: Number(item.historical_incidence || 0),
        studied: studiedThemes.has(item.enamed_curriculum_matrix?.theme?.toLowerCase())
      })) as ImpactfulTheme[];
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
            className={`flex items-center justify-between p-2.5 rounded-lg border bg-card transition-all hover:shadow-sm ${theme.studied ? 'opacity-60' : 'border-primary/30 shadow-sm'}`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium line-clamp-1">{theme.theme}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase">{theme.specialty}</span>
                {theme.incidence > 8 && (
                  <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-red-100 text-red-600 border-red-200">
                    ALTA INCIDÊNCIA
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right flex items-center gap-3">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-primary font-bold">
                  <Zap className="h-3 w-3 fill-primary" />
                  <span className="text-sm">+{theme.impact}%</span>
                </div>
                <span className="text-[9px] text-muted-foreground">impacto estimado</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
