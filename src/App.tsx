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
const FlashcardGenerator = lazyWithRetry(() => import("./pages/FlashcardGenerator"), "FlashcardGenerator");
const MnemonicGenerator = lazyWithRetry(() => import("./pages/MnemonicStudioPage"), "MnemonicStudioPage");
const Simulados = lazyWithRetry(() => import("./pages/Simulados"), "Simulados");
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
const Install = lazyWithRetry(() => import("./pages/Install"), "Install");
const StudyGuides = lazyWithRetry(() => import("./pages/StudyGuides"), "StudyGuides");
const MedicalChronicles = lazyWithRetry(() => import("./pages/MedicalChronicles"), "MedicalChronicles");
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
const EnaflixPage = lazyWithRetry(() => import("./pages/EnaflixPage"), "EnaflixPage");

const VideoLessonsExplore = lazyWithRetry(() => import("./pages/VideoLessonsExplore"), "VideoLessonsExplore");
const VideoLessonPlayer = lazyWithRetry(() => import("./pages/VideoLessonPlayer"), "VideoLessonPlayer");
const VideoLessonsLibrary = lazyWithRetry(() => import("./pages/VideoLessonsLibrary"), "VideoLessonsLibrary");

const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"), "ResetPassword");

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
               <Route path="/demo-questoes-imagem" element={<DemoImageQuestions />} />
               <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute><EnaflixDashboardLayout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="cronograma" element={<Navigate to="/dashboard/planner" replace />} />
                <Route path="planner" element={<SmartPlanner />} />
                <Route path="sessao-estudo" element={<StudySession />} />
                <Route path="simulados" element={<Simulados />} />
                <Route path="flashcards" element={<Flashcards />} />
                <Route path="banco-erros" element={<ErrorBank />} />
                
                <Route path="agentes" element={<AgentsHub />} />
                <Route path="banco-questoes" element={<QuestionsBank />} />
                <Route path="gerador-questoes" element={<QuestionGenerator />} />
                <Route path="resumos" element={<ContentSummarizer />} />
                <Route path="apostilas" element={<StudyGuides />} />
                
                <Route path="coach" element={<MotivationalCoach />} />
                <Route path="predictor" element={<PerformancePredictor />} />
                <Route path="diagnostico" element={<Diagnostic />} />
                
                <Route path="mapa-dominio" element={<MedicalDomainMap />} />
                <Route path="proficiencia" element={<StudentSimulados />} />
                <Route path="simulacao-clinica" element={<ClinicalSimulation />} />
                <Route path="revisor" element={<MedicalReviewer />} />
                <Route path="entrevista" element={<InterviewSimulator />} />
                <Route path="anamnese" element={<AnamnesisTrainer />} />
                <Route path="cronicas" element={<MedicalChronicles />} />
                <Route path="feynman" element={<FeynmanTrainer />} />
                <Route path="mentor" element={<AIMentor />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="perfil" element={<Profile />} />
                <Route path="image-quiz" element={<MedicalImageQuiz />} />
                <Route path="rankings" element={<Rankings />} />
                <Route path="prova-pratica" element={<PracticalExam />} />
                <Route path="mnemonico" element={<ModuleGuard moduleKey="mnemonico"><MnemonicGenerator /></ModuleGuard>} />
                <Route path="videoaulas" element={<VideoLessonsLibrary />} />
                <Route path="videoaulas/explorar" element={<VideoLessonsExplore />} />
                <Route path="videoaulas/:id" element={<VideoLessonPlayer />} />
                
                {/* Redirecionamentos Legados / MVP Cleanup */}
                <Route path="missao" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
                <Route path="plano-dia" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
                <Route path="gerar-flashcards" element={<Navigate to="/dashboard/flashcards" replace />} />
                <Route path="questoes" element={<Navigate to="/dashboard/simulados" replace />} />
                <Route path="tutor" element={<Navigate to="/dashboard/sessao-estudo" replace />} />
                <Route path="uploads" element={<Uploads />} />
              </Route>
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<Admin />} />
                <Route path="users" element={<Navigate to="/admin?tab=users-all" replace />} />
                <Route path="monitoring" element={<AdminMonitoring />} />
                <Route path="ceo" element={<AdminCEO />} />
              </Route>
              <Route path="/professor" element={<ProfessorRoute><EnaflixDashboardLayout /></ProfessorRoute>}>
                <Route index element={<ProfessorDashboard />} />
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
