import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Plus, Loader2, Video, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
import ProfessorTurmaManager from "@/components/professor/ProfessorTurmaManager";
import TopRiskStudents from "@/components/professor/TopRiskStudents";
import ClassCognitiveHeatmap from "@/components/professor/ClassCognitiveHeatmap";
import ClassCognitiveMatrix from "@/components/professor/ClassCognitiveMatrix";
import ProfessorInterventionTimeline from "@/components/professor/ProfessorInterventionTimeline";
import ProfessionalLeaderboard from "@/components/professor/ProfessionalLeaderboard";
import OperationalKpiBar from "@/components/professor/OperationalKpiBar";
import StudentOperationalDrawer from "@/components/professor/StudentOperationalDrawer";
import QuickInterventionDialog, { type InterventionType } from "@/components/professor/QuickInterventionDialog";
import { useClassAnalytics } from "@/hooks/useClassAnalytics";

import type { ResultsDialogState } from "@/components/professor/SimuladoResultsDialog";

const ProfessorBIPanel = lazy(() => import("@/components/professor/ProfessorBIPanel"));
const SimuladoResultsDialog = lazy(() => import("@/components/professor/SimuladoResultsDialog"));
const SimuladoQuestionsDialog = lazy(() => import("@/components/professor/SimuladoQuestionsDialog").then(m => ({ default: m.SimuladoQuestionsDialog })));

interface ProfessorDashboardProps {
  initialTab?: string;
}

