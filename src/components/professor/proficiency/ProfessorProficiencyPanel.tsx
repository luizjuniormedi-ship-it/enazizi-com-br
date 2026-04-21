import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

import ProfessorProficiencyOverview from "./ProfessorProficiencyOverview";
import ProficiencyHeatmap, { type HeatmapRow } from "./ProficiencyHeatmap";
import RiskRankingPanel, { type RiskRow } from "./RiskRankingPanel";
import StudentProficiencyDrawer from "./StudentProficiencyDrawer";

interface Props {
  callAPI: (body: Record<string, unknown>) => Promise<any>;
}

interface ClassOption {
  id: string;
  name: string;
  period: number | null;
  year: number | null;
}

/**
 * Painel container — orquestra os 4 blocos da aba Proficiência.
 * Toda a leitura cross-aluno passa pela edge function existente
 * `professor-simulado` (actions: get_proficiency_heatmap, get_risk_ranking,
 * get_student_proficiency_detail). Read-only. Não toca no Study Engine.
 */
const ProfessorProficiencyPanel = ({ callAPI }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState<string>("__all__");

  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [totals, setTotals] = useState({ students: 0, subtopics: 0, critical: 0, warning: 0, healthy: 0 });
  const [ranking, setRanking] = useState<RiskRow[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Carrega turmas onde o professor é membro (professor/owner/coordinator).
  // Lê direto do banco — RLS de class_members protege; se não houver, lista vazia.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: memberships } = await supabase
        .from("class_members")
        .select("class_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("role", ["professor", "owner", "coordinator"]);
      const ids = (memberships || []).map((m: any) => m.class_id);
      if (ids.length === 0) {
        if (!cancelled) setClasses([]);
        return;
      }
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, period, year")
        .in("id", ids)
        .eq("is_active", true)
        .order("name");
      if (!cancelled) setClasses((cls || []) as ClassOption[]);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const loadAll = useCallback(async () => {
    setLoadingHeatmap(true);
    setLoadingRanking(true);
    const body: Record<string, unknown> = {};
    if (classId !== "__all__") body.class_id = classId;
    try {
      const [hm, rk] = await Promise.all([
        callAPI({ action: "get_proficiency_heatmap", ...body }),
        callAPI({ action: "get_risk_ranking", ...body, limit: 100 }),
      ]);
      setHeatmap((hm.heatmap || []) as HeatmapRow[]);
      setTotals(hm.totals || { students: 0, subtopics: 0, critical: 0, warning: 0, healthy: 0 });
      setRanking((rk.ranking || []) as RiskRow[]);
    } catch (e) {
      toast({
        title: "Erro ao carregar proficiência",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setLoadingHeatmap(false);
      setLoadingRanking(false);
    }
  }, [classId, callAPI, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const avgAccuracy = useMemo(() => {
    const withData = heatmap.filter((h) => h.total_questions > 0);
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((s, h) => s + h.avg_accuracy, 0) / withData.length);
  }, [heatmap]);

  const studentsAtRisk = useMemo(
    () => ranking.filter((r) => r.faixa === "alto" || r.faixa === "critico").length,
    [ranking],
  );

  const handleOpenStudent = useCallback((studentId: string) => {
    setSelectedStudent(studentId);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Filtro de turma */}
      <Card className="border-border/60">
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Escopo</p>
            <p className="text-xs text-muted-foreground">
              {classes.length === 0
                ? "Você ainda não é membro de turmas. Mostrando alunos da sua faculdade."
                : "Selecione uma turma para focar a análise."}
            </p>
          </div>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Escolher turma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">
                {classes.length === 0 ? "Minha faculdade" : "Todos os meus alunos"}
              </SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.year ? ` · ${c.year}` : ""}{c.period ? `/${c.period}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Bloco 1 — KPIs */}
      <ProfessorProficiencyOverview
        totalStudents={totals.students}
        avgAccuracy={avgAccuracy}
        criticalSubtopics={totals.critical}
        warningSubtopics={totals.warning}
        healthySubtopics={totals.healthy}
        studentsAtRisk={studentsAtRisk}
        loading={loadingHeatmap || loadingRanking}
      />

      {/* Bloco 2 — Ranking de risco */}
      <RiskRankingPanel ranking={ranking} loading={loadingRanking} onOpenStudent={handleOpenStudent} />

      {/* Bloco 3 — Heatmap */}
      <ProficiencyHeatmap rows={heatmap} loading={loadingHeatmap} />

      {/* Bloco 4 — Drill-down */}
      <StudentProficiencyDrawer
        studentId={selectedStudent}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedStudent(null);
        }}
        callAPI={callAPI}
      />
    </div>
  );
};

export default ProfessorProficiencyPanel;
