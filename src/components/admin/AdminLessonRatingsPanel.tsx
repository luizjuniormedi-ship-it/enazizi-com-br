import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, Clock, User, AlertTriangle, TrendingUp, Inbox } from "lucide-react";
import { EnaflixCinematicCard } from "@/components/enaflix/EnaflixCinematicCard";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { EnaflixLoader } from "@/components/enaflix/EnaflixLoader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * AdminLessonRatingsPanel — REAL DATA ONLY POLICY
 *
 * Renderiza apenas widgets com dado real coletado.
 * Sem placeholders fake, sem heatmap fictício, sem retenção inventada.
 * Ver docs/REAL_ANALYTICS_ONLY_POLICY.md
 *
 * Schema real disponível (lesson_ratings):
 *   rating (1-5), feedback, watched_percentage, created_at
 *
 * NÃO existe coleta para: heatmap, retenção temporal x nota,
 * abandono x nota, replay moments x nota → blocos NÃO renderizados.
 */

const MIN_RATINGS_FOR_WATCH_CORRELATION = 10;

type RatingRow = {
  id: string;
  lesson_id: string;
  user_id: string;
  rating: number;
  feedback: string | null;
  watched_percentage: number | null;
  created_at: string;
  tutor_lesson_memory: { title: string | null; subject: string | null } | null;
  profiles: { display_name: string | null; email: string | null } | null;
};

