import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertTriangle, ShieldAlert, Target, Layers } from "lucide-react";

interface OverviewProps {
  totalStudents: number;
  avgAccuracy: number; // 0-100
  criticalSubtopics: number;
  warningSubtopics: number;
  healthySubtopics: number;
  studentsAtRisk: number; // alto + crítico
  loading?: boolean;
}

const KPI = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "neutral" | "warning" | "danger" | "success" }) => {
  const toneCls =
    tone === "danger" ? "text-destructive" :
    tone === "warning" ? "text-amber-500" :
    tone === "success" ? "text-emerald-500" :
    "text-foreground";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center ${toneCls}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className={`text-xl font-semibold ${toneCls}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const ProfessorProficiencyOverview = ({
  totalStudents,
  avgAccuracy,
  criticalSubtopics,
  warningSubtopics,
  healthySubtopics,
  studentsAtRisk,
  loading,
}: OverviewProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KPI icon={<Users className="h-4 w-4" />} label="Alunos no escopo" value={loading ? "—" : totalStudents} />
      <KPI icon={<Target className="h-4 w-4" />} label="Proficiência média" value={loading ? "—" : `${avgAccuracy}%`} tone={avgAccuracy >= 70 ? "success" : avgAccuracy >= 50 ? "warning" : "danger"} />
      <KPI icon={<ShieldAlert className="h-4 w-4" />} label="Alunos em risco" value={loading ? "—" : studentsAtRisk} tone={studentsAtRisk > 0 ? "danger" : "success"} />
      <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Subtemas críticos" value={loading ? "—" : criticalSubtopics} tone="danger" />
      <KPI icon={<Layers className="h-4 w-4" />} label="Subtemas em atenção" value={loading ? "—" : warningSubtopics} tone="warning" />
      <KPI icon={<Layers className="h-4 w-4" />} label="Subtemas saudáveis" value={loading ? "—" : healthySubtopics} tone="success" />
    </div>
  );
};

export default ProfessorProficiencyOverview;
