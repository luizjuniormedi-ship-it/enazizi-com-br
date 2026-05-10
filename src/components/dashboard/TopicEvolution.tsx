import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, CheckCircle2, BookOpen, Loader2, GraduationCap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { ALL_SPECIALTIES as SPECIALTIES } from "@/constants/specialties";
import CycleFilter, { getFilteredSpecialties } from "@/components/CycleFilter";

interface DomainEntry {
  specialty: string;
  domain_score: number;
  questions_answered: number;
  errors_count: number;
}

const TopicEvolution = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["topic-evolution", user?.id],
    enabled: !!user,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const [domainRes, errorRes] = await Promise.all([
        supabase.from("medical_domain_map").select("specialty, domain_score, questions_answered, errors_count").eq("user_id", user!.id),
        supabase.from("error_bank").select("tema, vezes_errado").eq("user_id", user!.id),
      ]);
      const domains = (domainRes.data || []) as DomainEntry[];
      const topics: Record<string, number> = {};
      for (const e of errorRes.data || []) {
        topics[e.tema] = (topics[e.tema] || 0) + (e.vezes_errado || 1);
      }
      return { domains, errorTopics: topics };
    },
  });

  const handleStudyTopic = (specialty: string) => {
    navigate("/dashboard/mentor", {
      state: {
        initialMessage: `Quero estudar o tópico "${specialty}". Me dê uma aula completa seguindo o protocolo ENAZIZI.`,
        fromErrorBank: true,
      },
    });
  };

  if (isLoading || !data) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { domains, errorTopics } = data;
  const domainMap = new Map(domains.map((d) => [d.specialty, d]));
  const filteredSpecialties = getFilteredSpecialties(cycleFilter);

  const studied = filteredSpecialties.filter((s) => {
    const d = domainMap.get(s);
    return d && d.questions_answered > 0;
  });
  const notStudied = filteredSpecialties.filter((s) => {
    const d = domainMap.get(s);
    return !d || d.questions_answered === 0;
  });
  const weak = filteredSpecialties.filter((s) => {
    const d = domainMap.get(s);
    return d && d.domain_score < 50 && d.questions_answered > 0;
  });

  const overallScore = domains.length > 0
    ? Math.round(domains.reduce((sum, d) => sum + d.domain_score, 0) / SPECIALTIES.length)
    : 0;

  const topErrors = Object.entries(errorTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const getColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 70) return "default";
    if (score >= 40) return "secondary";
    return "destructive";
  };

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Evolução por especialidade
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Domínio geral:</span>
          <span className={`text-xl font-bold ${getColor(overallScore)}`}>{overallScore}%</span>
        </div>
      </div>

      <CycleFilter activeCycle={cycleFilter} onCycleChange={setCycleFilter} />

      {studied.length > 0 && (
        <div className="space-y-3">
          {filteredSpecialties.filter((s) => domainMap.get(s)?.questions_answered).map((s) => {
            const d = domainMap.get(s)!;
            return (
              <div key={s}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="truncate mr-2">{s}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {d.errors_count > 0 && (
                      <span className="text-xs text-destructive">{d.errors_count} erros</span>
                    )}
                    <Badge variant={getBadgeVariant(d.domain_score)} className="text-xs">
                      {Math.round(d.domain_score)}%
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => handleStudyTopic(s)}>
                      <GraduationCap className="h-3.5 w-3.5" />
                      Estudar
                    </Button>
                  </div>
                </div>
                <Progress value={d.domain_score} className="h-2" />
              </div>
            );
          })}
        </div>
      )}

      {notStudied.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Tópicos ainda não estudados ({notStudied.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {notStudied.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="text-xs font-normal cursor-pointer hover:bg-primary/10 transition-colors gap-1"
                onClick={() => handleStudyTopic(s)}
              >
                <GraduationCap className="h-3 w-3" />
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {topErrors.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-destructive" />
            Temas com mais erros
          </h3>
          <div className="space-y-1.5">
            {topErrors.map(([tema, count]) => (
              <div key={tema} className="flex items-center justify-between text-sm p-2 rounded-lg bg-destructive/5">
                <span className="truncate mr-2">{tema}</span>
                <Badge variant="destructive" className="text-xs">{count}x</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {studied.length} estudadas
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            {notStudied.length} pendentes
          </span>
          {weak.length > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              {weak.length} fracas
            </span>
          )}
        </div>
        <Link to="/dashboard/mapa-dominio">
          <Button variant="ghost" size="sm" className="text-xs h-7">
            Ver mapa completo
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default TopicEvolution;
