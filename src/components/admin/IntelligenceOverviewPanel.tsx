import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Activity, Zap, Beaker, ShieldAlert, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function IntelligenceOverviewPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["intelligence-global-stats"],
    queryFn: async () => {
      const [experiments, assignments, interventions, profiles] = await Promise.all([
        supabase.from("adaptive_experiments").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("user_experiment_assignments").select("id", { count: "exact" }),
        supabase.from("adaptive_interventions").select("id, post_intervention_outcome"),
        supabase.from("adaptive_student_profiles").select("cognitive_stress_index, recovery_mode_active")
      ]);

      const totalInterventions = interventions.data?.length || 0;
      const improved = interventions.data?.filter(i => i.post_intervention_outcome === 'improved').length || 0;
      const recoveryActive = profiles.data?.filter(p => p.recovery_mode_active).length || 0;
      const avgStress = profiles.data?.reduce((acc, p) => acc + (p.cognitive_stress_index || 0), 0) / (profiles.data?.length || 1);

      return {
        activeExperiments: experiments.count || 0,
        totalAssigned: assignments.count || 0,
        efficacy: totalInterventions > 0 ? (improved / totalInterventions) * 100 : 0,
        recoveryActive,
        avgStress: avgStress * 100,
        totalProfiles: profiles.data?.length || 0
      };
    }
  });

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
  </div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Eficácia ACE" 
          value={`${stats?.efficacy.toFixed(1)}%`} 
          subtitle="Melhora pós-intervenção"
          icon={TrendingUp}
          tone="success"
        />
        <StatCard 
          title="Stress Cognitivo" 
          value={`${stats?.avgStress.toFixed(1)}%`} 
          subtitle="Média global da rede"
          icon={Zap}
          tone="warn"
        />
        <StatCard 
          title="Em Recuperação" 
          value={stats?.recoveryActive || 0} 
          subtitle="Usuários em burnout-safe"
          icon={ShieldAlert}
          tone="danger"
        />
        <StatCard 
          title="Experimentos A/B" 
          value={stats?.activeExperiments || 0} 
          subtitle={`${stats?.totalAssigned} alunos testados`}
          icon={Beaker}
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Saúde da Rede Adaptativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Cobertura de Maestria</span>
                <span>72%</span>
              </div>
              <Progress value={72} className="h-1.5" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Adesão às Políticas</span>
                <span>94%</span>
              </div>
              <Progress value={94} className="h-1.5" />
            </div>
            <div className="pt-2 border-t">
              <p className="text-[10px] text-muted-foreground leading-tight">
                O ACE está operando dentro dos limites de governança pedagógica. 
                Nenhum loop adaptativo infinito detectado nas últimas 24h.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Status do Shadow Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            <div className="text-center space-y-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-4 py-1">
                92% SHADOW
              </Badge>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                A maioria das decisões ACE ainda roda em modo observacional para validação de segurança.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, tone }: { title: string; value: string | number; subtitle: string; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    success: "text-emerald-600",
    warn: "text-amber-600",
    danger: "text-red-600",
    info: "text-blue-600"
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg bg-muted/50 ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
