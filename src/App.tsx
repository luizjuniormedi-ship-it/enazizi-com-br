import { Toaster } from "@/components/ui/toaster";
import { GlobalErrorBoundary } from "@/components/monitoring/GlobalErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ModuleErrorBoundary } from "@/components/monitoring/ModuleErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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
import EnaflixDashboardLayout from "./components/layout/EnaflixDashboardLayout";

// Lazy-load all pages
const Index = lazyWithRetry(() => import("./pages/Index"), "Index");
const DemoImageQuestions = lazyWithRetry(() => import("./pages/DemoImageQuestions"), "DemoImageQuestions");
const Login = lazyWithRetry(() => import("./pages/Login"), "Login");
const Register = lazyWithRetry(() => import("./pages/Register"), "Register");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard");
const Flashcards = lazyWithRetry(() => import("./pages/Flashcards"), "Flashcards");
const FlashcardGenerator = lazyWithRetry(() => import("./pages/FlashcardGenerator"), "FlashcardGenerator");
// MnemonicGenerator archived, redirecting to MnemonicStudioPage
// const MnemonicGenerator = lazyWithRetry(() => import("./pages/MnemonicGenerator"), "MnemonicGenerator");
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
import NewProfessorSimuladoPage from "./pages/NewProfessorSimuladoPage";

const AIMentor = lazyWithRetry(() => import("./pages/AIMentor"), "AIMentor");
const SmartPlanner = lazyWithRetry(() => import("./pages/SmartPlanner"), "SmartPlanner");
const AdminMonitoring = lazyWithRetry(() => import("./pages/AdminMonitoring"), "AdminMonitoring");
const AdminCEO = lazyWithRetry(() => import("./pages/AdminCEO"), "AdminCEO");
const AdminLayout = lazyWithRetry(() => import("./components/layout/AdminLayout"), "AdminLayout");
const CentroComando = lazyWithRetry(() => import("./pages/admin/CentroComando"), "CentroComando");
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

const MnemonicStudioPage = lazyWithRetry(() => import("./pages/MnemonicStudioPage"), "MnemonicStudioPage");
const MnemonicHistoryPage = lazyWithRetry(() => import("./pages/MnemonicHistoryPage"), "MnemonicHistoryPage");
const TutorV2Page = lazyWithRetry(() => import("./pages/TutorV2Page"), "TutorV2Page");
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
const AdminLessonsMemory = lazyWithRetry(() => import("./pages/admin/AdminLessonsMemory"), "AdminLessonsMemory");
const TutorMemoryAdmin = lazyWithRetry(() => import("./pages/admin/TutorMemoryAdmin"), "TutorMemoryAdmin");
const SystemHealth = lazyWithRetry(() => import("./pages/admin/SystemHealth"), "SystemHealth");
const TelemetryAdmin = lazyWithRetry(() => import("./pages/admin/TelemetryAdmin"), "TelemetryAdmin");
const TutorVideoRecommendations = lazyWithRetry(() => import("./pages/admin/TutorVideoRecommendations"), "TutorVideoRecommendations");
const AIStudio = lazyWithRetry(() => import("./pages/admin/AIStudio"), "AIStudio");
const PedagogyAnalytics = lazyWithRetry(() => import("./pages/admin/PedagogyAnalytics"), "PedagogyAnalytics");
const AIQuality = lazyWithRetry(() => import("./pages/admin/AIQuality"), "AIQuality");
const MedicalReviewQueue = lazyWithRetry(() => import("./pages/admin/MedicalReviewQueue"), "MedicalReviewQueue");
const MedicalGovernanceDashboard = lazyWithRetry(() => import("./pages/admin/MedicalGovernanceDashboard"), "MedicalGovernanceDashboard");
const AIAuditMode = lazyWithRetry(() => import("./pages/admin/AIAuditMode"), "AIAuditMode");
const NotebookLMDashboard = lazyWithRetry(() => import("./pages/admin/NotebookLMDashboard"), "NotebookLMDashboard");
const NotebookLMSync = lazyWithRetry(() => import("./pages/admin/NotebookLMSync"), "NotebookLMSync");
const NotebookLMAnalytics = lazyWithRetry(() => import("./pages/admin/NotebookLMAnalytics"), "NotebookLMAnalytics");
const VideoLessonsAdmin = lazyWithRetry(() => import("./pages/admin/VideoLessonsAdmin"), "VideoLessonsAdmin");
const VideoLessonDetailsAdmin = lazyWithRetry(() => import("./pages/admin/VideoLessonDetailsAdmin"), "VideoLessonDetailsAdmin");
const OfficialExamIngestion = lazyWithRetry(() => import("./pages/admin/OfficialExamIngestion"), "OfficialExamIngestion");
const AdminIncidentDetail = lazyWithRetry(() => import("./pages/admin/AdminIncidentDetail"), "AdminIncidentDetail");
const AdminGovernanceLogs = lazyWithRetry(() => import("./pages/admin/AdminGovernanceLogs"), "AdminGovernanceLogs");
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"), "AdminSettings");
const AdminAudit = lazyWithRetry(() => import("./pages/admin/AdminAudit"), "AdminAudit");
const MyLessonsPage = lazyWithRetry(() => import("./pages/MyLessonsPage"), "MyLessonsPage");
const VideoLessonsLibrary = MyLessonsPage;


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
const DiagnosticTutor = lazyWithRetry(() => import("./pages/admin/DiagnosticTutor"), "DiagnosticTutor");

