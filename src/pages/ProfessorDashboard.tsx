import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { GraduationCap, Plus, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CinematicHero } from "@/components/cinematic";

import ClassAnalytics from "@/components/professor/ClassAnalytics";
import ProfessorPlantao from "@/components/professor/ProfessorPlantao";
import StudentTracker from "@/components/professor/StudentTracker";
import VideoRoom from "@/components/professor/VideoRoom";
import TeacherStudyAssignments from "@/components/professor/TeacherStudyAssignments";
import MentorThemePlans from "@/components/professor/MentorThemePlans";
import ProfessorPracticalExams from "@/components/professor/ProfessorPracticalExams";
import ProfessorProficiencyPlans from "@/components/professor/ProfessorProficiencyPlans";

import SimuladosKpiCards from "@/components/professor/SimuladosKpiCards";
import SimuladoListItem from "@/components/professor/SimuladoListItem";
import type { ResultsDialogState } from "@/components/professor/SimuladoResultsDialog";

// Code-split: dialogs e BI só carregam quando necessários
const ProfessorBIPanel = lazy(() => import("@/components/professor/ProfessorBIPanel"));
const CreateSimuladoDialog = lazy(() => import("@/components/professor/CreateSimuladoDialog"));
const SimuladoResultsDialog = lazy(() => import("@/components/professor/SimuladoResultsDialog"));

/**
 * ProfessorDashboard — orquestrador de layout.
 *
 * Estado mínimo:
 *   - lista de simulados (servidor)
 *   - flag de dialogs (open/close)
 *   - state do dialog de resultados
 *
 * Todo o estado pesado (form de criação, geração de IA, busca de alunos,
 * expansão de aluno na lista de resultados) vive dentro dos respectivos
 * dialogs lazy-loaded — eles só montam quando abertos e desmontam ao fechar,
 * isolando completamente o blast radius de re-render.
 */
