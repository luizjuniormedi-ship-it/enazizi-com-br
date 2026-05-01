import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Beaker, TrendingUp, Users, Activity, FlaskConical, BarChart, AlertTriangle } from "lucide-react";
import { useAdaptiveExperiments, useExperimentEfficacy, AdaptiveExperiment } from "@/hooks/useAdaptiveExperiments";
import { Progress } from "@/components/ui/progress";

export default function AdminAdaptiveExperiments() {
  const { data: experiments, isLoading } = useAdaptiveExperiments();
  const [selectedExp, setSelectedExp] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-center">Carregando Experimentos Adaptativos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Beaker className="h-6 w-6 text-primary" />
            Adaptive Experimentation Layer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Testes A/B pedagógicos para validar eficácia de intervenções ACE.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Experimentos Ativos</h3>
          {experiments?.map((exp) => (
            <ExperimentCard 
              key={exp.id} 
              exp={exp} 
              isSelected={selectedExp === exp.id}
              onClick={() => setSelectedExp(exp.id)}
            />
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedExp ? (
            <EfficacyDashboard experimentId={selectedExp} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center space-y-3">
              <FlaskConical className="h-12 w-12 text-muted-foreground/30" />
              <div className="text-lg font-medium text-muted-foreground">Selecione um experimento</div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Visualize a eficácia comparativa entre diferentes variantes pedagógicas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExperimentCard({ exp, isSelected, onClick }: { exp: AdaptiveExperiment; isSelected: boolean; onClick: () => void }) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:border-primary/50 ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <Badge variant={exp.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase">
            {exp.status}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {new Date(exp.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-sm leading-tight">{exp.name}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2">{exp.description}</p>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t">
          <Badge variant="outline" className="text-[10px] gap-1">
            <BarChart className="h-3 w-3" /> {exp.target_metric}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{exp.variants.length} variantes</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EfficacyDashboard({ experimentId }: { experimentId: string }) {
  const { data: efficacy, isLoading } = useExperimentEfficacy(experimentId);

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Calculando eficácia comparativa...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Análise Científica de Eficácia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {efficacy?.map((variant) => (
            <div key={variant.variant_id} className="p-4 rounded-xl border bg-muted/20 space-y-4">
              <div className="flex justify-between items-center">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  Variante {variant.variant_id}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {variant.sample_size} alunos
                </div>
              </div>

              <div className="space-y-3">
                <EfficacyMetric 
                  label="Retenção (Lift)" 
                  value={variant.retention_lift} 
                  target={100}
                  prefix="+"
                  suffix="%"
                />
                <EfficacyMetric 
                  label="Melhora de Maestria" 
                  value={variant.avg_improvement_score} 
                  target={100}
                  suffix="%"
                />
                <EfficacyMetric 
                  label="Redução de Fricção" 
                  value={variant.friction_reduction_score} 
                  target={100}
                  suffix="%"
                />
              </div>
            </div>
          ))}
        </div>

        {(!efficacy || efficacy.length === 0) && (
          <div className="p-8 text-center bg-muted/30 rounded-lg border border-dashed">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Dados insuficientes para gerar análise estatística significativa.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EfficacyMetric({ label, value, target, prefix = "", suffix = "" }: { label: string; value: number; target: number; prefix?: string; suffix?: string }) {
  const pct = (value / target) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-medium uppercase tracking-tight">
        <span>{label}</span>
        <span className={value > 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
          {prefix}{value.toFixed(1)}{suffix}
        </span>
      </div>
      <Progress value={Math.min(100, pct)} className="h-1.5" />
    </div>
  );
}
