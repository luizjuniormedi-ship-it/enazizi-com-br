import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { MedicalTermProvider } from "@/contexts/MedicalTermContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminRoute from "@/components/auth/AdminRoute";
import ProfessorRoute from "@/components/auth/ProfessorRoute";
import InstitutionalRoute from "@/components/auth/InstitutionalRoute";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { Suspense } from "react";
import { Navigate } from "react-router-dom";
import PreserveQueryNavigate from "@/components/routing/PreserveQueryNavigate";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { CinematicPageLoader, AmbientPersistenceLayer, useModuleAtmosphere, CinematicRouteTransition } from "@/components/cinematic";

// Eager-load shell layout (always needed)
import DashboardLayout from "./components/layout/DashboardLayout";

// Lazy-load all pages
const Index = lazyWithRetry(() => import("./pages/Index"), "Index");
const DemoImageQuestions = lazyWithRetry(() => import("./pages/DemoImageQuestions"), "DemoImageQuestions");
const Login = lazyWithRetry(() => import("./pages/Login"), "Login");
const Register = lazyWithRetry(() => import("./pages/Register"), "Register");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard");
const Flashcards = lazyWithRetry(() => import("./pages/Flashcards"), "Flashcards");
const FlashcardGenerator = lazyWithRetry(() => import("./pages/FlashcardGenerator"), "FlashcardGenerator");
const MnemonicGenerator = lazyWithRetry(() => import("./pages/MnemonicGenerator"), "MnemonicGenerator");
const CronogramaInteligente = lazyWithRetry(() => import("./pages/CronogramaInteligente"), "CronogramaInteligente");
const Simulados = lazyWithRetry(() => import("./pages/Simulados"), "Simulados");
const Uploads = lazyWithRetry(() => import("./pages/Uploads"), "Uploads");
const QuestionGenerator = lazyWithRetry(() => import("./pages/QuestionGenerator"), "QuestionGenerator");
const QuestionsBank = lazyWithRetry(() => import("./pages/QuestionsBank"), "QuestionsBank");
const ContentSummarizer = lazyWithRetry(() => import("./pages/ContentSummarizer"), "ContentSummarizer");
const MotivationalCoach = lazyWithRetry(() => import("./pages/MotivationalCoach"), "MotivationalCoach");
const AgentsHub = lazyWithRetry(() => import("./pages/AgentsHub"), "AgentsHub");
const Analytics = lazyWithRetry(() => import("./pages/Analytics"), "Analytics");
const Admin = lazyWithRetry(() => import("./pages/Admin"), "Admin");
const Profile = lazyWithRetry(() => import("./pages/Profile"), "Profile");
const DailyPlan = lazyWithRetry(() => import("./pages/DailyPlan"), "DailyPlan");
const RadarTrajetoriaPage = lazyWithRetry(() => import("./pages/RadarTrajetoriaPage"), "RadarTrajetoriaPage");
const PerformancePredictor = lazyWithRetry(() => import("./pages/PerformancePredictor"), "PerformancePredictor");
const Diagnostic = lazyWithRetry(() => import("./pages/Diagnostic"), "Diagnostic");
const ExamSimulator = lazyWithRetry(() => import("./pages/ExamSimulator"), "ExamSimulator");
const ChatGPT = lazyWithRetry(() => import("./pages/ChatGPT"), "ChatGPT");
const ErrorBank = lazyWithRetry(() => import("./pages/ErrorBank"), "ErrorBank");
const MedicalDomainMap = lazyWithRetry(() => import("./pages/MedicalDomainMap"), "MedicalDomainMap");
const ProfessorDashboard = lazyWithRetry(() => import("./pages/ProfessorDashboard"), "ProfessorDashboard");
const StudentSimulados = lazyWithRetry(() => import("./pages/StudentSimulados"), "StudentSimulados");
const DiscursiveQuestions = lazyWithRetry(() => import("./pages/DiscursiveQuestions"), "DiscursiveQuestions");
const ClinicalSimulation = lazyWithRetry(() => import("./pages/ClinicalSimulation"), "ClinicalSimulation");
const Achievements = lazyWithRetry(() => import("./pages/Achievements"), "Achievements");
const MedicalReviewer = lazyWithRetry(() => import("./pages/MedicalReviewer"), "MedicalReviewer");
const InterviewSimulator = lazyWithRetry(() => import("./pages/InterviewSimulator"), "InterviewSimulator");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");
const AnamnesisTrainer = lazyWithRetry(() => import("./pages/AnamnesisTrainer"), "AnamnesisTrainer");
const Install = lazyWithRetry(() => import("./pages/Install"), "Install");
const StudyGuides = lazyWithRetry(() => import("./pages/StudyGuides"), "StudyGuides");
const MedicalChronicles = lazyWithRetry(() => import("./pages/MedicalChronicles"), "MedicalChronicles");
const MedicalAdaptiveJourney = lazyWithRetry(() => import("./pages/MedicalAdaptiveJourney"), "MedicalAdaptiveJourney");

