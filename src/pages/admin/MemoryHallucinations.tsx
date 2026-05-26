/**
 * /admin/memory-hallucinations — Forense de Alucinações & Memórias Críticas (v23)
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

type Row = {
  id: string;
  question_original: string;
  specialty: string | null;
  cognitive_stage: string | null;
  promotion_status: string;
  reuse_count: number;
  reuse_failure_count: number;
  drift_score: number;
  risk_level: string;
  last_validated_at: string | null;
  created_at: string;
};

export default function MemoryHallucinations() {
  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ["memory-hallucination-forensics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("memory_hallucination_forensics" as any, { p_limit: 100 });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const bySpecialty = (data || []).reduce<Record<string, number>>((acc, r) => {
    const k = r.specialty || "—"; acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Hallucination Forensics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Memórias com hallucination flag, quarentinadas ou risco alto/crítico.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/memory-health"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
        </Button>
      </div>

      <Card><CardHeader><CardTitle className="text-sm">Distribuição por especialidade</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(bySpecialty).map(([k, v]) => (
            <Badge key={k} variant="secondary">{k}: {v}</Badge>
          ))}
          {!Object.keys(bySpecialty).length && <span className="text-xs text-muted-foreground">Sem incidentes registrados.</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Top 100 críticos</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          <div className="space-y-2">
            {(data || []).map((r) => (
              <div key={r.id} className="border border-border/40 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium line-clamp-2 flex-1">{r.question_original}</p>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant={r.risk_level === "critical" ? "destructive" : r.risk_level === "high" ? "default" : "outline"}>
                      {r.risk_level}
                    </Badge>
                    <Badge variant={r.promotion_status === "quarantined" ? "destructive" : "secondary"}>
                      {r.promotion_status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  {r.specialty && <span>📚 {r.specialty}</span>}
                  {r.cognitive_stage && <span>🧠 {r.cognitive_stage}</span>}
                  <span>♻️ reuse {r.reuse_count} (fails {r.reuse_failure_count})</span>
                  <span>📉 drift {Number(r.drift_score).toFixed(2)}</span>
                  <span>📅 {new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
            {!isLoading && !data?.length && <p className="text-xs text-muted-foreground">Nenhuma memória crítica detectada. 🎉</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
