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
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy-load layout shells
const EnaflixDashboardLayout = lazyWithRetry(() => import("./components/layout/EnaflixDashboardLayout"), "EnaflixDashboardLayout");
const AdminLayout = lazyWithRetry(() => import("./components/layout/AdminLayout"), "AdminLayout");


// Lazy-load all pages
const Index = lazyWithRetry(() => import("./pages/Index"), "Index");
const DemoImageQuestions = lazyWithRetry(() => import("./pages/DemoImageQuestions"), "DemoImageQuestions");
const Login = lazyWithRetry(() => import("./pages/Login"), "Login");
const Register = lazyWithRetry(() => import("./pages/Register"), "Register");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard");
const Flashcards = lazyWithRetry(() => import("./pages/Flashcards"), "Flashcards");
const QuestionsBank = lazyWithRetry(() => import("./pages/QuestionsBank"), "QuestionsBank");
const Simulados = lazyWithRetry(() => import("./pages/Simulados"), "Simulados");
const MnemonicGenerator = lazyWithRetry(() => import("./pages/MnemonicStudioPage"), "MnemonicStudioPage");
const Uploads = lazyWithRetry(() => import("./pages/Uploads"), "Uploads");
const QuestionGenerator = lazyWithRetry(() => import("./pages/QuestionGenerator"), "QuestionGenerator");
const ContentSummarizer = lazyWithRetry(() => import("./pages/ContentSummarizer"), "ContentSummarizer");
const MotivationalCoach = lazyWithRetry(() => import("./pages/MotivationalCoach"), "MotivationalCoach");
const AgentsHub = lazyWithRetry(() => import("./pages/AgentsHub"), "AgentsHub");
const Analytics = lazyWithRetry(() => import("./pages/Analytics"), "Analytics");
const Admin = lazyWithRetry(() => import("./pages/Admin"), "Admin");
const Profile = lazyWithRetry(() => import("./pages/Profile"), "Profile");
const PerformancePredictor = lazyWithRetry(() => import("./pages/PerformancePredictor"), "PerformancePredictor");
const Diagnostic = lazyWithRetry(() => import("./pages/Diagnostic"), "Diagnostic");
const ChatGPT = lazyWithRetry(() => import("./pages/ChatGPT"), "ChatGPT");
const ErrorBank = lazyWithRetry(() => import("./pages/ErrorBank"), "ErrorBank");
const MedicalDomainMap = lazyWithRetry(() => import("./pages/MedicalDomainMap"), "MedicalDomainMap");
const ProfessorDashboard = lazyWithRetry(() => import("./pages/ProfessorDashboard"), "ProfessorDashboard");
const NewProfessorSimuladoPage = lazyWithRetry(() => import("./pages/NewProfessorSimuladoPage"), "NewProfessorSimuladoPage");
const StudentSimulados = lazyWithRetry(() => import("./pages/StudentSimulados"), "StudentSimulados");
const DiscursiveQuestions = lazyWithRetry(() => import("./pages/DiscursiveQuestions"), "DiscursiveQuestions");
const ClinicalSimulation = lazyWithRetry(() => import("./pages/ClinicalSimulation"), "ClinicalSimulation");
const Achievements = lazyWithRetry(() => import("./pages/Achievements"), "Achievements");
const MedicalReviewer = lazyWithRetry(() => import("./pages/MedicalReviewer"), "MedicalReviewer");
const InterviewSimulator = lazyWithRetry(() => import("./pages/InterviewSimulator"), "InterviewSimulator");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");
const AnamnesisTrainer = lazyWithRetry(() => import("./pages/AnamnesisTrainer"), "AnamnesisTrainer");
const Settings = lazyWithRetry(() => import("./pages/Settings"), "Settings");
const Install = lazyWithRetry(() => import("./pages/Install"), "Install");
const StudyGuides = lazyWithRetry(() => import("./pages/StudyGuides"), "StudyGuides");
const MedicalChronicles = lazyWithRetry(() => import("./pages/MedicalChronicles"), "MedicalChronicles");
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"), "ForgotPassword");
const Terms = lazyWithRetry(() => import("./pages/Terms"), "Terms");
const Privacy = lazyWithRetry(() => import("./pages/Privacy"), "Privacy");
const FeynmanTrainer = lazyWithRetry(() => import("./pages/ContentSummarizer"), "ContentSummarizer");

