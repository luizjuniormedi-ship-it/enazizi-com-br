import { useEffect, useState } from "react";
import { Target, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ChanceRow {
  banca: string;
  chance_score: number;
  factors_json: any;
  updated_at: string;
}

/**
 * TRI Premium — usa chance_by_exam (proxy) com rótulo honesto "estimativa".
 * Nunca inventa theta. Se não houver dado, esconde silenciosamente.
 */
export default function TriPremiumCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("chance_by_exam")
        .select("banca, chance_score, factors_json, updated_at")
        .eq("user_id", user.id)
        .order("chance_score", { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <Skeleton className="h-32 rounded-xl" />;
  if (rows.length === 0) return null;

  return (
    <TooltipProvider>
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Habilidade por Banca</h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs gap-1 cursor-help">
                <Info className="h-3 w-3" />
                estimativa (proxy)
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Estimativa baseada em desempenho histórico, não é theta TRI calibrado.
                Reflete chance de aprovação relativa, não absoluta.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-3">
          {rows.map((r) => {
            const color =
              r.chance_score >= 70
                ? "bg-emerald-500"
                : r.chance_score >= 50
                  ? "bg-amber-500"
                  : "bg-destructive";
            return (
              <div key={r.banca} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium uppercase">{r.banca}</span>
                  <span className="font-semibold">{Math.round(r.chance_score)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${Math.max(2, Math.min(100, r.chance_score))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Atualizado em {new Date(rows[0].updated_at).toLocaleDateString("pt-BR")}
        </p>
      </Card>
    </TooltipProvider>
  );
}