const AIMentor = lazyWithRetry(() => import("./pages/AIMentor"), "AIMentor");
const SmartPlanner = lazyWithRetry(() => import("./pages/SmartPlanner"), "SmartPlanner");
const AdminMonitoring = lazyWithRetry(() => import("./pages/AdminMonitoring"), "AdminMonitoring");
const AdminCEO = lazyWithRetry(() => import("./pages/AdminCEO"), "AdminCEO");
const ProductMetricsPage = lazyWithRetry(() => import("./pages/ProductMetricsPage"), "ProductMetricsPage");
const AdminOrchestratorInsights = lazyWithRetry(() => import("./pages/AdminOrchestratorInsights"), "AdminOrchestratorInsights");
const ValidationDashboard = lazyWithRetry(() => import("./pages/admin/ValidationDashboard"), "ValidationDashboard");
const ContentCoverageAudit = lazyWithRetry(() => import("./pages/admin/ContentCoverageAudit"), "ContentCoverageAudit");
const CoveragePriorityBoost = lazyWithRetry(() => import("./pages/admin/CoveragePriorityBoost"), "CoveragePriorityBoost");
const ClassificationBackfill = lazyWithRetry(() => import("./pages/admin/ClassificationBackfill"), "ClassificationBackfill");
const ClassificationRunner = lazyWithRetry(() => import("./pages/admin/ClassificationRunner"), "ClassificationRunner");
const ClassificationHealthDashboard = lazyWithRetry(() => import("./pages/admin/ClassificationHealthDashboard"), "ClassificationHealthDashboard");
const CurriculumCoverage = lazyWithRetry(() => import("./pages/admin/CurriculumCoverage"), "CurriculumCoverage");
const GranularGeneratorMonitor = lazyWithRetry(() => import("./pages/admin/GranularGeneratorMonitor"), "GranularGeneratorMonitor");
const GeneratorTelemetry = lazyWithRetry(() => import("./pages/admin/GeneratorTelemetry"), "GeneratorTelemetry");
const BancaReadiness = lazyWithRetry(() => import("./pages/admin/BancaReadiness"), "BancaReadiness");
const SimuladoSelectionTelemetry = lazyWithRetry(() => import("./pages/admin/SimuladoSelectionTelemetry"), "SimuladoSelectionTelemetry");
const SimuladoSelectionRunDetail = lazyWithRetry(() => import("./pages/admin/SimuladoSelectionRunDetail"), "SimuladoSelectionRunDetail");
const SystemChecklist = lazyWithRetry(() => import("./pages/admin/SystemChecklist"), "SystemChecklist");
const MissionMode = lazyWithRetry(() => import("./pages/MissionMode"), "MissionMode");
const MissionControlPage = lazyWithRetry(() => import("./pages/MissionControlPage"), "MissionControlPage");
const MissionEntry = lazyWithRetry(() => import("./pages/MissionEntry"), "MissionEntry");
const StudySession = lazyWithRetry(() => import("./pages/StudySession"), "StudySession");
const Rankings = lazyWithRetry(() => import("./pages/Rankings"), "Rankings");
const MedicalImageQuiz = lazyWithRetry(() => import("./pages/MedicalImageQuiz"), "MedicalImageQuiz");
const PracticalExam = lazyWithRetry(() => import("./pages/PracticalExam"), "PracticalExam");
const MnemonicStudio = lazyWithRetry(() => import("./pages/MnemonicStudio"), "MnemonicStudio");
const MnemonicStudioPage = lazyWithRetry(() => import("./pages/MnemonicStudioPage"), "MnemonicStudioPage");
const MnemonicHistoryPage = lazyWithRetry(() => import("./pages/MnemonicHistoryPage"), "MnemonicHistoryPage");
const MindMaps = lazyWithRetry(() => import("./pages/MindMaps"), "MindMaps");
const MindMapFullscreen = lazyWithRetry(() => import("./pages/MindMapFullscreen"), "MindMapFullscreen");
const InstitutionalDashboard = lazyWithRetry(() => import("./pages/InstitutionalDashboard"), "InstitutionalDashboard");
const ProficiencyPilotPage = lazyWithRetry(() => import("./pages/ProficiencyPilotPage"), "ProficiencyPilotPage");
const EnaflixPage = lazyWithRetry(() => import("./pages/EnaflixPage"), "EnaflixPage");
const EnaflixCatalogPage = lazyWithRetry(() => import("./pages/EnaflixCatalogPage"), "EnaflixCatalogPage");
const PublicVideoLesson = lazyWithRetry(() => import("./pages/PublicVideoLesson"), "PublicVideoLesson");
const VideoLessonsExplore = lazyWithRetry(() => import("./pages/VideoLessonsExplore"), "VideoLessonsExplore");
const CMEAudit = lazyWithRetry(() => import("./pages/admin/CMEAudit"), "CMEAudit");

