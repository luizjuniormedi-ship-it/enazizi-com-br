import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from "react";
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
import CreateSimuladoDialog from "@/components/professor/CreateSimuladoDialog";
import type { ResultsDialogState } from "@/components/professor/SimuladoResultsDialog";

const ProfessorBIPanel = lazy(() => import("@/components/professor/ProfessorBIPanel"));
const SimuladoResultsDialog = lazy(() => import("@/components/professor/SimuladoResultsDialog"));
const SimuladoQuestionsDialog = lazy(() => import("@/components/professor/SimuladoQuestionsDialog").then(m => ({ default: m.SimuladoQuestionsDialog })));

const ProfessorDashboard = () => {
  const { session } = useAuth();
  const { toast } = useToast();

  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("simulados");
  const [showCreate, setShowCreate] = useState(false);
  const [editingSimulado, setEditingSimulado] = useState<any>(null);
  const [resultsDialog, setResultsDialog] = useState<ResultsDialogState>({
    open: false,
    simulado: null,
    results: [],
    loading: false,
    questions_json: [],
  });
  const [questionsDialog, setQuestionsDialog] = useState<{ open: boolean; simulado: any }>({
    open: false,
    simulado: null,
  });

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-simulado`;

  const safeAction = useCallback(async (name: string, fn: () => Promise<void>) => {
    try {
      console.log(`[ProfessorDashboard] action_start: ${name}`);
      await fn();
      console.log(`[ProfessorDashboard] action_success: ${name}`);
    } catch (error) {
      console.error(`[ProfessorDashboard] action_failed: ${name}`, error);
      toast({
        title: "Erro inesperado",
        description: error instanceof Error ? error.message : "Erro ao executar ação.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const callAPI = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const resp = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Erro na operação");
        return data;
      } catch (e: any) {
        throw e;
      }
    },
    [session, API_URL]
  );

  const loadSimulados = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callAPI({ action: "list_simulados" });
      setSimulados(Array.isArray(res.simulados) ? res.simulados : []);
    } catch (e) {
      toast({
        title: "Erro ao carregar simulados",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
      setSimulados([]);
    } finally {
      setLoading(false);
    }
  }, [session, callAPI, toast]);

  useEffect(() => {
    loadSimulados();
  }, [loadSimulados]);

  const handleViewResults = useCallback(
    async (simulado: any) => {
      await safeAction("view_results", async () => {
        setResultsDialog({
          open: true,
          simulado,
          results: [],
          loading: true,
          questions_json: [],
        });
        const res = await callAPI({
          action: "get_simulado_results",
          simulado_id: simulado.id,
        });
        setResultsDialog((prev) => ({
          ...prev,
          results: Array.isArray(res.results) ? res.results : [],
          questions_json: Array.isArray(res.questions_json) ? res.questions_json : [],
          loading: false,
        }));
      });
    },
    [callAPI, safeAction]
  );

  const handleDeleteSimulado = useCallback(
    async (simuladoId: string, simuladoTitle: string) => {
      await safeAction("delete_simulado", async () => {
        if (!confirm(`Tem certeza que deseja apagar o simulado "${simuladoTitle}"?`)) return;
        await callAPI({ action: "delete_simulado", simulado_id: simuladoId });
        toast({ title: "Simulado apagado" });
        loadSimulados();
      });
    },
    [callAPI, toast, loadSimulados, safeAction]
  );

  const handleCloseResults = useCallback(() => {
    setResultsDialog({ open: false, simulado: null, results: [], loading: false, questions_json: [] });
  }, []);

  const handleOpenQuestions = useCallback((simulado: any) => {
    setQuestionsDialog({ open: true, simulado });
  }, []);

  const handleCloseQuestions = useCallback(() => {
    setQuestionsDialog({ open: false, simulado: null });
  }, []);

  const handleOpenCreate = useCallback((simulado?: any) => {
    console.log("[ProfessorDashboard] abrir modal criar simulado", simulado?.id || "novo");
    setEditingSimulado(simulado || null);
    setShowCreate(true);
  }, []);

  const handleCloseCreate = (open: boolean) => {
    console.log("[ProfessorDashboard] setOpenCreateSimulado:", open);
    setShowCreate(open);
    if (!open) setEditingSimulado(null);
  };

  const totals = useMemo(() => {
    const safeSimulados = Array.isArray(simulados) ? simulados : [];
    const totalStudentsAssigned = safeSimulados.reduce((s, sim) => s + (sim?.results_summary?.total || 0), 0);
    const totalCompleted = safeSimulados.reduce((s, sim) => s + (sim?.results_summary?.completed || 0), 0);
    return { totalSimulados: safeSimulados.length, totalStudentsAssigned, totalCompleted };
  }, [simulados]);

  return (
    <div className="min-h-screen relative z-10 animate-fade-in">
      <EnaflixBackgroundFX intensity="medium" />
      
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <CinematicHero
          module="professor"
          eyebrow={<><GraduationCap className="h-3.5 w-3.5" /> Centro de mentoria</>}
          title="Painel do Professor"
          subtitle="Crie simulados, acompanhe alunos e oriente turmas com inteligência adaptativa."
          actions={
            <Button 
              type="button"
              data-testid="open-create-simulado-button"
              onClick={() => handleOpenCreate()} 
              size="lg" 
              className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-glow-sm gap-2"
            >
              <Plus className="h-4 w-4" /> NOVO SIMULADO
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <SimuladosKpiCards {...totals} />

            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
            ) : simulados.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum simulado criado</h3>
                  <Button onClick={() => handleOpenCreate()}>CRIAR SIMULADO</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {simulados.map((sim) => (
                  <SimuladoListItem
                    key={sim.id}
                    sim={sim}
                    onView={handleViewResults}
                    onEdit={handleOpenCreate}
                    onQuestions={handleOpenQuestions}
                    onDelete={handleDeleteSimulado}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="plantao" className="mt-4"><Suspense fallback={null}><ProfessorPlantao callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="temas" className="mt-4"><Suspense fallback={null}><TeacherStudyAssignments callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="video" className="mt-4"><Suspense fallback={null}><VideoRoom callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="alunos" className="mt-4"><Suspense fallback={null}><StudentTracker callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="analytics" className="mt-4"><Suspense fallback={null}><ClassAnalytics callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="bi" className="mt-4"><Suspense fallback={null}><ProfessorBIPanel callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="mentoria" className="mt-4"><Suspense fallback={null}><MentorThemePlans callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="osce" className="mt-4"><Suspense fallback={null}><ProfessorPracticalExams callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="proficiencia" className="mt-4"><Suspense fallback={null}><ProfessorProficiencyPlans callAPI={callAPI} /></Suspense></TabsContent>
          <TabsContent value="auditoria" className="mt-4"><ProfessorTraceAudit callAPI={callAPI} /></TabsContent>
        </Tabs>
      </main>

      <CreateSimuladoDialog
        open={showCreate}
        onOpenChange={handleCloseCreate}
        editingSimulado={editingSimulado}
        onCreated={loadSimulados}
      />

      {resultsDialog.open && (
        <Suspense fallback={null}>
          <SimuladoResultsDialog state={resultsDialog} onClose={handleCloseResults} callAPI={callAPI} />
        </Suspense>
      )}

      {questionsDialog.open && (
        <Suspense fallback={null}>
          <SimuladoQuestionsDialog
            open={questionsDialog.open}
            onOpenChange={handleCloseQuestions}
            simuladoId={questionsDialog.simulado?.id}
            simuladoTitle={questionsDialog.simulado?.title}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ProfessorDashboard;
