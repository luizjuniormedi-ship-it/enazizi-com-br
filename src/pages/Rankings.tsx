import { useState, useEffect } from "react";
import { Trophy, Flame, TrendingUp, Activity, ArrowUp, ArrowDown, Minus, Crown, Medal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CinematicHero } from "@/components/cinematic";

interface RankingEntry {
  user_id: string;
  display_name: string;
  score: number;
  rank: number;
  rank_delta: number;
}

type RankingCategory = "consistency" | "evolution" | "performance" | "practical";

const categoryConfig: Record<RankingCategory, { label: string; icon: React.ElementType; color: string; description: string }> = {
  consistency: { label: "Consistência cognitiva", icon: Flame, color: "text-orange-500", description: "Disciplina sustentada em revisões e missões diárias" },
  evolution: { label: "Maior evolução", icon: TrendingUp, color: "text-emerald-500", description: "Progresso real de score nos últimos dias" },
  performance: { label: "Domínio sustentado", icon: Trophy, color: "text-amber-500", description: "Acurácia consistente e score de aprovação alto" },
  practical: { label: "Recuperação exemplar", icon: Activity, color: "text-blue-500", description: "Performance em Plantão, Anamnese e prática clínica" },
};

const medals = ["🥇", "🥈", "🥉"];

const motivationalMessages = [
  { condition: (delta: number) => delta > 3, message: "Evolução incrível! Você subiu {delta} posições" },
  { condition: (delta: number) => delta > 0, message: "Você subiu {delta} posição(ões) — continue assim!" },
  { condition: (delta: number) => delta === 0, message: "Mantendo sua posição — consistência é chave!" },
  { condition: (delta: number) => delta < 0, message: "Que tal retomar o ritmo? Cada sessão conta!" },
];