const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"), "ResetPassword");
const CognitiveShowcase = lazyWithRetry(() => import("./pages/dev/CognitiveShowcase"), "CognitiveShowcase");
const TutorMemoryAdmin = lazyWithRetry(() => import("./pages/admin/TutorMemoryAdmin"), "TutorMemoryAdmin");
const TelemetryAdmin = lazyWithRetry(() => import("./pages/admin/TelemetryAdmin"), "TelemetryAdmin");
const AIStudio = lazyWithRetry(() => import("./pages/admin/AIStudio"), "AIStudio");
const MedicalReviewQueue = lazyWithRetry(() => import("./pages/admin/MedicalReviewQueue"), "MedicalReviewQueue");
const MedicalGovernanceDashboard = lazyWithRetry(() => import("./pages/admin/MedicalGovernanceDashboard"), "MedicalGovernanceDashboard");
const AIAuditMode = lazyWithRetry(() => import("./pages/admin/AIAuditMode"), "AIAuditMode");
const NotebookLMDashboard = lazyWithRetry(() => import("./pages/admin/NotebookLMDashboard"), "NotebookLMDashboard");
const NotebookLMSync = lazyWithRetry(() => import("./pages/admin/NotebookLMSync"), "NotebookLMSync");
const NotebookLMAnalytics = lazyWithRetry(() => import("./pages/admin/NotebookLMAnalytics"), "NotebookLMAnalytics");
const VideoLessonsAdmin = lazyWithRetry(() => import("./pages/admin/VideoLessonsAdmin"), "VideoLessonsAdmin");
const VideoLessonDetailsAdmin = lazyWithRetry(() => import("./pages/admin/VideoLessonDetailsAdmin"), "VideoLessonDetailsAdmin");
const OfficialExamIngestion = lazyWithRetry(() => import("./pages/admin/OfficialExamIngestion"), "OfficialExamIngestion");
const VideoLessonsLibrary = lazyWithRetry(() => import("./pages/VideoLessonsLibrary"), "VideoLessonsLibrary");
const VideoLessonPlayer = lazyWithRetry(() => import("./pages/VideoLessonPlayer"), "VideoLessonPlayer");
const MedicalKnowledgeGraph = lazyWithRetry(() => import("./pages/admin/MedicalKnowledgeGraph"), "MedicalKnowledgeGraph");
const AdaptiveEngineAdmin = lazyWithRetry(() => import("./pages/admin/AdaptiveEngineAdmin"), "AdaptiveEngineAdmin");
const AdminInterventionPolicies = lazyWithRetry(() => import("./pages/admin/AdminInterventionPolicies"), "AdminInterventionPolicies");
const AdminAdaptiveExperiments = lazyWithRetry(() => import("./pages/admin/AdminAdaptiveExperiments"), "AdminAdaptiveExperiments");
const AdminCinematicEngine = lazyWithRetry(() => import("./pages/AdminCinematicEngine"), "AdminCinematicEngine");
const CMEStatus = lazyWithRetry(() => import("./pages/admin/CMEStatus"), "CMEStatus");
const CMEIncidents = lazyWithRetry(() => import("./pages/admin/CMEIncidents"), "CMEIncidents");
const CMEMediaMonitor = lazyWithRetry(() => import("./pages/admin/CMEMediaMonitor"), "CMEMediaMonitor");
const CMEOrigins = lazyWithRetry(() => import("./pages/admin/CMEOrigins"), "CMEOrigins");
const CinematicSessionBuilder = lazyWithRetry(() => import("./pages/admin/CinematicSessionBuilder"), "CinematicSessionBuilder");
const CinematicBuilder = lazyWithRetry(() => import("./pages/admin/CinematicBuilder"), "CinematicBuilder");
const CMEExecutiveDashboard = lazyWithRetry(() => import("./pages/admin/cme/ExecutiveDashboard"), "CMEExecutiveDashboard");
const CMEGPUFleet = lazyWithRetry(() => import("./pages/admin/cme/GPUFleet"), "CMEGPUFleet");
const CMERenderQueues = lazyWithRetry(() => import("./pages/admin/cme/RenderQueues"), "CMERenderQueues");
const CMEObservability = lazyWithRetry(() => import("./pages/admin/cme/Observability"), "CMEObservability");




