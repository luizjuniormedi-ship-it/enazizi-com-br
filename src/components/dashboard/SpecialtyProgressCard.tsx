import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { BarChart3, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SpecialtyData {
  specialty: string;
  domain_score: number;
  questions_answered: number;
  correct_answers: number;
}

const SPECIALTY_COLORS: Record<string, string> = {
  "Clínica Médica": "bg-blue-500",
  "Cirurgia": "bg-red-500",
  "Pediatria": "bg-emerald-500",
  "Ginecologia e Obstetrícia": "bg-pink-500",
  "Medicina Preventiva": "bg-amber-500",
  "Cardiologia": "bg-rose-500",
  "Neurologia": "bg-purple-500",
  "Pneumologia": "bg-sky-500",
  "Ortopedia": "bg-orange-500",
  "Psiquiatria": "bg-violet-500",
  "Infectologia": "bg-lime-500",
  "Nefrologia": "bg-cyan-500",
  "Gastroenterologia": "bg-yellow-500",
  "Endocrinologia": "bg-teal-500",
  "Hematologia": "bg-fuchsia-500",
  "Oncologia": "bg-red-600",
  "Dermatologia": "bg-amber-400",
  "Reumatologia": "bg-indigo-500",
  "Urologia": "bg-blue-600",
  "Otorrinolaringologia": "bg-green-600",
  "Angiologia": "bg-rose-600",
  "Oftalmologia": "bg-sky-600",
  "Terapia Intensiva": "bg-slate-600",
  "Medicina de Emergência": "bg-orange-600",
};

const getBarColor = (score: number) => {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
};

const getLabel = (score: number) => {
  if (score >= 80) return { text: "Dominado", class: "text-emerald-500" };
  if (score >= 60) return { text: "Bom", class: "text-primary" };
  if (score >= 40) return { text: "Regular", class: "text-amber-500" };
  return { text: "Fraco", class: "text-red-500" };
};

const SpecialtyProgressCard = () => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["specialty-progress", user?.id],
    enabled: !!user,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_domain_map")
        .select("specialty, domain_score, questions_answered, correct_answers")
        .eq("user_id", user!.id)
        .order("domain_score", { ascending: false });

      if (error) throw error;
      return (data || []) as SpecialtyData[];
    },
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6 space-y-5 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-8 bg-muted rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar seu mapa de domínio.</p>
      </div>
    );
  }

  const hasData = data && data.some(d => d.questions_answered > 0);

  if (!hasData) {
    return (
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Mapa Clínico de Domínio
        </h2>
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Aguardando seu primeiro estudo</p>
            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
              Seu mapa clínico será gerado automaticamente conforme você responde questões.
            </p>
          </div>
          <Link to="/tutor">
            <Button size="sm">Começar a estudar</Button>
          </Link>
        </div>
      </div>
    );
  }

  const avgScore = Math.round(data.reduce((sum, d) => sum + d.domain_score, 0) / data.length);
  const totalQuestions = data.reduce((sum, d) => sum + d.questions_answered, 0);
  const strongCount = data.filter(d => d.domain_score >= 70).length;
  const weakCount = data.filter(d => d.domain_score < 40).length;

  return (
    <div className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Domínio por Especialidade
        </h2>
        <Link
          to="/dashboard/mapa-dominio"
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          Ver mapa completo <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
          Média: {avgScore}%
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium">
          {totalQuestions} questões
        </span>
        {strongCount > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            ✅ {strongCount} fortes
          </span>
        )}
        {weakCount > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
            ⚠️ {weakCount} para reforçar
          </span>
        )}
      </div>

      {/* Progress bars */}
      <div className="space-y-3">
        {data.slice(0, 8).map((item) => {
          const label = getLabel(item.domain_score);
          const accuracy = item.questions_answered > 0
            ? Math.round((item.correct_answers / item.questions_answered) * 100)
            : 0;

          return (
            <div key={item.specialty} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full flex-shrink-0",
                    SPECIALTY_COLORS[item.specialty] || "bg-primary"
                  )} />
                  <span className="text-sm font-medium truncate">{item.specialty}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn("text-xs font-semibold", label.class)}>
                    {Math.round(item.domain_score)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    ({item.questions_answered}q • {accuracy}% acerto)
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    getBarColor(item.domain_score)
                  )}
                  style={{ width: `${Math.min(item.domain_score, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {data.length > 8 && (
        <Link
          to="/dashboard/mapa-dominio"
          className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          + {data.length - 8} especialidades • Ver todas →
        </Link>
      )}
    </div>
  );
};

export default SpecialtyProgressCard;
