import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Activity, Clock, Zap, Target, MousePointer2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminCognitiveOrchestrator() {
  const { data: activeSessions, isLoading } = useQuery({
    queryKey: ["admin-active-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_student_profiles")
        .select(`
          user_id,
          current_session_mode,
          cognitive_stress_index,
          fatigue_index,
          response_speed_index,
          updated_at,
          profiles (
            display_name,
            email
          )
        `)
        .order("updated_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="p-8 text-center">Monitorando sessões cognitivas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Cognitive Session Orchestrator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real do estado cognitivo e modos de sessão da rede.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OrchestratorStatCard 
          title="Fadiga Média" 
          value="24%" 
          icon={Activity}
          description="Nível de cansaço global detectado"
        />
        <OrchestratorStatCard 
          title="Modo Recuperação" 
          value={activeSessions?.filter(s => s.current_session_mode === 'recovery').length || 0} 
          icon={Zap}
          description="Alunos em modo de preservação"
        />
        <OrchestratorStatCard 
          title="Overload Risk" 
          value="High" 
          icon={Target}
          description="3 sessões com risco de abandono"
          tone="warn"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <MousePointer2 className="h-5 w-5 text-primary" />
            Sessões Ativas & Estado Adaptativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Modo Atual</TableHead>
                  <TableHead>Stress</TableHead>
                  <TableHead>Fadiga</TableHead>
                  <TableHead>Velocidade</TableHead>
                  <TableHead className="text-right">Visto por último</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSessions?.map((session: any) => (
                  <TableRow key={session.user_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{session.profiles?.display_name || 'Usuário'}</span>
                        <span className="text-[10px] text-muted-foreground">{session.profiles?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ModeBadge mode={session.current_session_mode} />
                    </TableCell>
                    <TableCell>
                      <ValueProgress value={session.cognitive_stress_index} />
                    </TableCell>
                    <TableCell>
                      <ValueProgress value={session.fatigue_index} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">{(session.response_speed_index || 1.0).toFixed(2)}x</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const configs: Record<string, string> = {
    silent: "bg-blue-500/10 text-blue-600 border-blue-200",
    balanced: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    intense: "bg-orange-500/10 text-orange-600 border-orange-200",
    recovery: "bg-red-500/10 text-red-600 border-red-200 animate-pulse",
  };

  return (
    <Badge variant="outline" className={`text-[10px] uppercase font-bold ${configs[mode] || ""}`}>
      {mode}
    </Badge>
  );
}

function ValueProgress({ value }: { value: number }) {
  const color = value > 0.8 ? "bg-red-500" : value > 0.5 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-16 space-y-1">
      <div className="flex justify-between text-[9px] font-mono">
        <span>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function OrchestratorStatCard({ title, value, icon: Icon, description, tone }: { title: string; value: any; icon: any; description: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
          <div className={`p-2 rounded-lg bg-muted/50 ${tone === 'warn' ? 'text-amber-600' : 'text-primary'}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