const AIMentor = lazyWithRetry(() => import("./pages/AIMentor"), "AIMentor");
const SmartPlanner = lazyWithRetry(() => import("./pages/SmartPlanner"), "SmartPlanner");
const AdminMonitoring = lazyWithRetry(() => import("./pages/AdminMonitoring"), "AdminMonitoring");
const AdminCEO = lazyWithRetry(() => import("./pages/AdminCEO"), "AdminCEO");
const MissionMode = lazyWithRetry(() => import("./pages/MissionMode"), "MissionMode");
const StudySession = lazyWithRetry(() => import("./pages/StudySession"), "StudySession");
const Rankings = lazyWithRetry(() => import("./pages/Rankings"), "Rankings");
const MedicalImageQuiz = lazyWithRetry(() => import("./pages/MedicalImageQuiz"), "MedicalImageQuiz");
const PracticalExam = lazyWithRetry(() => import("./pages/PracticalExam"), "PracticalExam");
const InstitutionalDashboard = lazyWithRetry(() => import("./pages/InstitutionalDashboard"), "InstitutionalDashboard");
const Enaflix = lazyWithRetry(() => import("./pages/Enaflix"), "Enaflix");
const EnaflixPage = lazyWithRetry(() => import("./pages/EnaflixPage"), "EnaflixPage");

const VideoLessonsExplore = lazyWithRetry(() => import("./pages/VideoLessonsExplore"), "VideoLessonsExplore");
const VideoLessonPlayer = lazyWithRetry(() => import("./pages/VideoLessonPlayer"), "VideoLessonPlayer");
const VideoLessonsLibrary = lazyWithRetry(() => import("./pages/VideoLessonsLibrary"), "VideoLessonsLibrary");

const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"), "ResetPassword");
const Favoritos = lazyWithRetry(() => import("./pages/Favoritos"), "Favoritos");
const Historico = lazyWithRetry(() => import("./pages/Historico"), "Historico");

const PageLoader = () => (
  <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 space-y-6 animate-in fade-in duration-500">
    <div className="relative">
      <div className="h-16 w-16 rounded-full border-t-2 border-primary animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary animate-pulse" />
      </div>
    </div>
    <div className="text-center space-y-2">
      <h2 className="text-lg font-black uppercase tracking-widest text-white/80 animate-pulse">ENAZIZI</h2>
      <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">Sincronizando Ecossistema Cognitivo</p>
    </div>
    <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full bg-primary/40 animate-progress-loading" />
    </div>
  </div>
);


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/signup" element={<Navigate to="/register" replace />} />
              <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
              
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              
              <Route path="/chatgpt" element={<Navigate to="/dashboard/chatgpt" replace />} />
              <Route path="/mentor-ai" element={<Navigate to="/dashboard/chatgpt" replace />} />
              <Route path="/ai-mentor" element={<Navigate to="/dashboard/chatgpt" replace />} />
              <Route path="/study" element={<Navigate to="/dashboard/cronograma" replace />} />
              <Route path="/study-session" element={<Navigate to="/dashboard/chatgpt" replace />} />
              <Route path="/simulations" element={<Navigate to="/dashboard/simulados" replace />} />
              <Route path="/questions" element={<Navigate to="/dashboard/questoes" replace />} />
              <Route path="/planner" element={<Navigate to="/dashboard/cronograma" replace />} />
              <Route path="/flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
              <Route path="/errors" element={<Navigate to="/dashboard/banco-erros" replace />} />
              <Route path="/bank-errors" element={<Navigate to="/dashboard/banco-erros" replace />} />
              <Route path="/performance" element={<Navigate to="/dashboard/analytics" replace />} />
              <Route path="/profile" element={<Navigate to="/dashboard/perfil" replace />} />
