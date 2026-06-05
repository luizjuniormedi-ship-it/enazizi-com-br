import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, Zap, ArrowUpRight, BarChart3, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

interface GapTheme {
  theme_id: string;
  theme_name: string;
  current_mastery: number;
  potential_gain: number;
  priority: number;
}

export default function EnamedImpactDashboard() {
  const { user } = useAuth();

  const { data: gaps, isLoading } = useQuery({
    queryKey: ["enamed-gap-analysis", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_readiness_gap', {
        p_user_id: user!.id
      });

      if (error) throw error;
      return data as GapTheme[];
    },
    enabled: !!user
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const totalPotentialGain = gaps?.reduce((acc, g) => acc + g.potential_gain, 0) || 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
            <Zap className="h-5 w-5 text-primary fill-primary" />
            Top Impacto ENAMED
          </CardTitle>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black">
            +{totalPotentialGain.toFixed(1)}% GANHO TOTAL
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
          Temas que mais aumentam sua chance de aprovação
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {gaps?.map((gap, i) => (
          <div 
            key={gap.theme_id} 
            className="group relative flex flex-col gap-2 p-4 rounded-2xl border bg-card/50 backdrop-blur-sm transition-all hover:bg-card hover:shadow-lg border-primary/10"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{gap.theme_name}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold bg-muted/50">
                    PRIORIDADE: {Math.round(gap.priority)}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-emerald-500 font-black text-sm">
                  <ArrowUpRight className="h-4 w-4" />
                  +{gap.potential_gain.toFixed(1)}%
                </div>
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Ganho Estimado</span>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                <span className="text-muted-foreground">Domínio Atual</span>
                <span>{Math.round(gap.current_mastery)}%</span>
              </div>
              <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
                <Progress value={gap.current_mastery} className="h-full bg-primary" />
              </div>
            </div>
          </div>
        ))}

        {(!gaps || gaps.length === 0) && (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Sincronizando inteligência de impacto...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
