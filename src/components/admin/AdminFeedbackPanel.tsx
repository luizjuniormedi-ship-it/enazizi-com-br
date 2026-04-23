import { useState, useEffect } from "react";
import { Star, MessageSquareText, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CinematicEmptyState } from "@/components/cinematic";

interface FeedbackRow {
  id: string;
  user_id: string;
  ratings: Record<string, number>;
  feedback_text: string;
  created_at: string;
  profile?: { display_name: string | null; email: string | null };
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  flashcards: "Flashcards",
  questoes: "Questões",
  banco_questoes: "Banco de Questões",
  simulados: "Simulados",
  cronograma: "Cronograma",
  tutor: "Tutor IA",
  agentes_ia: "Agentes IA",
  cronicas: "Crônicas",
  simulacao_clinica: "Simulação Clínica",
  simulacao: "Simulação Clínica",
  anamnese: "Anamnese",
  caderno_erros: "Caderno de Erros",
  geral: "Geral",
};

const StarRating = ({ value }: { value: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

const AdminFeedbackPanel = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (data && data.length > 0) {
        // Fetch profiles for all user_ids
        const userIds = [...new Set(data.map((d: any) => d.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.user_id, p])
        );

        const mapped = data.map((d: any) => ({
          ...d,
          ratings: (d.ratings || {}) as Record<string, number>,
          profile: profileMap.get(d.user_id) || null,
        }));
        setFeedbacks(mapped);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Compute stats
  const moduleAverages: Record<string, { sum: number; count: number }> = {};
  feedbacks.forEach((f) => {
    Object.entries(f.ratings).forEach(([key, val]) => {
      if (!moduleAverages[key]) moduleAverages[key] = { sum: 0, count: 0 };
      moduleAverages[key].sum += val;
      moduleAverages[key].count += 1;
    });
  });

  const overallRatings = feedbacks.flatMap((f) => Object.values(f.ratings));
  const overallAvg = overallRatings.length > 0
    ? (overallRatings.reduce((a, b) => a + b, 0) / overallRatings.length).toFixed(1)
    : "—";

  const promoters = feedbacks.filter((f) => {
    const vals = Object.values(f.ratings);
    return vals.length > 0 && vals.reduce((a, b) => a + b, 0) / vals.length >= 4;
  }).length;
  const detractors = feedbacks.filter((f) => {
    const vals = Object.values(f.ratings);
    return vals.length > 0 && vals.reduce((a, b) => a + b, 0) / vals.length <= 2;
  }).length;
  const nps = feedbacks.length > 0
    ? Math.round(((promoters - detractors) / feedbacks.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Total de Feedbacks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{feedbacks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" /> Média Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overallAvg} <span className="text-base text-muted-foreground">/ 5</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> NPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${nps >= 50 ? "text-emerald-500" : nps >= 0 ? "text-amber-500" : "text-destructive"}`}>
              {nps}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module averages */}
      {Object.keys(moduleAverages).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Média por Módulo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(moduleAverages)
                .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)
                .map(([key, { sum, count }]) => (
                  <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-xs font-medium">{MODULE_LABELS[key] || key}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(sum / count).toFixed(1)} ⭐
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">({count})</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" /> Avaliações Recentes
        </h3>
        {feedbacks.length === 0 ? (
          <CinematicEmptyState
            module="admin"
            title="Nenhum feedback recebido ainda"
            description="Quando os usuários enviarem avaliações, elas aparecerão aqui."
          />
        ) : (
          feedbacks.map((f) => (
            <Card key={f.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium">{f.profile?.display_name || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{f.profile?.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(f.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                  {Object.entries(f.ratings).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">{MODULE_LABELS[key] || key}:</span>
                      <StarRating value={val} />
                    </div>
                  ))}
                </div>

                {f.feedback_text && (
                  <p className="text-sm bg-muted/50 rounded-lg p-3 border border-border/50 italic">
                    "{f.feedback_text}"
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminFeedbackPanel;
