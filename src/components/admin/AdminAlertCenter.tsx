import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { toast } from "sonner";

export function AdminAlertCenter() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rca, setRca] = useState<Record<string, any>>({});
  const [thresholds, setThresholds] = useState<Record<string, any>>({});

  const loadThresholds = async () => {
    const { data } = await supabase.from("governance_thresholds").select("*");
    if (data) {
      const mapped = data.reduce((acc: any, curr: any) => {
        acc[curr.key] = Object.values(curr.value)[0];
        return acc;
      }, {});
      setThresholds(mapped);
    }
  };

  const runRCA = async (alertId: string) => {
    const { data } = await supabase.rpc('admin_telemetry_rca', { alert_id: alertId });
    if (data) {
      setRca(prev => ({ ...prev, [alertId]: data }));
    }
  };

  const checkAlerts = async () => {
    try {
      if (Object.keys(thresholds).length === 0) await loadThresholds();
      
      const { data: aiQualityRes } = await supabase.rpc('admin_telemetry_v2_ai_quality', { _days: 1 });
      const aiQuality = aiQualityRes as any;
      const newAlerts = [];

      const aiLatencyLimit = thresholds['ai_latency_threshold_ms'] || 5000;
      if (aiQuality?.avg_latency_ms > aiLatencyLimit) {
        newAlerts.push({
          id: 'ai-latency',
          title: 'Tutor IA Lento',
          description: `Latência média nas últimas 24h: ${aiQuality.avg_latency_ms}ms. (Limite: ${aiLatencyLimit}ms)`,
          severity: 'critical',
          icon: <Activity className="h-4 w-4" />
        });
        runRCA('ai-latency');
      }

      const fallbackLimit = thresholds['fallback_rate_critical'] || 15;
      if (aiQuality?.fallback_rate > fallbackLimit) {
        newAlerts.push({
          id: 'ai-fallback',
          title: 'Taxa de Fallback Alta',
          description: `Uso de modelos de emergência em ${aiQuality.fallback_rate}%. (Limite: ${fallbackLimit}%)`,
          severity: 'high',
          icon: <AlertTriangle className="h-4 w-4" />
        });
      }

      const abandonLimit = thresholds['session_abandonment_rate'] || 35;
      const { data: pedagogyRes } = await supabase.rpc('admin_telemetry_v2_pedagogy', { _days: 1 });
      const pedagogy = pedagogyRes as any;
      if (pedagogy?.abandonment_rate > abandonLimit) {
        newAlerts.push({
          id: 'high-abandonment',
          title: 'Pico de Abandono',
          description: `Taxa de abandono hoje em ${pedagogy.abandonment_rate}%. (Limite: ${abandonLimit}%)`,
          severity: 'high',
          icon: <ShieldCheck className="h-4 w-4" />
        });
      }

      setAlerts(newAlerts);
      newAlerts.filter(a => a.severity === 'critical').forEach(a => {
        toast.error(a.title, { description: a.description });
      });

    } catch (err) {
      console.error("Failed to check alerts:", err);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [thresholds]);

  if (alerts.length === 0) return null;

  return (
    <Card className="border-red-500/20 bg-red-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4 text-red-500" /> Centro de Alertas Críticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map(alert => (
          <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'} className="bg-background/50 border-none shadow-sm">
            <div className="flex gap-3">
              <div className="mt-0.5">{alert.icon}</div>
              <div>
                <AlertTitle className="text-sm font-semibold flex items-center gap-2">
                  {alert.title}
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    {alert.severity.toUpperCase()}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground mt-1">
                  {alert.description}
                  {rca[alert.id] && (
                    <div className="mt-2 p-2 bg-muted/50 rounded border border-border/50">
                      <p className="font-bold text-[10px] uppercase text-red-500 mb-1">Diagnóstico Automático (RCA):</p>
                      <p className="font-medium">{rca[alert.id].probable_cause}</p>
                      <p className="mt-1">Rotas afetadas: {rca[alert.id].affected_routes?.join(", ")}</p>
                      <p className="mt-1 text-primary">Próximos passos: {rca[alert.id].next_steps}</p>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