const SpecialtyFrictionReport = lazyWithRetry(() => import("./pages/admin/SpecialtyFrictionReport"), "SpecialtyFrictionReport");
const PageSkeleton = lazyWithRetry(() => import("./components/layout/PageSkeleton"), "PageSkeleton");

/** Loader sensível à rota: escolhe o módulo cinematográfico atual. */
const PageLoader = () => {
  const module = useModuleAtmosphere();
  return <CinematicPageLoader module={module} />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min cache
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <MedicalTermProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AmbientPersistenceLayer />
          <CinematicRouteTransition>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/videoaulas/:id" element={<PublicVideoLesson />} />
                <Route path="/demo-questoes-imagem" element={<DemoImageQuestions />} />
                <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="cronograma" element={<PreserveQueryNavigate to="/dashboard/planner" />} />
                <Route path="cronograma-inteligente" element={<PreserveQueryNavigate to="/dashboard/planner" />} />
                {/* P0-bis: preserve ?did= so orchestrator decisions reach the destination */}
                <Route path="quiz" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo" />} />
                <Route path="revisoes" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo?focus=reviews" />} />
                <Route path="revisao" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo?focus=reviews" />} />
                <Route path="tutor" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo" />} />
                <Route path="flashcards" element={<Flashcards />} />
                <Route path="gerar-flashcards" element={<FlashcardGenerator />} />
                <Route path="simulados" element={<Simulados />} />
                <Route path="uploads" element={<Uploads />} />
                <Route path="agentes" element={<AgentsHub />} />
                <Route path="questoes" element={<Navigate to="/dashboard/simulados" replace />} />
                <Route path="banco-questoes" element={<Navigate to="/dashboard/simulados" replace />} />
                <Route path="gerador-questoes" element={<QuestionGenerator />} />
                <Route path="resumos" element={<ContentSummarizer />} />
                 <Route path="apostilas" element={<StudyGuides />} />
                 <Route path="videoaulas" element={<VideoLessonsLibrary />} />
                 <Route path="videoaulas/explorar" element={<VideoLessonsExplore />} />
                 <Route path="videoaulas/:id" element={<VideoLessonPlayer />} />
                
                <Route path="coach" element={<MotivationalCoach />} />
                <Route path="chatgpt" element={<ChatGPT />} />
                <Route path="plano-dia" element={<Navigate to="/dashboard" replace />} />
                <Route path="predictor" element={<PerformancePredictor />} />
                <Route path="diagnostico" element={<Diagnostic />} />
                
                <Route path="banco-erros" element={<ErrorBank />} />
                <Route path="mapa-dominio" element={<MedicalDomainMap />} />
                <Route path="proficiencia" element={<StudentSimulados />} />
                <Route path="discursivas" element={<DiscursiveQuestions />} />
                <Route path="plantao" element={<ClinicalSimulation />} />
                <Route path="simulacao-clinica" element={<ClinicalSimulation />} />
                <Route path="revisor" element={<MedicalReviewer />} />
                <Route path="entrevista" element={<InterviewSimulator />} />
                <Route path="conquistas" element={<Achievements />} />
                <Route path="anamnese" element={<AnamnesisTrainer />} />
                <Route path="cronicas" element={<MedicalChronicles />} />
                <Route path="feynman" element={<Navigate to="/dashboard/chatgpt" replace />} />
                <Route path="mentor" element={<AIMentor />} />
                <Route path="planner" element={<SmartPlanner />} />
                <Route path="missao" element={<Navigate to="/mission" replace />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="sessao-estudo" element={<StudySession />} />
                <Route path="image-quiz" element={<MedicalImageQuiz />} />
                <Route path="rankings" element={<Rankings />} />
                <Route path="prova-pratica" element={<PracticalExam />} />
                {/* Fase 0 cleanup: rotas antigas de mnemônico redirecionam para v2 (motor oficial) */}
                <Route path="mnemonico" element={<Navigate to="/dashboard/mnemonic-studio-v2" replace />} />
                <Route path="mnemonic-studio" element={<Navigate to="/dashboard/mnemonic-studio-v2" replace />} />
                <Route path="mnemonic-studio-v2" element={<MnemonicStudioPage />} />
                <Route path="mnemonic-history" element={<MnemonicHistoryPage />} />
                {/* Mapas Mentais — reativado: tabela mental_maps + 3 edge functions já existentes */}
                <Route path="mapas-mentais" element={<MindMaps />} />
                <Route path="orchestrator-insights" element={<AdminRoute><AdminOrchestratorInsights /></AdminRoute>} />
                <Route path="radar-trajetoria" element={<RadarTrajetoriaPage />} />
                <Route path="minha-jornada" element={<MedicalAdaptiveJourney />} />

              </Route>
              {/* Fullscreen mind map viewer */}
              <Route path="/dashboard/mapas-mentais/:id" element={<MindMapFullscreen />} />
              <Route path="/admin" element={<AdminRoute><DashboardLayout /></AdminRoute>}>
                <Route index element={<Admin />} />
                <Route path="monitoring" element={<AdminMonitoring />} />
                <Route path="ceo" element={<AdminCEO />} />
                <Route path="metrics" element={<ProductMetricsPage />} />
                <Route path="orchestrator-insights" element={<AdminOrchestratorInsights />} />
                <Route path="validation" element={<ValidationDashboard />} />
                <Route path="coverage" element={<ContentCoverageAudit />} />
                <Route path="coverage-boost" element={<CoveragePriorityBoost />} />
                <Route path="classification" element={<ClassificationBackfill />} />
                <Route path="classification-runner" element={<ClassificationRunner />} />
                <Route path="classification-health" element={<ClassificationHealthDashboard />} />
                <Route path="cme-status" element={<CMEStatus />} />
                <Route path="cme-incidents" element={<CMEIncidents />} />
                <Route path="curriculum-coverage" element={<CurriculumCoverage />} />
                <Route path="granular-generator" element={<GranularGeneratorMonitor />} />
                <Route path="generator-telemetry" element={<GeneratorTelemetry />} />
                <Route path="banca-readiness" element={<BancaReadiness />} />
                <Route path="simulado-selection" element={<SimuladoSelectionTelemetry />} />
                <Route path="simulado-selection/:id" element={<SimuladoSelectionRunDetail />} />
                 <Route path="tutor-memory" element={<TutorMemoryAdmin />} />
                  <Route path="telemetry" element={<TelemetryAdmin />} />
                  <Route path="ai-studio" element={<AIStudio />} />
                  <Route path="medical-review-queue" element={<MedicalReviewQueue />} />
                  <Route path="medical-governance" element={<MedicalGovernanceDashboard />} />
                  <Route path="ai-audit-mode" element={<AIAuditMode />} />
                  <Route path="notebooklm" element={<NotebookLMDashboard />} />
                  <Route path="notebooklm-sync" element={<NotebookLMSync />} />
                   <Route path="notebooklm-analytics" element={<NotebookLMAnalytics />} />
                   <Route path="video-lessons" element={<VideoLessonsAdmin />} />
                   <Route path="video-lessons/:id" element={<VideoLessonDetailsAdmin />} />
                   <Route path="specialty-friction" element={<SpecialtyFrictionReport />} />
                   <Route path="ingestion-network" element={<OfficialExamIngestion />} />
                   <Route path="knowledge-graph" element={<MedicalKnowledgeGraph />} />
                   <Route path="adaptive-engine" element={<AdaptiveEngineAdmin />} />
                   <Route path="intervention-policies" element={<AdminInterventionPolicies />} />
                   <Route path="adaptive-experiments" element={<AdminAdaptiveExperiments />} />
                    <Route path="cinematic-engine/:projectId" element={<AdminCinematicEngine />} />
                    <Route path="cme-origins" element={<CMEOrigins />} />
                    <Route path="cinematic-builder/:aggregationId" element={<CinematicBuilder />} />
                    <Route path="cme-builder-audit" element={<CMEAudit />} />
                    <Route path="cme-audit" element={<CMEAudit />} />
                    <Route path="cme-executive" element={<CMEExecutiveDashboard />} />
                    <Route path="system-checklist" element={<SystemChecklist />} />

                </Route>
                <Route path="cme-media-monitor" element={<CMEMediaMonitor />} />

              <Route path="/professor" element={<ProfessorRoute><DashboardLayout /></ProfessorRoute>}>
                <Route index element={<ProfessorDashboard />} />
                <Route path="proficiencia/piloto" element={<ProficiencyPilotPage />} />
              </Route>
              {/* Alias: /dashboard/proficiencia/piloto → mesma página, mesma guarda de professor/admin */}
              <Route path="/dashboard/proficiencia/piloto" element={<ProfessorRoute><DashboardLayout /></ProfessorRoute>}>
                <Route index element={<ProficiencyPilotPage />} />
              </Route>
              <Route path="/institucional" element={<InstitutionalRoute><DashboardLayout /></InstitutionalRoute>}>
                <Route index element={<InstitutionalDashboard />} />
              </Route>
              <Route path="/mission" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<MissionMode />} />
              </Route>
              <Route path="/mission-control" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<MissionControlPage />} />
              </Route>
              {/* Study execution aliases */}
              <Route path="/study/tutor" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<ChatGPT />} />
              </Route>
              <Route path="/study/flashcards" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Flashcards />} />
              </Route>
              <Route path="/study/simulado" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Simulados />} />
              </Route>
              <Route path="/study/clinical" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<ClinicalSimulation />} />
              </Route>
              <Route path="/study/anamnese" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<AnamnesisTrainer />} />
              </Route>
              <Route path="/install" element={<Install />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/enaflix" element={<ProtectedRoute><EnaflixPage /></ProtectedRoute>} />
              <Route path="/enaflix/tudo" element={<ProtectedRoute><EnaflixCatalogPage /></ProtectedRoute>} />
              <Route path="/dev/cognitive" element={<CognitiveShowcase />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </CinematicRouteTransition>
        </BrowserRouter>
        </MedicalTermProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);
export default App;
