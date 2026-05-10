/**
 * ProfessionalLeaderboard (Fase 8)
 * Ranking adulto e pedagógico — não premia spam.
 * Categorias derivadas de class_analytics.students + cognitive_risks.
 */
import { useMemo } from "react";
import { DadosInsuficientesCard } from "@/components/common/DadosInsuficientesCard";
import { Award, TrendingUp, Brain, Shield, Sparkles } from "lucide-react";

interface Props {
  analytics: any;
  loading?: boolean;
}

interface RankItem {
  user_id: string;
  display_name: string;
  metric: number | string;
}

interface Category {
  key: string;
  title: string;
  icon: React.ElementType;
  unit?: string;
  items: RankItem[];
}

export default function ProfessionalLeaderboard({ analytics, loading }: Props) {
  const categories = useMemo<Category[]>(() => {
    const students = analytics?.students || [];
    const risks: any[] = analytics?.student_cognitive_risks || [];
    if (students.length === 0) return [];

    const byUser: Record<string, any> = {};
    for (const s of students) byUser[s.user_id] = s;
    for (const r of risks) byUser[r.user_id] = { ...byUser[r.user_id], ...r };

    const enriched = Object.values(byUser);

    const sortBy = <T,>(arr: T[], pick: (x: T) => number | null) =>
      arr
        .filter((x) => pick(x) !== null && pick(x) !== undefined)
        .sort((a, b) => (pick(b) as number) - (pick(a) as number))
        .slice(0, 5);

    const topRetention = sortBy(enriched, (e: any) =>
      typeof e.retention_score === "number" ? e.retention_score : null
    ).map((e: any) => ({
      user_id: e.user_id,
      display_name: e.display_name,
      metric: e.retention_score,
    }));

    const topConsistency = sortBy(enriched, (e: any) =>
      typeof e.streak === "number" ? e.streak : null
    ).map((e: any) => ({
      user_id: e.user_id,
      display_name: e.display_name,
      metric: e.streak,
    }));

    const topStability = sortBy(enriched, (e: any) =>
      typeof e.avg_stability === "number" ? e.avg_stability : null
    ).map((e: any) => ({
      user_id: e.user_id,
      display_name: e.display_name,
      metric: e.avg_stability,
    }));

    const topRecovery = enriched
      .filter((e: any) => e.risk_level === "low" && (e.avg_lapses ?? 99) < 1.5 && (e.retention_score ?? 0) >= 75)
      .slice(0, 5)
      .map((e: any) => ({
        user_id: e.user_id,
        display_name: e.display_name,
        metric: `${e.retention_score ?? 0}%`,
      }));

    const cats: Category[] = [];
    if (topRetention.length)
      cats.push({ key: "retention", title: "Melhor retenção", icon: Brain, unit: "%", items: topRetention });
    if (topStability.length)
      cats.push({ key: "stability", title: "Estabilidade FSRS", icon: Shield, items: topStability });
    if (topConsistency.length)
      cats.push({ key: "streak", title: "Consistência", icon: TrendingUp, unit: "d", items: topConsistency });
    if (topRecovery.length)
      cats.push({ key: "recovery", title: "Recuperação exemplar", icon: Sparkles, items: topRecovery });

    return cats;
  }, [analytics]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!categories.length) {
    return (
      <DadosInsuficientesCard
        title="Ranking profissional ainda em formação"
        description="Categorias premium aparecerão quando a turma tiver mais dados de retenção, estabilidade e consistência."
        icon={<Award className="h-4 w-4 text-primary/70" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-black text-white">Ranking profissional</h3>
        <p className="text-xs text-white/50 mt-0.5">
          Categorias pedagógicas — não premia volume bruto.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map((cat) => (
          <div key={cat.key} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <cat.icon className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-black text-white">{cat.title}</h4>
            </div>
            <ol className="space-y-1.5">
              {cat.items.map((it, idx) => (
                <li
                  key={it.user_id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-black grid place-items-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-white/85 truncate">{it.display_name}</span>
                  </div>
                  <span className="text-xs font-black text-primary shrink-0">
                    {it.metric}
                    {cat.unit || ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