const ProfessorDashboard = ({ initialTab }: ProfessorDashboardProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || "operacional");
  const [activeSub, setActiveSub] = useState<string>("risco");
  const [resultsDialog, setResultsDialog] = useState<ResultsDialogState>({
    open: false,
    simulado: null,
    results: [],
    loading: false,
    questions_json: [],
  });
  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<{
    id: string;
    name: string;
    type: InterventionType;
    specialty?: string;
    justification?: string;
  } | null>(null);
  const [questionsDialog, setQuestionsDialog] = useState<{ open: boolean; simulado: any }>({
    open: false,
    simulado: null,
  });

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
      const { data, error } = await supabase.functions.invoke("professor-simulado", {
        body,
      });
      if (error) throw error;
      return data;
    },
    []
  );

  const classAnalytics = useClassAnalytics(callAPI);

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
    
    // Auto-select first sub-tab if initialTab was provided
    if (initialTab) {
      const subMapping: Record<string, string> = {
        operacional: "risco",
        turmas: "minhas",
        simulados: "lista",
        mentoria: "temas",
        auditoria: "trace",
      };
      const sub = subMapping[initialTab];
      if (sub) setActiveSub(sub);
    }
  }, [loadSimulados, initialTab]);

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
    if (simulado?.id) {
      navigate(`/professor/simulados/editar/${simulado.id}`);
    } else {
      navigate("/professor/simulados/novo");
    }
  }, [navigate]);

  const handleOpenProficiencyPlanner = useCallback(() => {
    setActiveTab("mentoria");
    setActiveSub("proficiencia");
  }, []);

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

        {/* Professor Command Center — 5 grupos operacionais
            (12 tabs originais preservadas como sub-abas dentro de cada grupo) */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            // sub padrão por grupo
            const firstSub: Record<string, string> = {
              operacional: "risco",
              turmas: "minhas",
              simulados: "lista",
              mentoria: "temas",
              auditoria: "trace",
            };
            setActiveSub(firstSub[v] || "");
          }}
          className="w-full"
        >
          <div className="rounded-2xl border border-white/5 bg-card/20 backdrop-blur-md p-2">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
              {[
                { value: "operacional", label: "Operacional" },
                { value: "turmas", label: "Turmas" },
                { value: "simulados", label: "Simulados" },
                { value: "mentoria", label: "Mentoria" },
                { value: "auditoria", label: "Auditoria" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-10 min-w-[48%] flex-1 justify-center rounded-xl border border-white/5 px-4 text-[11px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow-sm sm:min-w-fit sm:flex-none"
                >
                  {tab.label.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Sub-aba selector — mostra apenas o sub do grupo ativo */}
          <SubTabsBar group={activeTab} active={activeSub} onChange={setActiveSub} />

          {/* OPERACIONAL: Risco · Matriz cognitiva · Heatmap · Timeline · Ranking · Aluno · Casos */}
          <TabsContent value="operacional" className="mt-4 space-y-6">
            {(activeSub === "risco" || activeSub === "matriz" || activeSub === "heatmap" || activeSub === "ranking") && (
              <OperationalKpiBar analytics={classAnalytics.data} loading={classAnalytics.loading} />
            )}
            {activeSub === "risco" && (
              <TopRiskStudents
                analytics={classAnalytics.data}
                loading={classAnalytics.loading}
                error={classAnalytics.error}
                onReload={classAnalytics.reload}
                onAssignRecovery={(id, name) => setIntervention({ id, name, type: "recovery" })}
                onOpenMentor={() => { setActiveTab("mentoria"); setActiveSub("temas"); }}
                onOpenDrawer={(id) => setDrawerStudentId(id)}
              />
            )}
            {activeSub === "matriz" && (
              <ClassCognitiveMatrix analytics={classAnalytics.data} loading={classAnalytics.loading} />
            )}
            {activeSub === "heatmap" && <ClassCognitiveHeatmap callAPI={callAPI} />}
            {activeSub === "timeline" && <ProfessorInterventionTimeline callAPI={callAPI} />}
            {activeSub === "ranking" && (
              <ProfessionalLeaderboard analytics={classAnalytics.data} loading={classAnalytics.loading} />
            )}
            {activeSub === "aluno" && (
              <Suspense fallback={null}><StudentTracker callAPI={callAPI} /></Suspense>
            )}
            {activeSub === "plantao" && (
              <Suspense fallback={null}><ProfessorPlantao callAPI={callAPI} /></Suspense>
            )}
          </TabsContent>

          {/* TURMAS: Minhas turmas · BI da turma · BI agregada · Video */}
          <TabsContent value="turmas" className="mt-4">
            {activeSub === "minhas" && <ProfessorTurmaManager callAPI={callAPI} />}
            {activeSub === "analytics" && (
              <Suspense fallback={null}><ClassAnalytics callAPI={callAPI} /></Suspense>
            )}
            {activeSub === "bi" && (
              <Suspense fallback={null}><ProfessorBIPanel callAPI={callAPI} /></Suspense>
            )}
            {activeSub === "video" && (
              <Suspense fallback={null}><VideoRoom callAPI={callAPI} /></Suspense>
            )}
          </TabsContent>

          {/* SIMULADOS: Lista · OSCE */}
          <TabsContent value="simulados" className="mt-4 space-y-4">
            {activeSub === "lista" && (
              <div className="space-y-4 w-full max-w-5xl mx-auto">
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
              </div>
            )}
            {activeSub === "osce" && (
              <Suspense fallback={null}><ProfessorPracticalExams callAPI={callAPI} /></Suspense>
            )}
          </TabsContent>

          {/* MENTORIA: Temas/atribuições · Mentoria · Proficiência */}
          <TabsContent value="mentoria" className="mt-4">
            {activeSub === "temas" && (
              <Suspense fallback={null}><TeacherStudyAssignments callAPI={callAPI} /></Suspense>
            )}
            {activeSub === "planos" && (
              <Suspense fallback={null}><MentorThemePlans callAPI={callAPI} /></Suspense>
            )}
            {activeSub === "proficiencia" && (
              <Suspense fallback={null}><ProfessorProficiencyPlans callAPI={callAPI} /></Suspense>
            )}
          </TabsContent>

          {/* AUDITORIA */}
          <TabsContent value="auditoria" className="mt-4">
            {activeSub === "trace" && <ProfessorTraceAudit callAPI={callAPI} />}
          </TabsContent>
        </Tabs>
      </main>


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

      <StudentOperationalDrawer
        studentId={drawerStudentId}
        open={!!drawerStudentId}
        onClose={() => setDrawerStudentId(null)}
        callAPI={callAPI}
        risk={
          drawerStudentId
            ? (classAnalytics.data?.student_cognitive_risks || []).find(
                (r: any) => r.user_id === drawerStudentId,
              ) || null
            : null
        }
        onAction={(type, suggestedSpecialty, suggestedJustification) => {
          if (!drawerStudentId) return;
          const name =
            (classAnalytics.data?.students || []).find((s: any) => s.user_id === drawerStudentId)
              ?.display_name ||
            (classAnalytics.data?.student_cognitive_risks || []).find(
              (r: any) => r.user_id === drawerStudentId,
            )?.display_name ||
            "Aluno";
          setIntervention({
            id: drawerStudentId,
            name,
            type,
            specialty: suggestedSpecialty,
            justification: suggestedJustification,
          });
        }}
      />

      <QuickInterventionDialog
        open={!!intervention}
        onClose={() => setIntervention(null)}
        studentId={intervention?.id || null}
        studentName={intervention?.name}
        interventionType={intervention?.type || "recovery"}
        suggestedSpecialty={intervention?.specialty}
        suggestedJustification={intervention?.justification}
        callAPI={callAPI}
        onSuccess={() => classAnalytics.reload()}
      />
    </div>
  );
};

const SUB_TABS: Record<string, { value: string; label: string }[]> = {
  operacional: [
    { value: "risco", label: "Alunos em risco" },
    { value: "matriz", label: "Matriz cognitiva" },
    { value: "heatmap", label: "Heatmap turma" },
    { value: "timeline", label: "Timeline" },
    { value: "ranking", label: "Ranking" },
    { value: "aluno", label: "Aluno individual" },
    { value: "plantao", label: "Casos plantão" },
  ],
  turmas: [
    { value: "minhas", label: "Minhas turmas" },
    { value: "analytics", label: "BI da turma" },
    { value: "bi", label: "BI agregada" },
    { value: "video", label: "Sala de vídeo" },
  ],
  simulados: [
    { value: "lista", label: "Simulados" },
    { value: "osce", label: "OSCE" },
  ],
  mentoria: [
    { value: "temas", label: "Temas e atribuições" },
    { value: "planos", label: "Planos de mentoria" },
    { value: "proficiencia", label: "Proficiência" },
  ],
  auditoria: [
    { value: "trace", label: "Trace e logs" },
  ],
};

function SubTabsBar({ group, active, onChange }: { group: string; active: string; onChange: (v: string) => void }) {
  const subs = SUB_TABS[group] || [];
  if (subs.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 px-1">
      {subs.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={
            "h-8 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors " +
            (active === s.value
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-white/[0.03] text-white/60 border border-white/10 hover:bg-white/[0.06] hover:text-white/90")
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default ProfessorDashboard;
