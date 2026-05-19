
import { useGovernanceObservatory } from "@/hooks/useGovernanceObservatory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Database, Brain, BookOpen, Activity, AlertTriangle } from "lucide-react";
import { GovernanceLayerStatus } from "@/types/governance";

const StatusBadge = ({ status }: { status: GovernanceLayerStatus }) => {
  const styles = {
    optimal: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    stable: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    critical: "bg-red-500/10 text-red-500 border-red-500/20"
  };

  return (
    <Badge variant="outline" className={styles[status]}>
      {status.toUpperCase()}
    </Badge>
  );
};

export function GovernanceCockpit({ userId }: { userId?: string }) {
  const { data: metrics, isLoading } = useGovernanceObservatory(userId);

  if (isLoading) return <div className="h-64 animate-pulse bg-muted rounded-xl" />;
  if (!metrics) return null;

  const layerInfo = [
    { name: "Layer 1: DATA", status: metrics.layers.data, icon: Database, desc: "Telemetria, Erros e Retenção" },
    { name: "Layer 2: COGNITIVE ENGINE", status: metrics.layers.cognitiveEngine, icon: Brain, desc: "FSRS, Preditor e Study Engine" },
    { name: "Layer 3: PEDAGOGICAL", status: metrics.layers.pedagogicalOrchestration, icon: BookOpen, desc: "Tutor IA e Missões Diárias" },
    { name: "Layer 4: GOVERNANCE", status: metrics.layers.governance, icon: ShieldCheck, desc: "Auditabilidade e Anti-alucinação" }
  ];

  return (
    <div className="space-y-6">
      {/* Structural Layers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {layerInfo.map((layer) => (
          <Card key={layer.name} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <layer.icon className="h-5 w-5 text-primary" />
                </div>
                <StatusBadge status={layer.status} />
              </div>
              <h3 className="font-bold text-sm mb-1">{layer.name}</h3>
              <p className="text-xs text-muted-foreground">{layer.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Official Indices */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Índices Oficiais de Governança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <ScoreItem 
              label="CognitiveLoadScore" 
              value={metrics.indices.cognitiveLoadScore} 
              inverse 
              desc="Nível de sobrecarga cognitiva (ideal < 40)"
            />
            <ScoreItem 
              label="RetentionScore" 
              value={metrics.indices.retentionScore} 
              desc="Nível de retenção de conhecimento real"
            />
            <ScoreItem 
              label="RecoveryScore" 
              value={metrics.indices.recoveryScore} 
              desc="Eficiência na recuperação de erros"
            />
            <ScoreItem 
              label="PlannerHealthScore" 
              value={metrics.indices.plannerHealthScore} 
              desc="Saúde e realismo do cronograma"
            />
            <ScoreItem 
              label="TutorPedagogicalScore" 
              value={metrics.indices.tutorPedagogicalScore} 
              desc="Eficácia pedagógica do Mentor IA"
            />
            <ScoreItem 
              label="AdaptiveConsistencyScore" 
              value={metrics.indices.adaptiveConsistencyScore} 
              desc="Consistência da adaptação longitudinal"
            />
            <ScoreItem 
              label="ApprovalConfidenceScore" 
              value={metrics.indices.approvalConfidenceScore} 
              highlight
              desc="Probabilidade de aprovação estimada"
            />
            <ScoreItem 
              label="MissionQualityScore" 
              value={metrics.indices.missionQualityScore} 
              desc="Aderência pedagógica das missões"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreItem({ label, value, desc, inverse = false, highlight = false }: { 
  label: string; 
  value: number; 
  desc: string;
  inverse?: boolean;
  highlight?: boolean;
}) {
  const isWarning = inverse ? value > 60 : value < 40;
  const isCritical = inverse ? value > 80 : value < 25;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className={`text-sm font-semibold ${highlight ? "text-primary" : ""}`}>
            {label}
          </span>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          {isWarning && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          <span className={`text-sm font-mono font-bold ${isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500"}`}>
            {value}%
          </span>
        </div>
      </div>
      <Progress 
        value={value} 
        className="h-1.5" 
      />
    </div>
  );
}