export function AdminLessonRatingsPanel() {
  const { data: ratings, isLoading } = useQuery<RatingRow[]>({
    queryKey: ["admin-lesson-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_ratings")
        .select(`
          id, lesson_id, user_id, rating, feedback, watched_percentage, created_at,
          tutor_lesson_memory:lesson_id (title, subject),
          profiles:user_id (display_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as RatingRow[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-lesson-rating-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_rating_stats").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <EnaflixLoader variant="default" label="Carregando avaliações..." />;

  const total = ratings?.length ?? 0;

  // ─────────────────────────────────────────────────────────────
  // Empty state honesto: nada coletado → uma tela única, sem widgets fake
  // ─────────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="space-y-8">
        <EnaflixSectionTitle kicker="ANALYTICS DE SATISFAÇÃO" title="Avaliações de Videoaulas" />
        <EnaflixCinematicCard className="p-12 flex flex-col items-center justify-center text-center gap-4">
          <Inbox className="h-12 w-12 text-white/20" />
          <div>
            <h3 className="text-lg font-black text-white">Sem avaliações coletadas ainda</h3>
            <p className="text-sm text-white/40 max-w-md mt-2">
              O painel só exibe métricas com dado real. Assim que os primeiros alunos avaliarem
              uma aula, os widgets aparecem automaticamente.
            </p>
          </div>
        </EnaflixCinematicCard>
      </div>
    );
  }

  const avgTotal = (ratings!.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1);

  // Distribuição 1-5⭐
  const distribution = [1, 2, 3, 4, 5].map((star) => {
    const count = ratings!.filter((r) => r.rating === star).length;
    return { star, count, pct: (count / total) * 100 };
  });

  // Comentários reais (feedback != null/empty)
  const comments = ratings!.filter((r) => r.feedback && r.feedback.trim().length > 0);

  // Top / críticas via view (tem average_rating real)
  const sortedStats = [...(stats ?? [])].sort(
    (a: any, b: any) => Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0),
  );
  const topLessons = sortedStats.slice(0, 5);
  const criticalLessons = [...(stats ?? [])]
    .filter((s: any) => Number(s.average_rating ?? 0) < 3 && Number(s.total_ratings ?? 0) >= 2)
    .sort((a: any, b: any) => Number(a.average_rating) - Number(b.average_rating))
    .slice(0, 5);

  // Watch% x nota — só com volume mínimo
  const ratingsWithWatch = ratings!.filter(
    (r) => r.watched_percentage !== null && r.watched_percentage !== undefined,
  );
  const showWatchCorrelation = ratingsWithWatch.length >= MIN_RATINGS_FOR_WATCH_CORRELATION;
  const watchByRating = showWatchCorrelation
    ? [1, 2, 3, 4, 5].map((star) => {
        const subset = ratingsWithWatch.filter((r) => r.rating === star);
        const avg =
          subset.length > 0
            ? subset.reduce((a, r) => a + Number(r.watched_percentage), 0) / subset.length
            : null;
        return { star, avg, n: subset.length };
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <EnaflixSectionTitle kicker="ANALYTICS DE SATISFAÇÃO" title="Avaliações de Videoaulas" />
        <div className="flex gap-4">
          <EnaflixCinematicCard className="px-6 py-3 flex items-center gap-3">
            <Star className="h-5 w-5 text-primary fill-primary" />
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase">Média Geral</p>
              <p className="text-xl font-black">{avgTotal}</p>
            </div>
          </EnaflixCinematicCard>
          <EnaflixCinematicCard className="px-6 py-3 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase">Total Avaliações</p>
              <p className="text-xl font-black">{total}</p>
            </div>
          </EnaflixCinematicCard>
        </div>
      </div>

      {/* Distribuição 1-5⭐ — sempre real */}
      <EnaflixCinematicCard className="p-6 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Distribuição de Notas
        </h3>
        <div className="space-y-2">
          {distribution
            .slice()
            .reverse()
            .map((d) => (
              <div key={d.star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12">
                  <span className="text-xs font-bold text-white/70">{d.star}</span>
                  <Star className="h-3 w-3 text-primary fill-primary" />
                </div>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <div className="w-20 text-right text-[10px] font-bold text-white/50 tabular-nums">
                  {d.count} ({d.pct.toFixed(0)}%)
                </div>
              </div>
            ))}
        </div>
      </EnaflixCinematicCard>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        {/* Comentários recentes — só se houver feedback real */}
        <div className="space-y-6">
          {comments.length > 0 ? (
            <>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">
                Comentários Recentes ({comments.length})
              </h3>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {comments.map((r) => (
                    <EnaflixCinematicCard key={r.id} className="p-6 space-y-4 group">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h4 className="font-bold text-white group-hover:text-primary transition-colors">
                            {r.tutor_lesson_memory?.title || `Aula #${r.lesson_id.substring(0, 8)}`}
                          </h4>
                          {r.tutor_lesson_memory?.subject && (
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">
                              {r.tutor_lesson_memory.subject}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                "h-4 w-4",
                                s <= r.rating ? "text-primary fill-primary" : "text-white/10",
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4 italic text-sm text-white/70">
                        "{r.feedback}"
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-medium text-white/30 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {r.profiles?.display_name || r.profiles?.email || "Aluno"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString()}
                        </div>
                        {r.watched_percentage !== null && (
                          <Badge variant="outline" className="text-[8px] border-white/10">
                            Assistiu {Number(r.watched_percentage).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </EnaflixCinematicCard>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <EnaflixCinematicCard className="p-8 flex items-center justify-center text-center">
              <p className="text-sm text-white/40">
                Avaliações coletadas, mas nenhum comentário textual ainda.
              </p>
            </EnaflixCinematicCard>
          )}
        </div>

        <div className="space-y-8">
          {/* Top aulas */}
          {topLessons.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                <TrendingUp className="h-3 w-3" /> Top Aulas
              </h3>
              <div className="space-y-3">
                {topLessons.map((s: any, idx: number) => (
                  <EnaflixCinematicCard
                    key={s.lesson_id}
                    className="p-4 flex items-center gap-4"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        Aula #{s.lesson_id.substring(0, 8)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="h-3 w-3 text-primary fill-primary" />
                        <span className="text-[10px] font-bold text-white/60">
                          {Number(s.average_rating).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-white/20">
                          ({s.total_ratings} votos)
                        </span>
                      </div>
                    </div>
                  </EnaflixCinematicCard>
                ))}
              </div>
            </div>
          )}

          {/* Aulas críticas — só se houver alguma com média < 3 e n>=2 */}
          {criticalLessons.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-destructive/80 flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" /> Aulas Críticas
              </h3>
              <div className="space-y-3">
                {criticalLessons.map((s: any) => (
                  <EnaflixCinematicCard
                    key={s.lesson_id}
                    className="p-4 flex items-center gap-4 border-destructive/20"
                  >
                    <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        Aula #{s.lesson_id.substring(0, 8)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-destructive">
                          {Number(s.average_rating).toFixed(1)} ⭐
                        </span>
                        <span className="text-[10px] text-white/20">
                          ({s.total_ratings} votos)
                        </span>
                      </div>
                    </div>
                  </EnaflixCinematicCard>
                ))}
              </div>
            </div>
          )}

          {/* Watch% x nota — só com volume mínimo real */}
          {showWatchCorrelation && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">
                Watch % por Nota
              </h3>
              <EnaflixCinematicCard className="p-4 space-y-2">
                {watchByRating.map((w) => (
                  <div key={w.star} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-10">
                      <span className="text-xs font-bold text-white/70">{w.star}</span>
                      <Star className="h-3 w-3 text-primary fill-primary" />
                    </div>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      {w.avg !== null && (
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${Math.min(w.avg, 100)}%` }}
                        />
                      )}
                    </div>
                    <div className="w-16 text-right text-[10px] font-bold text-white/50 tabular-nums">
                      {w.avg !== null ? `${w.avg.toFixed(0)}%` : "—"}
                    </div>
                  </div>
                ))}
              </EnaflixCinematicCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
