import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { GraduationCap, Plus, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CinematicHero } from "@/components/cinematic";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";

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
import ProfessorTraceAudit from "@/components/professor/ProfessorTraceAudit";
import type { ResultsDialogState } from "@/components/professor/SimuladoResultsDialog";

const ProfessorBIPanel = lazyWithRetry(() => import("@/components/professor/ProfessorBIPanel"), "ProfessorBIPanel");
const CreateSimuladoDialog = lazyWithRetry(() => import("@/components/professor/CreateSimuladoDialog"), "CreateSimuladoDialog");
const SimuladoResultsDialog = lazyWithRetry(() => import("@/components/professor/SimuladoResultsDialog"), "SimuladoResultsDialog");

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

  const handleOpenCreate = useCallback(() => {
    console.log("[ProfessorDashboard] handleOpenCreate disparado");
    setShowCreate(true);
  }, []);
  const handleCloseCreate = useCallback((open: boolean) => {
    console.log("[ProfessorDashboard] handleCloseCreate:", open);
    setShowCreate(open);
  }, []);

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
    <div className="min-h-screen relative z-10 animate-fade-in">
      <EnaflixBackgroundFX intensity="medium" />
      
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
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
            <Button 
              onClick={handleOpenCreate} 
              size="lg" 
              className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-glow-sm gap-2"
            >
              <Plus className="h-4 w-4" /> NOVO SIMULADO
            </Button>
          }
        />

        <Tabs defaultValue="simulados" className="w-full">
          <div className="rounded-2xl border border-white/5 bg-card/20 backdrop-blur-md p-2">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
              {[
                { value: "simulados", label: "📝 Simulados" },
                { value: "plantao", label: "🏥 Casos Plantão" },
                { value: "video", label: "Video", icon: <Video className="h-3.5 w-3.5" /> },
                { value: "temas", label: "📖 Temas" },
                { value: "alunos", label: "👤 Aluno" },
                { value: "analytics", label: "📊 Turma" },
                { value: "bi", label: "📈 BI" },
                { value: "mentoria", label: "📋 Mentoria" },
                { value: "osce", label: "🩺 OSCE" },
                { value: "proficiencia", label: "🎯 Proficiência" },
                { value: "auditoria", label: "🔍 Auditoria" }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="h-10 min-w-[48%] flex-1 justify-center rounded-xl border border-white/5 px-4 text-[11px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-sm sm:min-w-fit sm:flex-none"
                >
                  {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
                  {tab.label.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="simulados" className="space-y-4 mt-4 w-full max-w-5xl mx-auto">
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
                  <Button 
                    onClick={handleOpenCreate}
                    className="h-11 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-glow-sm"
                  >
                    CRIAR SIMULADO
                  </Button>
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

          <TabsContent value="plantao" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <ProfessorPlantao callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="temas" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <TeacherStudyAssignments callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="video" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <VideoRoom callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="alunos" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <StudentTracker callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <ClassAnalytics callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="bi" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <ProfessorBIPanel callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="mentoria" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <MentorThemePlans callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="osce" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <ProfessorPracticalExams callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="proficiencia" className="mt-4 w-full max-w-5xl mx-auto">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted/30" />}>
              <ProfessorProficiencyPlans callAPI={callAPI} />
            </Suspense>
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4 w-full max-w-5xl mx-auto">
            <ProfessorTraceAudit callAPI={callAPI} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Diálogos controlados pelo estado do pai */}
      <CreateSimuladoDialog
        open={showCreate}
        onOpenChange={handleCloseCreate}
        callAPI={callAPI}
        onCreated={loadSimulados}
      />

      {resultsDialog.open && (
        <Suspense fallback={null}>
          <SimuladoResultsDialog 
            state={resultsDialog} 
            onClose={handleCloseResults} 
            callAPI={callAPI}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ProfessorDashboard;