const ProfessorDashboard = () => {
  const { session } = useAuth();
  const { toast } = useToast();

  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resultsDialog, setResultsDialog] = useState<ResultsDialogState>({
    open: false,
    simulado: null,
    results: [],
    loading: false,
    questions_json: [],
  });

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-simulado`;

  const callAPI = useCallback(
    async (body: Record<string, unknown>) => {
      const controller = new AbortController();
      const timeoutMs = body.action === "generate_questions" ? 180000 : 60000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro na operação");
        return data;
      } catch (e: any) {
        if (e.name === "AbortError") throw new Error("Tempo esgotado. Tente com menos questões.");
        throw e;
      } finally {
        clearTimeout(timer);
      }
    },
    [session, API_URL]
  );

  const loadSimulados = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callAPI({ action: "list_simulados" });
      setSimulados(res.simulados || []);
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [session, callAPI, toast]);

  useEffect(() => {
    loadSimulados();
  }, [loadSimulados]);

  const handleViewResults = useCallback(
    async (simulado: any) => {
      setResultsDialog({
        open: true,
        simulado,
        results: [],
        loading: true,
        questions_json: [],
      });
      try {
        const res = await callAPI({
          action: "get_simulado_results",
          simulado_id: simulado.id,
        });
        setResultsDialog((prev) => ({
          ...prev,
          results: res.results || [],
          questions_json: res.questions_json || [],
          loading: false,
        }));
      } catch {
        setResultsDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [callAPI]
  );

  const handleDeleteSimulado = useCallback(
    async (simuladoId: string, simuladoTitle: string) => {
      if (
        !confirm(
          `Tem certeza que deseja apagar o simulado "${simuladoTitle}"? Esta ação não pode ser desfeita.`
        )
      )
        return;
      try {
        await callAPI({ action: "delete_simulado", simulado_id: simuladoId });
        toast({
          title: "Simulado apagado",
          description: `"${simuladoTitle}" foi removido com sucesso.`,
        });
        loadSimulados();
      } catch (e) {
        toast({
          title: "Erro ao apagar",
          description: e instanceof Error ? e.message : "Erro",
          variant: "destructive",
        });
      }
    },
    [callAPI, toast, loadSimulados]
  );

  const handleCloseResults = useCallback(() => {
    setResultsDialog({
      open: false,
      simulado: null,
      results: [],
      loading: false,
      questions_json: [],
    });
  }, []);

  const handleOpenCreate = useCallback(() => setShowCreate(true), []);
  const handleCloseCreate = useCallback((open: boolean) => setShowCreate(open), []);

  // Totais memoizados — só recalculam quando a lista muda
  const totals = useMemo(() => {
    const totalStudentsAssigned = simulados.reduce(
      (s, sim) => s + (sim.results_summary?.total || 0),
      0
    );
    const totalCompleted = simulados.reduce(
      (s, sim) => s + (sim.results_summary?.completed || 0),
      0
    );
    return {
      totalSimulados: simulados.length,
      totalStudentsAssigned,
      totalCompleted,
    };
  }, [simulados]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <CinematicHero
        module="professor"
        eyebrow={
          <>
            <GraduationCap className="h-3.5 w-3.5" />
            Centro de mentoria
          </>
        }
        title="Painel do Professor"
        subtitle="Crie simulados, acompanhe alunos e oriente turmas com inteligência adaptativa."
        actions={
          <Button onClick={handleOpenCreate} size="lg" className="gap-2 shadow-elegant">
            <Plus className="h-4 w-4" /> Novo Simulado
          </Button>
        }
      />

      <Tabs defaultValue="simulados" className="w-full">
        <div className="rounded-2xl border border-border bg-card/40 p-2">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="simulados" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📝 Simulados</TabsTrigger>
            <TabsTrigger value="plantao" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">🏥 Casos Plantão</TabsTrigger>
            <TabsTrigger value="video" className="h-10 min-w-[48%] flex-1 justify-start gap-1 rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm"><Video className="h-3.5 w-3.5" /> Sala de Aula</TabsTrigger>
            <TabsTrigger value="temas" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📖 Temas</TabsTrigger>
            <TabsTrigger value="alunos" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">👤 Aluno</TabsTrigger>
            <TabsTrigger value="analytics" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📊 Turma</TabsTrigger>
            <TabsTrigger value="bi" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📈 BI</TabsTrigger>
            <TabsTrigger value="mentoria" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">📋 Mentoria</TabsTrigger>
            <TabsTrigger value="osce" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">🩺 OSCE</TabsTrigger>
            <TabsTrigger value="proficiencia" className="h-10 min-w-[48%] flex-1 justify-start rounded-xl border border-border/60 px-3 text-xs sm:min-w-fit sm:flex-none sm:text-sm">🎯 Proficiência</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="simulados" className="space-y-4 mt-4">
          <SimuladosKpiCards
            totalSimulados={totals.totalSimulados}
            totalStudentsAssigned={totals.totalStudentsAssigned}
            totalCompleted={totals.totalCompleted}
          />

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            </div>
          ) : simulados.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum simulado criado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie seu primeiro simulado e atribua aos alunos.
                </p>
                <Button onClick={handleOpenCreate}>Criar Simulado</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {simulados.map((sim) => (
                <SimuladoListItem
                  key={sim.id}
                  sim={sim}
                  onView={handleViewResults}
                  onDelete={handleDeleteSimulado}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plantao" className="mt-4">
          <ProfessorPlantao />
        </TabsContent>

        <TabsContent value="temas" className="mt-4">
          <TeacherStudyAssignments />
        </TabsContent>

        <TabsContent value="video" className="mt-4">
          <VideoRoom />
        </TabsContent>

        <TabsContent value="alunos" className="mt-4">
          <StudentTracker />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <ClassAnalytics />
        </TabsContent>

        <TabsContent value="bi" className="mt-4">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
            <ProfessorBIPanel callAPI={callAPI} />
          </Suspense>
        </TabsContent>

        <TabsContent value="mentoria" className="mt-4">
          <MentorThemePlans />
        </TabsContent>

        <TabsContent value="osce" className="mt-4">
          <ProfessorPracticalExams />
        </TabsContent>

        <TabsContent value="proficiencia" className="mt-4">
          <ProfessorProficiencyPlans />
        </TabsContent>
      </Tabs>

      {/* Lazy: dialogs só carregam código quando ativados */}
      {showCreate && (
        <Suspense fallback={null}>
          <CreateSimuladoDialog
            open={showCreate}
            onOpenChange={handleCloseCreate}
            callAPI={callAPI}
            onCreated={loadSimulados}
          />
        </Suspense>
      )}

      {resultsDialog.open && (
        <Suspense fallback={null}>
          <SimuladoResultsDialog state={resultsDialog} onClose={handleCloseResults} />
        </Suspense>
      )}
    </div>
  );
};

export default ProfessorDashboard;
