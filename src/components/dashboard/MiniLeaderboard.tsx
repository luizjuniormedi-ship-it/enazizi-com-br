import { useEffect, useState } from "react";
import { Crown, ChevronRight, TrendingUp, ArrowUp, ArrowDown, Minus, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface RankInsight {
  category: string;
  rank: number;
  delta: number;
  percentile: number;
  score: number;
}

const categoryLabels: Record<string, { label: string; emoji: string }> = {
  consistency: { label: "Consistência cognitiva", emoji: "🔥" },
  evolution: { label: "Maior evolução", emoji: "📈" },
  performance: { label: "Domínio sustentado", emoji: "🏆" },
  practical: { label: "Recuperação exemplar", emoji: "🩺" },
};

const motivationalMessages = [
  { check: (d: number) => d > 3, msg: "Evolução incrível! Subiu {d} posições 🚀" },
  { check: (d: number) => d > 0, msg: "Subiu {d} posição(ões) — continue assim! 💪" },
  { check: (d: number) => d === 0, msg: "Mantendo posição — consistência é chave! 🎯" },
  { check: () => true, msg: "Cada sessão te aproxima do topo! 📚" },
];

const MiniLeaderboard = () => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<RankInsight[]>([]);
  const [bestCategory, setBestCategory] = useState<RankInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data: snapshot } = await supabase
        .from("ranking_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .eq("snapshot_date", today)
        .maybeSingle();

      if (!snapshot) {
        // Fallback to old XP ranking
        setLoading(false);
        return;
      }

      const cats: RankInsight[] = [
        { category: "consistency", rank: snapshot.consistency_rank || 0, delta: snapshot.consistency_rank_delta || 0, percentile: snapshot.percentile || 50, score: Number(snapshot.consistency_score) || 0 },
        { category: "evolution", rank: snapshot.evolution_rank || 0, delta: snapshot.evolution_rank_delta || 0, percentile: snapshot.percentile || 50, score: Number(snapshot.evolution_score) || 0 },
        { category: "performance", rank: snapshot.performance_rank || 0, delta: snapshot.performance_rank_delta || 0, percentile: snapshot.percentile || 50, score: Number(snapshot.performance_score) || 0 },
        { category: "practical", rank: snapshot.practical_rank || 0, delta: snapshot.practical_rank_delta || 0, percentile: snapshot.percentile || 50, score: Number(snapshot.practical_score) || 0 },
      ];

      setInsights(cats);

      // Best category = lowest rank number (highest position)
      const best = [...cats].filter(c => c.rank > 0).sort((a, b) => a.rank - b.rank)[0] || cats[0];
      setBestCategory(best);

      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="glass-card p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  // If no snapshot data, show fallback encouragement
  if (!bestCategory || insights.length === 0) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Ranking
          </h2>
          <Link to="/dashboard/conquistas" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Ver ranking <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🏆</div>
          <p className="text-sm text-muted-foreground">
            Continue estudando para aparecer no ranking!
          </p>
        </div>
      </div>
    );
  }

  const getDeltaMessage = (delta: number) => {
    const m = motivationalMessages.find((m) => m.check(delta));
    return m ? m.msg.replace("{d}", String(Math.abs(delta))) : "";
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Seu Ranking
        </h2>
        <Link to="/dashboard/rankings" className="text-xs text-primary hover:underline flex items-center gap-0.5">
          Ver completo <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Best position highlight */}
      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">
          {categoryLabels[bestCategory.category]?.emoji} Melhor posição
        </p>
        <p className="text-2xl font-bold text-primary">#{bestCategory.rank}</p>
        <p className="text-xs font-medium">{categoryLabels[bestCategory.category]?.label}</p>
        {bestCategory.delta !== 0 && (
          <p className={`text-xs mt-1 flex items-center justify-center gap-1 ${bestCategory.delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
            {bestCategory.delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {bestCategory.delta > 0 ? "+" : ""}{bestCategory.delta} vs. ontem
          </p>
        )}
      </div>

      {/* Category summary */}
      <div className="grid grid-cols-2 gap-2">
        {insights.filter(i => i.rank > 0).slice(0, 4).map((ins) => {
          const cat = categoryLabels[ins.category];
          return (
            <div key={ins.category} className="bg-secondary/30 rounded-lg p-2.5 text-center">
              <p className="text-xs text-muted-foreground">{cat?.emoji} {cat?.label}</p>
              <p className="text-sm font-bold">#{ins.rank}</p>
              {ins.delta !== 0 && (
                <p className={`text-[10px] ${ins.delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {ins.delta > 0 ? "↑" : "↓"}{Math.abs(ins.delta)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Motivational message */}
      <p className="text-xs text-center text-muted-foreground mt-3 italic">
        {getDeltaMessage(bestCategory.delta)}
      </p>
    </div>
  );
};

export default MiniLeaderboard;