<Route path="/settings" element={<Navigate to="/dashboard/perfil" replace />} />
<Route path="/enaflix" element={<EnaflixPage />} />
              
              <Route path="/teacher" element={<Navigate to="/professor" replace />} />
              <Route path="/teacher/*" element={<Navigate to="/professor" replace />} />

              <Route path="/demo-questoes-imagem" element={<DemoImageQuestions />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                
                {/* Rotas Reais de Funcionalidades */}
                <Route path="planner" element={<SmartPlanner />} />
                <Route path="sessao-estudo" element={<StudySession />} />
                <Route path="simulados" element={<Simulados />} />
                <Route path="flashcards" element={<Flashcards />} />
                <Route path="banco-erros" element={<ErrorBank />} />
                <Route path="chatgpt" element={<ChatGPT />} />
                <Route path="mentor" element={<AIMentor />} />
                <Route path="agentes" element={<AgentsHub />} />
                <Route path="banco-questoes" element={<QuestionsBank />} />
                <Route path="gerador-questoes" element={<QuestionGenerator />} />
                <Route path="resumos" element={<ContentSummarizer />} />
                <Route path="apostilas" element={<StudyGuides />} />
                <Route path="videoaulas" element={<VideoLessonsLibrary />} />
                <Route path="videoaulas/explorar" element={<VideoLessonsExplore />} />
                <Route path="videoaulas/:id" element={<VideoLessonPlayer />} />
                <Route path="enaflix" element={<Enaflix />} />
                <Route path="uploads" element={<Uploads />} />
                <Route path="diagnostico" element={<Diagnostic />} />
                <Route path="simulacao-clinica" element={<ClinicalSimulation />} />
                <Route path="anamnese" element={<AnamnesisTrainer />} />
                <Route path="cronicas" element={<MedicalChronicles />} />
                <Route path="image-quiz" element={<MedicalImageQuiz />} />
                <Route path="prova-pratica" element={<PracticalExam />} />
                <Route path="feynman" element={<FeynmanTrainer />} />
                <Route path="mnemonico" element={<ModuleGuard moduleKey="mnemonico"><MnemonicGenerator /></ModuleGuard>} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="predictor" element={<PerformancePredictor />} />
                <Route path="mapa-dominio" element={<MedicalDomainMap />} />
                <Route path="proficiencia" element={<StudentSimulados />} />
                <Route path="coach" element={<MotivationalCoach />} />
                <Route path="rankings" element={<Rankings />} />
                <Route path="revisor" element={<MedicalReviewer />} />
                <Route path="entrevista" element={<InterviewSimulator />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="configuracoes" element={<Settings />} />
                <Route path="favoritos" element={<Favoritos />} />
                <Route path="historico" element={<Historico />} />

                {/* Redirecionamentos de conveniência / Legados */}
                <Route path="home" element={<Navigate to="/dashboard" replace />} />
                <Route path="cronograma" element={<Navigate to="/dashboard/planner" replace />} />
                <Route path="plano-estudos" element={<Navigate to="/dashboard/planner" replace />} />
                <Route path="revisoes" element={<Navigate to="/dashboard/planner" replace />} />
                <Route path="estudar" element={<Navigate to="/dashboard/chatgpt" replace />} />
                <Route path="tutor" element={<Navigate to="/dashboard/chatgpt" replace />} />
                <Route path="chat" element={<Navigate to="/dashboard/chatgpt" replace />} />
                <Route path="simulado" element={<Navigate to="/dashboard/simulados" replace />} />
                <Route path="questoes" element={<Navigate to="/dashboard/simulados" replace />} />
                <Route path="error-bank" element={<Navigate to="/dashboard/banco-erros" replace />} />
                <Route path="desempenho" element={<Navigate to="/dashboard/analytics" replace />} />
                <Route path="performance" element={<Navigate to="/dashboard/analytics" replace />} />
                <Route path="notificacoes" element={<Navigate to="/dashboard" replace />} />
                <Route path="missao" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
                <Route path="plano-dia" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
                <Route path="gerar-flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
              </Route>
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<Admin />} />
                <Route path="users" element={<Admin initialTab="users-all" />} />
                <Route path="usuarios" element={<Admin initialTab="users-all" />} />
                <Route path="pending" element={<Admin initialTab="users-pending" />} />
                <Route path="whatsapp" element={<Admin initialTab="integrations" />} />
                <Route path="audit" element={<Admin initialTab="audit" />} />
                <Route path="logs" element={<Admin initialTab="audit" />} />
                <Route path="stats" element={<Admin initialTab="overview" />} />
                <Route path="analytics" element={<Admin initialTab="overview" />} />
                <Route path="settings" element={<Admin initialTab="features" />} />
                <Route path="flags" element={<Admin initialTab="features" />} />
                <Route path="health" element={<Admin initialTab="intelligence-overview" />} />
                <Route path="system" element={<Admin initialTab="features" />} />
                <Route path="content" element={<Admin initialTab="uploads" />} />
                <Route path="conteudo" element={<Admin initialTab="uploads" />} />
                <Route path="questions" element={<Admin initialTab="ingestion" />} />
                <Route path="questoes" element={<Admin initialTab="ingestion" />} />
                <Route path="ingestion" element={<Admin initialTab="ingestion" />} />
                <Route path="ingestao" element={<Admin initialTab="ingestion" />} />
                <Route path="telemetry" element={<Admin initialTab="intelligence-overview" />} />
                <Route path="monitoring" element={<AdminMonitoring />} />
                <Route path="ceo" element={<AdminCEO />} />
              </Route>
              <Route path="/professor" element={<ProfessorRoute><EnaflixDashboardLayout /></ProfessorRoute>}>
                <Route index element={<ProfessorDashboard />} />
                <Route path="simulados" element={<ProfessorDashboard initialTab="simulados" />} />
                <Route path="plantao" element={<ProfessorDashboard initialTab="operacional" />} />
                <Route path="video" element={<ProfessorDashboard initialTab="turmas" />} />
                <Route path="sala" element={<ProfessorDashboard initialTab="turmas" />} />
                <Route path="alunos" element={<ProfessorDashboard initialTab="operacional" />} />
                <Route path="turmas" element={<ProfessorDashboard initialTab="turmas" />} />
                <Route path="analytics" element={<ProfessorDashboard initialTab="turmas" />} />
                <Route path="relatorios" element={<ProfessorDashboard initialTab="turmas" />} />
                <Route path="questoes" element={<ProfessorDashboard initialTab="simulados" />} />
                <Route path="materiais" element={<ProfessorDashboard initialTab="mentoria" />} />
                <Route path="simulados/novo" element={<NewProfessorSimuladoPage />} />
                <Route path="simulados/editar/:id" element={<NewProfessorSimuladoPage />} />
              </Route>
              <Route path="/institucional" element={<InstitutionalRoute><EnaflixDashboardLayout /></InstitutionalRoute>}>
                <Route index element={<InstitutionalDashboard />} />
              </Route>
              <Route path="/mission" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                <Route index element={<MissionMode />} />
              </Route>
              <Route path="/enaflix" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                <Route index element={<EnaflixPage />} />
                <Route path="*" element={<EnaflixPage />} />
              </Route>
              <Route path="/study-hub" element={<Navigate to="/enaflix" replace />} />
              {/* Canonical redirects — /study/* → /dashboard/* */}
              <Route path="/study/tutor" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
              <Route path="/study/flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
              <Route path="/study/simulado" element={<Navigate to="/dashboard/simulados" replace />} />
              <Route path="/study/clinical" element={<Navigate to="/dashboard/simulacao-clinica" replace />} />
              <Route path="/study/anamnese" element={<Navigate to="/dashboard/anamnese" replace />} />
              <Route path="/study/banco-erros" element={<Navigate to="/dashboard/banco-erros" replace />} />
              <Route path="/study/erros" element={<Navigate to="/dashboard/banco-erros" replace />} />
              <Route path="/mission" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
              <Route path="/daily-plan" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
              <Route path="/install" element={<Install />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
              <Route path="/teacher/dashboard" element={<Navigate to="/professor" replace />} />
              <Route path="/teacher/turmas" element={<Navigate to="/professor/turmas" replace />} />
              <Route path="/teacher/alunos" element={<Navigate to="/professor/alunos" replace />} />
              <Route path="/teacher/simulados" element={<Navigate to="/professor/simulados" replace />} />
              <Route path="/teacher/questoes" element={<Navigate to="/professor/questoes" replace />} />
              <Route path="/teacher/relatorios" element={<Navigate to="/professor/relatorios" replace />} />
              <Route path="/teacher/materiais" element={<Navigate to="/professor/materiais" replace />} />
              <Route path="/teacher/plantao" element={<Navigate to="/professor/plantao" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </MedicalTermProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);
export default App;
