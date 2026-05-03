import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, Clock, User, Filter, ArrowUpRight } from "lucide-react";
import { EnaflixCinematicCard } from "@/components/enaflix/EnaflixCinematicCard";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { EnaflixLoader } from "@/components/enaflix/EnaflixLoader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AdminLessonRatingsPanel() {
  const { data: ratings, isLoading } = useQuery({
    queryKey: ["admin-lesson-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_ratings")
        .select(`
          *,
          ai_video_lessons (title, subject),
          profiles:user_id (display_name, email)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-lesson-rating-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_rating_stats")
        .select(`
          *,
          ai_video_lessons (title)
        `)
        .order("avg_rating", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <EnaflixLoader variant="default" label="Carregando avaliações..." />;

  const avgTotal = ratings?.length 
    ? (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <EnaflixSectionTitle 
          kicker="ANALYTICS DE SATISFAÇÃO" 
          title="Avaliações de Videoaulas" 
        />
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
              <p className="text-[10px] font-black text-white/40 uppercase">Total Feedbacks</p>
              <p className="text-xl font-black">{ratings?.length || 0}</p>
            </div>
          </EnaflixCinematicCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Últimas Avaliações</h3>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {ratings?.map((r) => (
                <EnaflixCinematicCard key={r.id} className="p-6 space-y-4 group">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white group-hover:text-primary transition-colors">
                        {(r.ai_video_lessons as any)?.title || "Aula Removida"}
                      </h4>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">
                        {(r.ai_video_lessons as any)?.subject || "Geral"}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          className={cn(
                            "h-4 w-4",
                            s <= r.rating ? "text-primary fill-primary" : "text-white/10"
                          )} 
                        />
                      ))}
                    </div>
                  </div>

                  {r.feedback && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 italic text-sm text-white/70">
                      "{r.feedback}"
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-medium text-white/30">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {(r.profiles as any)?.display_name || (r.profiles as any)?.email || "Aluno"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <Badge variant="outline" className="text-[8px] border-white/10">
                      Assitiu {r.watched_percentage}%
                    </Badge>
                  </div>
                </EnaflixCinematicCard>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Top Aulas</h3>
          <div className="space-y-3">
            {stats?.slice(0, 5).map((s, idx) => (
              <EnaflixCinematicCard key={s.lesson_id} className="p-4 flex items-center gap-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {(s.ai_video_lessons as any)?.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      <Star className="h-3 w-3 text-primary fill-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60">
                      {s.avg_rating.toFixed(1)}
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
      </div>
    </div>
  );
}
