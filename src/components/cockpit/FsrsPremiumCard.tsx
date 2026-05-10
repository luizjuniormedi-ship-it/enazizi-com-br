import { useEffect, useState } from "react";
import { Brain, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FsrsStats {
  total: number;
  due: number;
  lapses: number;
  avgStability: number;
  estimatedRetention: number;
  topicsAtRisk: { topic: string; due: number }[];
}

/**
 * FSRS Premium — exibe métricas reais de retenção do aluno.
 * Não inventa dado: se não houver fsrs_cards, mostra fallback honesto.
 */
export default function FsrsPremiumCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FsrsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("fsrs_cards")
        .select("stability, lapses, due, card_type")
        .eq("user_id", user.id);

      if (!data || data.length === 0) {
        setStats(null);
        setLoading(false);
        return;
      }

      const now = Date.now();
      const total = data.length;
      const due = data.filter((c: any) => c.due && new Date(c.due).getTime() < now).length;
      const lapses = data.reduce((s: number, c: any) => s + (c.lapses || 0), 0);
      const stabilities = data.map((c: any) => Number(c.stability) || 0).filter((s) => s > 0);
      const avgStability = stabilities.length
        ? stabilities.reduce((a, b) => a + b, 0) / stabilities.length
        : 0;
      // Retenção estimada via decaimento padrão FSRS: R = exp(-elapsed/stability) com elapsed=1d
      const estimatedRetention = avgStability > 0
        ? Math.round(Math.exp(-1 / Math.max(avgStability, 1)) * 100)
        : 0;

      // Temas em risco: agrupa por card_type/ref para identificar carga vencida
      const riskMap = new Map<string, number>();
      data.forEach((c: any) => {
        if (c.due && new Date(c.due).getTime() < now) {
          const key = c.card_type || "geral";
          riskMap.set(key, (riskMap.get(key) || 0) + 1);
        }
      });
      const topicsAtRisk = Array.from(riskMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([topic, dueCount]) => ({ topic, due: dueCount }));

      setStats({ total, due, lapses, avgStability, estimatedRetention, topicsAtRisk });
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (!stats || stats.total === 0) return null; // honest fallback: hide

  const retentionColor =
    stats.estimatedRetention >= 85
      ? "text-emerald-500"
      : stats.estimatedRetention >= 70
        ? "text-amber-500"
        : "text-destructive";

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Memória FSRS</h3>
        </div>
        <Badge variant="outline" className="text-xs">dados reais</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Retenção estimada</div>
          <div className={`text-2xl font-bold ${retentionColor}`}>
            {stats.estimatedRetention}%
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Estabilidade média</div>
          <div className="text-2xl font-bold">{stats.avgStability.toFixed(1)}d</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Cartões totais</div>
          <div className="text-lg font-semibold">{stats.total}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Carga vencida</div>
          <div className={`text-lg font-semibold ${stats.due > 0 ? "text-destructive" : ""}`}>
            {stats.due}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground">Lapses acumulados</div>
          <div className="text-lg font-semibold">{stats.lapses}</div>
        </div>
      </div>

      {stats.topicsAtRisk.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Categorias em risco
          </div>
          {stats.topicsAtRisk.map((t) => (
            <div key={t.topic} className="flex justify-between text-sm">
              <span className="capitalize">{t.topic}</span>
              <span className="text-destructive font-medium">{t.due} vencidos</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