const Rankings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RankingCategory>("consistency");
  const [rankings, setRankings] = useState<Record<RankingCategory, RankingEntry[]>>({
    consistency: [], evolution: [], performance: [], practical: [],
  });
  const [userSnapshot, setUserSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Public leaderboard via secure RPC (no sensitive fields exposed)
      const { data: snapshots } = await supabase.rpc("get_ranking_leaderboard", { _limit: 100 });

      if (!snapshots || snapshots.length === 0) {
        setLoading(false);
        return;
      }

      const buildRanking = (scoreKey: string, rankKey: string, deltaKey?: string): RankingEntry[] => {
        return [...snapshots]
          .filter((s: any) => (s as any)[rankKey] != null)
          .sort((a: any, b: any) => (a as any)[rankKey] - (b as any)[rankKey])
          .map((s: any) => ({
            user_id: s.user_id,
            display_name: s.display_name || "Anônimo",
            score: Math.round((s as any)[scoreKey] ?? 0),
            rank: (s as any)[rankKey],
            rank_delta: deltaKey ? ((s as any)[deltaKey] || 0) : 0,
          }));
      };

      setRankings({
        consistency: buildRanking("consistency_score", "consistency_rank", "consistency_rank_delta"),
        evolution: buildRanking("evolution_score", "evolution_rank", "evolution_rank_delta"),
        performance: buildRanking("performance_score", "performance_rank", "performance_rank_delta"),
        practical: buildRanking("practical_score", "practical_rank", "practical_rank_delta"),
      });

      const mySnap = snapshots.find((s: any) => s.user_id === user?.id);
      if (mySnap) setUserSnapshot(mySnap);

      setLoading(false);
    };
    load();
  }, [user]);

  const getMotivationalMessage = (delta: number) => {
    const msg = motivationalMessages.find((m) => m.condition(delta));
    return msg ? msg.message.replace("{delta}", String(Math.abs(delta))) : "";
  };

  const DeltaBadge = ({ delta }: { delta: number }) => {
    if (delta > 0) return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs gap-1"><ArrowUp className="h-3 w-3" />+{delta}</Badge>;
    if (delta < 0) return <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 text-xs gap-1"><ArrowDown className="h-3 w-3" />{delta}</Badge>;
    return <Badge variant="outline" className="text-muted-foreground text-xs gap-1"><Minus className="h-3 w-3" />—</Badge>;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  const currentRanking = rankings[activeTab];
  const config = categoryConfig[activeTab];
  const Icon = config.icon;

  // Find user in current ranking
  const userEntry = currentRanking.find((r) => r.user_id === user?.id);
  const userIdx = currentRanking.findIndex((r) => r.user_id === user?.id);

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto animate-fade-in">
      <CinematicHero
        module="ranking"
        eyebrow={
          <>
            <Crown className="h-3.5 w-3.5" />
            Liga ENAZIZI
          </>
        }
        title="Rankings"
        subtitle="Sua trajetória ao lado dos melhores — constância, evolução, desempenho e prática clínica."
      />

      {/* Personal Progress Card */}
      {userEntry && (
        <div className="glass-card p-5 space-y-3 border-primary/20">
          <h3 className="text-sm font-semibold text-muted-foreground">Seu resumo</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">#{userEntry.rank}</p>
              <p className="text-xs text-muted-foreground">{config.label}</p>
            </div>
            <div className="text-center">
              <DeltaBadge delta={userEntry.rank_delta} />
              <p className="text-xs text-muted-foreground mt-1">vs. ontem</p>
            </div>
          </div>
          {userSnapshot && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Você está entre os <span className="font-bold text-primary">top {Math.max(1, 100 - (userSnapshot.percentile || 50))}%</span>
              </p>
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground italic">
            {getMotivationalMessage(userEntry.rank_delta)}
          </p>
        </div>
      )}

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RankingCategory)}>
        <TabsList className="grid grid-cols-4 w-full">
          {(Object.keys(categoryConfig) as RankingCategory[]).map((key) => {
            const cfg = categoryConfig[key];
            const CIcon = cfg.icon;
            return (
              <TabsTrigger key={key} value={key} className="text-xs gap-1">
                <CIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className="hidden sm:inline">{cfg.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(categoryConfig) as RankingCategory[]).map((key) => (
          <TabsContent key={key} value={key} className="space-y-2 mt-4">
            <p className="text-xs text-muted-foreground mb-3">{categoryConfig[key].description}</p>

            {currentRanking.length === 0 ? (
              <div className="text-center py-10">
                <Medal className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Sem dado suficiente para esta categoria ainda
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Os rankings são recalculados diariamente — continue praticando para entrar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Show top 10 + nearby users */}
                {(() => {
                  const ranking = rankings[key];
                  const top10 = ranking.slice(0, 10);
                  const myIdx = ranking.findIndex((r) => r.user_id === user?.id);
                  const nearby: RankingEntry[] = [];

                  // If user is outside top 10, show nearby
                  if (myIdx > 9) {
                    const start = Math.max(myIdx - 1, 10);
                    const end = Math.min(myIdx + 2, ranking.length);
                    nearby.push(...ranking.slice(start, end));
                  }

                  return (
                    <>
                      {top10.map((r, i) => (
                        <RankRow key={r.user_id} entry={r} index={i} isMe={r.user_id === user?.id} />
                      ))}
                      {nearby.length > 0 && (
                        <>
                          <div className="text-center text-xs text-muted-foreground py-2">• • •</div>
                          {nearby.map((r) => (
                            <RankRow key={r.user_id} entry={r} index={r.rank - 1} isMe={r.user_id === user?.id} />
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

const RankRow = ({ entry, index, isMe }: { entry: RankingEntry; index: number; isMe: boolean }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
    isMe ? "bg-primary/10 border border-primary/20 shadow-sm" : "bg-secondary/30"
  }`}>
    <span className="text-lg w-8 text-center font-bold shrink-0">
      {index < 3 ? medals[index] : entry.rank}
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">
        {isMe ? "Você" : entry.display_name}
      </p>
      <p className="text-[10px] text-muted-foreground">
        Score: {entry.score}
      </p>
    </div>
    <div className="shrink-0">
      {entry.rank_delta > 0 && (
        <span className="text-xs text-emerald-600 flex items-center gap-0.5">
          <ArrowUp className="h-3 w-3" />+{entry.rank_delta}
        </span>
      )}
      {entry.rank_delta < 0 && (
        <span className="text-xs text-destructive flex items-center gap-0.5">
          <ArrowDown className="h-3 w-3" />{entry.rank_delta}
        </span>
      )}
      {entry.rank_delta === 0 && (
        <span className="text-xs text-muted-foreground"><Minus className="h-3 w-3" /></span>
      )}
    </div>
  </div>
);

export default Rankings;