const NOCDashboard = lazyWithRetry(() => import("./pages/admin/NOCDashboard"), "NOCDashboard");



const SpecialtyFrictionReport = lazyWithRetry(() => import("./pages/admin/SpecialtyFrictionReport"), "SpecialtyFrictionReport");
const AdminBlueprints = lazyWithRetry(() => import("./pages/admin/AdminBlueprints"), "AdminBlueprints");
const PageSkeleton = lazyWithRetry(() => import("./components/layout/PageSkeleton"), "PageSkeleton");

/** Loader sensível à rota: escolhe o módulo cinematográfico atual. */
const PageLoader = () => {
  const module = useModuleAtmosphere();
  return <CinematicPageLoader module={module} />;
};

const HomeRedirect = () => {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (session) return <Navigate to="/enaflix" replace />;
  return <Index />;
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
  <GlobalErrorBoundary>
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
                {/* --- PUBLIC ROUTES --- */}
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/install" element={<Install />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/videoaulas/:id" element={<PublicVideoLesson />} />
                <Route path="/demo-questoes-imagem" element={<DemoImageQuestions />} />

                {/* --- DASHBOARD (PROTECTED) --- */}
                <Route path="/study-hub" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<ModuleErrorBoundary module="study-hub"><EnaflixPage /></ModuleErrorBoundary>} />
                </Route>
                <Route path="/dashboard" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<ModuleErrorBoundary module="dashboard"><Dashboard /></ModuleErrorBoundary>} />
                  
                  {/* Estudar & Treinar */}
                  <Route path="sessao-estudo" element={<ModuleErrorBoundary module="sessao-estudo"><StudySession /></ModuleErrorBoundary>} />
                  <Route path="flashcards" element={<ModuleErrorBoundary module="flashcards"><Flashcards /></ModuleErrorBoundary>} />
                  <Route path="gerar-flashcards" element={<ModuleErrorBoundary module="gerar-flashcards"><FlashcardGenerator /></ModuleErrorBoundary>} />
                  <Route path="simulados" element={<ModuleErrorBoundary module="simulados"><Simulados /></ModuleErrorBoundary>} />
                  <Route path="banco-erros" element={<ModuleErrorBoundary module="banco-erros"><ErrorBank /></ModuleErrorBoundary>} />
                  <Route path="gerador-questoes" element={<ModuleErrorBoundary module="gerador-questoes"><QuestionGenerator /></ModuleErrorBoundary>} />
                  <Route path="chatgpt" element={<PreserveQueryNavigate to="/dashboard/mentor" />} />
                  <Route path="mentor" element={<ModuleErrorBoundary module="mentor"><AIMentor /></ModuleErrorBoundary>} />
                  
                  {/* Conteúdo */}
                  <Route path="videoaulas" element={<ModuleErrorBoundary module="videoaulas"><VideoLessonsLibrary /></ModuleErrorBoundary>} />
                  <Route path="videoaulas/explorar" element={<ModuleErrorBoundary module="videoaulas-explorar"><VideoLessonsExplore /></ModuleErrorBoundary>} />
                  <Route path="videoaulas/:id" element={<ModuleErrorBoundary module="video-player"><VideoLessonPlayer /></ModuleErrorBoundary>} />
                  <Route path="resumos" element={<ModuleErrorBoundary module="resumos"><ContentSummarizer /></ModuleErrorBoundary>} />
                  <Route path="apostilas" element={<ModuleErrorBoundary module="apostilas"><StudyGuides /></ModuleErrorBoundary>} />
                  <Route path="mapas-mentais" element={<ModuleErrorBoundary module="mapas-mentais"><MindMaps /></ModuleErrorBoundary>} />
                  <Route path="mnemonic-studio" element={<ModuleErrorBoundary module="mnemonicos"><MnemonicStudioPage /></ModuleErrorBoundary>} />
                  <Route path="mnemonic-generator" element={<PreserveQueryNavigate to="/dashboard/mnemonic-studio" />} />
                  <Route path="mnemonicos" element={<PreserveQueryNavigate to="/dashboard/mnemonic-studio" />} />
                  <Route path="mnemonico" element={<PreserveQueryNavigate to="/dashboard/mnemonic-studio" />} />
                  <Route path="mnemonic-history" element={<MnemonicHistoryPage />} />

                  
                  {/* Clínica & Simulação */}
                  <Route path="plantao" element={<ModuleErrorBoundary module="plantao"><ClinicalSimulation /></ModuleErrorBoundary>} />
                  <Route path="anamnese" element={<ModuleErrorBoundary module="anamnese"><AnamnesisTrainer /></ModuleErrorBoundary>} />
                  <Route path="cronicas" element={<ModuleErrorBoundary module="cronicas"><MedicalChronicles /></ModuleErrorBoundary>} />
                  <Route path="discursivas" element={<ModuleErrorBoundary module="discursivas"><DiscursiveQuestions /></ModuleErrorBoundary>} />
                  <Route path="prova-pratica" element={<ModuleErrorBoundary module="prova-pratica"><PracticalExam /></ModuleErrorBoundary>} />
                  <Route path="image-quiz" element={<ModuleErrorBoundary module="image-quiz"><MedicalImageQuiz /></ModuleErrorBoundary>} />
                  <Route path="revisor" element={<ModuleErrorBoundary module="revisor"><MedicalReviewer /></ModuleErrorBoundary>} />
                  <Route path="entrevista" element={<ModuleErrorBoundary module="entrevista"><InterviewSimulator /></ModuleErrorBoundary>} />
                  
                  {/* Estratégia & Progresso */}
                  <Route path="planner" element={<ModuleErrorBoundary module="planner"><SmartPlanner /></ModuleErrorBoundary>} />
                  <Route path="analytics" element={<ModuleErrorBoundary module="analytics"><Analytics /></ModuleErrorBoundary>} />
                  <Route path="perfil" element={<ModuleErrorBoundary module="perfil"><Profile /></ModuleErrorBoundary>} />
                  <Route path="conquistas" element={<ModuleErrorBoundary module="conquistas"><Achievements /></ModuleErrorBoundary>} />
                  <Route path="rankings" element={<Rankings />} />
                  <Route path="diagnostico" element={<Diagnostic />} />
                  <Route path="predictor" element={<PerformancePredictor />} />
                  <Route path="mapa-dominio" element={<MedicalDomainMap />} />
                  <Route path="proficiencia" element={<ModuleErrorBoundary module="proficiencia"><StudentSimulados /></ModuleErrorBoundary>} />
                  <Route path="radar-trajetoria" element={<ModuleErrorBoundary module="radar-trajetoria"><RadarTrajetoriaPage /></ModuleErrorBoundary>} />
                  <Route path="minha-jornada" element={<ModuleErrorBoundary module="jornada"><MedicalAdaptiveJourney /></ModuleErrorBoundary>} />
                  <Route path="agentes" element={<ModuleErrorBoundary module="agentes"><AgentsHub /></ModuleErrorBoundary>} />
                  <Route path="uploads" element={<ModuleErrorBoundary module="uploads"><Uploads /></ModuleErrorBoundary>} />
                  <Route path="coach" element={<ModuleErrorBoundary module="coach"><MotivationalCoach /></ModuleErrorBoundary>} />
                  <Route path="orchestrator-insights" element={<AdminRoute><AdminOrchestratorInsights /></AdminRoute>} />

                  {/* Legado & Redirects Internos */}
                  <Route path="cronograma" element={<PreserveQueryNavigate to="/dashboard/planner" />} />
                  <Route path="cronograma-inteligente" element={<PreserveQueryNavigate to="/dashboard/planner" />} />
                  <Route path="quiz" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo" />} />
                  <Route path="revisoes" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo?focus=reviews" />} />
                  <Route path="revisao" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo?focus=reviews" />} />
                  <Route path="tutor" element={<PreserveQueryNavigate to="/dashboard/sessao-estudo" />} />
                  <Route path="questoes" element={<Navigate to="/dashboard/simulados" replace />} />
                  <Route path="banco-questoes" element={<Navigate to="/dashboard/simulados" replace />} />
                  <Route path="plano-dia" element={<Navigate to="/dashboard" replace />} />
                  <Route path="feynman" element={<Navigate to="/dashboard/chatgpt" replace />} />
                  <Route path="missao" element={<Navigate to="/mission" replace />} />
                  <Route path="minhas-aulas" element={<Navigate to="/dashboard/videoaulas" replace />} />
                  <Route path="simulacao-clinica" element={<Navigate to="/dashboard/plantao" replace />} />
                </Route>

                {/* Fullscreen mind map viewer */}
                <Route path="/dashboard/mapas-mentais/:id" element={<MindMapFullscreen />} />

                {/* --- ENAFLIX HUB --- */}
                <Route path="/enaflix" element={<ProtectedRoute><EnaflixPage /></ProtectedRoute>} />
                <Route path="/enaflix/tudo" element={<ProtectedRoute><EnaflixCatalogPage /></ProtectedRoute>} />

                {/* --- MISSIONS --- */}
                <Route path="/mission" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<MissionMode />} />
                </Route>
                <Route path="/mission-control" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<MissionControlPage />} />
                </Route>
                  <Route path="noc" element={<NOCDashboard />} />

                {/* --- ADMIN (PROTECTED) --- */}
                <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                  <Route index element={<CentroComando />} />
                  <Route path="users" element={<Admin />} />
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
                  <Route path="tutor-video-recommendations" element={<TutorVideoRecommendations />} />
                  <Route path="lessons-memory" element={<AdminLessonsMemory />} />
                  <Route path="telemetry" element={<TelemetryAdmin />} />
                  <Route path="pedagogy-analytics" element={<PedagogyAnalytics />} />
                  <Route path="ai-quality" element={<AIQuality />} />
                  <Route path="incidents/:id" element={<AdminIncidentDetail />} />
                  <Route path="governance" element={<AdminGovernanceLogs />} />
                  <Route path="ai-studio" element={<AIStudio />} />
                  <Route path="medical-review-queue" element={<MedicalReviewQueue />} />
                  <Route path="medical-governance" element={<MedicalGovernanceDashboard />} />
                  <Route path="alerts" element={<TelemetryAdmin />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="audit" element={<AdminAudit />} />
                  <Route path="blueprints" element={<AdminBlueprints />} />
                  <Route path="ai-audit-mode" element={<AIAuditMode />} />
                  <Route path="notebooklm" element={<NotebookLMDashboard />} />
                  <Route path="notebooklm-sync" element={<NotebookLMSync />} />
                  <Route path="notebooklm-analytics" element={<NotebookLMAnalytics />} />
                  <Route path="video-lessons" element={<VideoLessonsAdmin />} />
                  <Route path="video-lessons/:id" element={<VideoLessonDetailsAdmin />} />
                  <Route path="specialty-friction" element={<SpecialtyFrictionReport />} />
                  <Route path="ingestion-provas" element={<OfficialExamIngestion />} />
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
                  <Route path="gpu-fleet" element={<CMEGPUFleet />} />
                  <Route path="render-queues" element={<CMERenderQueues />} />
                  <Route path="cme-observability" element={<CMEObservability />} />
                  <Route path="system-checklist" element={<SystemChecklist />} />
                  <Route path="diagnostico-tutor" element={<DiagnosticTutor />} />
                  <Route path="health" element={<SystemHealth />} />
                  <Route path="cme-media-monitor" element={<CMEMediaMonitor />} />
                  <Route path="builder/:id" element={<CinematicBuilder />} />
                </Route>

                {/* --- PROFESSOR (PROTECTED) --- */}
                <Route path="/dashboard/professor" element={<ProfessorRoute><EnaflixDashboardLayout /></ProfessorRoute>}>
                  <Route index element={<ProfessorDashboard />} />
                  <Route path="simulados/novo" element={<NewProfessorSimuladoPage />} />
                  <Route path="simulados/editar/:id" element={<NewProfessorSimuladoPage />} />
                  <Route path="proficiencia/piloto" element={<ProficiencyPilotPage />} />
                </Route>
                <Route path="/professor" element={<Navigate to="/dashboard/professor" replace />} />
                <Route path="/dashboard/proficiencia/piloto" element={<ProfessorRoute><EnaflixDashboardLayout /></ProfessorRoute>}>
                  <Route index element={<ProficiencyPilotPage />} />
                </Route>

                {/* --- INSTITUCIONAL (PROTECTED) --- */}
                <Route path="/institucional" element={<InstitutionalRoute><EnaflixDashboardLayout /></InstitutionalRoute>}>
                  <Route index element={<InstitutionalDashboard />} />
                </Route>

                {/* --- STUDY SHORTCUTS --- */}
                <Route path="/study/tutor" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<ChatGPT />} />
                </Route>
                <Route path="/study/flashcards" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<Flashcards />} />
                </Route>
                <Route path="/study/simulado" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<Simulados />} />
                </Route>
                <Route path="/study/clinical" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<ClinicalSimulation />} />
                </Route>
                <Route path="/study/anamnese" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                  <Route index element={<AnamnesisTrainer />} />
                </Route>

                {/* --- DEV & UTILS --- */}
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
  </GlobalErrorBoundary>
);
export default App;
