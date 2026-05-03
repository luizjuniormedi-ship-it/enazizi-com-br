import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, AlertCircle, CheckCircle2, Search, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminAudit() {
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<any>(null);

  async function loadAudit() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_telemetry_audit");
    if (!error) setAudit(data);
    setLoading(false);
  }

  useEffect(() => { loadAudit(); }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const auditItems = [
    { key: 'orphan_events', label: 'Eventos Órfãos', desc: 'Eventos sem user_id associado', critical: audit?.orphan_events > 0 },
    { key: 'open_sessions', label: 'Sessões sem Encerramento', desc: 'Sessões iniciadas sem complete/abandon', critical: audit?.open_sessions > 100 },
    { key: 'missing_routes', label: 'Eventos sem Rota', desc: 'Telemetria sem contexto de navegação', critical: audit?.missing_routes > 0 },
    { key: 'timestamp_gaps', label: 'Gaps de Telemetria', desc: 'Intervalos > 1h sem nenhum evento global', critical: audit?.timestamp_gaps > 0 },
    { key: 'duplicate_events', label: 'Eventos Duplicados', desc: 'Eventos com mesmo timestamp/sessão/usuário', critical: audit?.duplicate_events > 0 },
  ];

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Auditoria de Integridade</h1>
        <p className="text-muted-foreground mt-2">Validação técnica da pipeline de dados e gaps de telemetria.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {auditItems.map(item => (
          <Card key={item.key} className={item.critical ? "border-red-500/20 bg-red-500/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              {item.critical ? <AlertCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{audit?.[item.key] || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              {item.critical && (
                <Alert className="mt-4 bg-background/50 border-red-500/20 py-2">
                  <Info className="h-3 w-3" />
                  <AlertDescription className="text-[10px]">Ação recomendada: Revisar triggers de encerramento de sessão.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
