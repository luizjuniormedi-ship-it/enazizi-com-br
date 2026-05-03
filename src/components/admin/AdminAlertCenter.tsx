import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { toast } from "sonner";

export function AdminAlertCenter() {
  const [alerts, setAlerts] = useState<any[]>([]);

  const checkAlerts = async () => {
    try {
      // 1. Check AI Latency
      const { data: aiQualityRes } = await supabase.rpc('admin_telemetry_v2_ai_quality', { _days: 1 });
      const aiQuality = aiQualityRes as any;
      const newAlerts = [];

      if (aiQuality?.avg_latency_ms > 5000) {
        newAlerts.push({
          id: 'ai-latency',
          title: 'Tutor IA Lento',
          description: `Latência média nas últimas 24h: ${aiQuality.avg_latency_ms}ms. Verifique as Edge Functions.`,
          severity: 'critical',
          icon: <Activity className="h-4 w-4" />
        });
      }

      if (aiQuality?.fallback_rate > 15) {
        newAlerts.push({
          id: 'ai-fallback',
          title: 'Taxa de Fallback Alta',
          description: `Uso de modelos de emergência em ${aiQuality.fallback_rate}%. Possível sobrecarga da API principal.`,
          severity: 'high',
          icon: <AlertTriangle className="h-4 w-4" />
        });
      }

      // 2. Check Abandonment Spikes
      const { data: pedagogyRes } = await supabase.rpc('admin_telemetry_v2_pedagogy', { _days: 1 });
      const pedagogy = pedagogyRes as any;
      if (pedagogy?.abandonment_rate > 35) {
        newAlerts.push({
          id: 'high-abandonment',
          title: 'Pico de Abandono',
          description: `Taxa de abandono hoje está em ${pedagogy.abandonment_rate}%. Verifique fricção nas rotas principais.`,
          severity: 'high',
          icon: <ShieldCheck className="h-4 w-4" />
        });
      }

      setAlerts(newAlerts);
      
      // Notify via toast for new critical alerts
      newAlerts.filter(a => a.severity === 'critical').forEach(a => {
        toast.error(a.title, { description: a.description });
      });

    } catch (err) {
      console.error("Failed to check alerts:", err);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000); // Check every 5 min
    return () => clearInterval(interval);
  }, []);

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
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
