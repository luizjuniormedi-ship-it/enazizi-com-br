import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, AlertCircle, Clock, Zap, Info } from "lucide-react";
import { useInterventionPolicies } from "@/hooks/useInterventionPolicies";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminInterventionPolicies() {
  const { data: policies, isLoading, togglePolicy } = useInterventionPolicies();

  if (isLoading) return <div className="p-8 text-center">Carregando Políticas de Governança...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Políticas de Intervenção ACE
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governança formal para evitar fadiga cognitiva e spam adaptativo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Políticas Pedagógicas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Política</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Limites (Sessão/Dia)</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Confiança Mín.</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies?.map((policy) => (
                    <TableRow key={policy.id} className={!policy.is_active ? "opacity-60 bg-muted/20" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{policy.name}</span>
                          <span className="text-[10px] text-muted-foreground font-normal max-w-xs line-clamp-1">
                            {policy.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {policy.trigger_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge level={policy.severity_level} />
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {policy.max_per_session} / {policy.max_per_day}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" /> {policy.cooldown_minutes}m
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          {(policy.min_confidence_score * 100).toFixed(0)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch 
                          checked={policy.is_active} 
                          onCheckedChange={(checked) => togglePolicy.mutate({ id: policy.id, is_active: checked })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PolicyInfoCard 
            title="Spam Adaptativo"
            description="Impede que o sistema sugira intervenções repetitivas no mesmo cooldown."
            icon={AlertCircle}
            tone="info"
          />
          <PolicyInfoCard 
            title="Fadiga Cognitiva"
            description="Monitora o intervention_frequency_score para reduzir intervenções proativas."
            icon={Zap}
            tone="warn"
          />
          <PolicyInfoCard 
            title="Governança Shadow"
            description="Políticas em modo shadow apenas registram violações sem bloquear o ACE."
            icon={ShieldCheck}
            tone="success"
          />
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-blue-500/10 text-blue-600 border-blue-200",
    medium: "bg-amber-500/10 text-amber-600 border-amber-200",
    high: "bg-orange-500/10 text-orange-600 border-orange-200",
    critical: "bg-red-500/10 text-red-600 border-red-200",
  };

  return (
    <Badge variant="outline" className={`text-[10px] uppercase font-bold ${colors[level] || ""}`}>
      {level}
    </Badge>
  );
}

function PolicyInfoCard({ title, description, icon: Icon, tone }: { title: string; description: string; icon: any; tone: string }) {
  const toneClasses: Record<string, string> = {
    info: "border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5",
    warn: "border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5",
    success: "border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5",
  };

  return (
    <Card className={toneClasses[tone]}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-background shadow-sm border">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold">{title}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
