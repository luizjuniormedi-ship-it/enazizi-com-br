import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Target, AlertTriangle, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PrioritizedItem {
  diagnosis: string;
  difficulty: string;
  priority_score: number;
  reason: string;
  components: { exam_score: number; gap_score: number; weakness_score: number };
}

interface GapSummary {
  total_assets: number;
  total_questions: number;
  missing_diagnoses: number;
  saturated: number;
  difficulty: { easy: number; medium: number; hard: number };
  student_weakness: { avg_accuracy: number; total_students: number };
}

const PipelineOptimizationPanel = () => {
  const [selectedType, setSelectedType] = useState("xray");
  const [isPlanning, setIsPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<{
    batch: PrioritizedItem[];
    gap_summary: GapSummary;
    priority_mode: string;
  } | null>(null);

  const { data: gapData, isLoading: gapLoading, refetch: refetchGap } = useQuery({
    queryKey: ["content-gaps", selectedType],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("compute_content_gaps", { p_image_type: selectedType });
      return data;
    },
  });

  const handlePlanBatch = async () => {
    setIsPlanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("plan-next-batch", {
        body: { image_type: selectedType, batch_size: 10 },
      });
      if (error) throw error;
      setPlanResult(data);
      toast.success("Lote priorizado calculado!");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao planejar"));
    } finally {
      setIsPlanning(false);
    }
  };

  const diffDist = gapData?.difficulty_distribution || { easy: 0, medium: 0, hard: 0 };
  const totalAssets = gapData?.total_assets || 0;
  const diagDist = (gapData?.diagnosis_distribution || []) as any[];

  return (
    <Card className="p-4 space-y-4 border-primary/20">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Otimização do Pipeline
        </h3>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xray">🫁 RX</SelectItem>
            <SelectItem value="ecg">❤️ ECG</SelectItem>
            <SelectItem value="ct">🧠 TC</SelectItem>
            <SelectItem value="us">📡 US</SelectItem>
            <SelectItem value="dermatology">🩹 Dermato</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Current Inventory */}
      {gapLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : gapData ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-lg font-bold text-primary">{totalAssets}</p>
              <p className="text-[10px] text-muted-foreground">Assets</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-lg font-bold text-green-400">{gapData.total_questions || 0}</p>
              <p className="text-[10px] text-muted-foreground">Questões</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-lg font-bold text-amber-400">{gapData.assets_without_questions || 0}</p>
              <p className="text-[10px] text-muted-foreground">Sem questão</p>
            </div>
          </div>

          {/* Difficulty balance */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Balanceamento de dificuldade</p>
            <div className="flex gap-2">
              {[
                { key: "easy", label: "Fácil", color: "bg-green-500", target: 0.25 },
                { key: "medium", label: "Médio", color: "bg-yellow-500", target: 0.40 },
                { key: "hard", label: "Difícil", color: "bg-red-500", target: 0.35 },
              ].map(d => {
                const count = diffDist[d.key] || 0;
                const pct = totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
                const targetPct = Math.round(d.target * 100);
                const isLow = pct < targetPct - 10;
                return (
                  <div key={d.key} className="flex-1 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="text-xs font-medium">{count}</span>
                      <span className={`text-[10px] ${isLow ? "text-red-400" : "text-muted-foreground"}`}>
                        ({pct}% / {targetPct}%)
                      </span>
                    </div>
                    <Progress value={Math.min(100, (pct / targetPct) * 100)} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{d.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top diagnoses */}
          {diagDist.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Diagnósticos ({diagDist.length})</p>
              <div className="flex flex-wrap gap-1">
                {diagDist.slice(0, 8).map((d: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {d.diagnosis} ({d.count})
                  </Badge>
                ))}
                {diagDist.length > 8 && (
                  <Badge variant="secondary" className="text-[10px]">+{diagDist.length - 8}</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Plan Button */}
      <div className="flex gap-2">
        <Button onClick={handlePlanBatch} disabled={isPlanning} size="sm" className="flex-1 gap-1.5">
          {isPlanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          {isPlanning ? "Calculando..." : "Planejar Próximo Lote"}
        </Button>
        <Button onClick={() => refetchGap()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Plan Result */}
      {planResult && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Próximo Lote Recomendado
            </p>
            <Badge variant="secondary" className="text-[10px]">
              {planResult.priority_mode}
            </Badge>
          </div>

          {/* Weakness info */}
          {planResult.gap_summary.student_weakness.total_students > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-amber-300">
                Acurácia média dos alunos: {Math.round(planResult.gap_summary.student_weakness.avg_accuracy * 100)}%
                ({planResult.gap_summary.student_weakness.total_students} alunos fracos)
              </span>
            </div>
          )}

          {/* Missing diagnoses */}
          {planResult.gap_summary.missing_diagnoses > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 rounded-lg px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs text-red-300">
                {planResult.gap_summary.missing_diagnoses} diagnósticos prioritários ausentes no banco
              </span>
            </div>
          )}

          {/* Priority list */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {planResult.batch.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-primary w-6">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.diagnosis}</p>
                  <p className="text-[10px] text-muted-foreground">{item.reason}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {item.difficulty === "easy" ? "🟢" : item.difficulty === "medium" ? "🟡" : "🔴"} {item.difficulty}
                </Badge>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-primary">{item.priority_score}</p>
                  <p className="text-[9px] text-muted-foreground">
                    P:{item.components.exam_score} G:{item.components.gap_score} F:{item.components.weakness_score}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default PipelineOptimizationPanel;
