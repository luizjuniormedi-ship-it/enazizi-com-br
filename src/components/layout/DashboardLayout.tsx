import { Outlet } from "react-router-dom";
import { SessionMemoryProvider } from "@/contexts/SessionMemoryContext";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useJourneyRefresh } from "@/hooks/useJourneyRefresh";
import { useLandscapeTablet } from "@/hooks/useLandscapeTablet";
import { useAlertTelemetry } from "@/hooks/useAlertTelemetry";
import { useAlertResolutionTracker } from "@/hooks/useAlertResolutionTracker";
import DashboardSidebar from "./DashboardSidebar";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { Menu, LogOut, User, Shield, GraduationCap, Sun, Moon, ChevronDown, Brain, BarChart3, Building2,
  Rocket, Lightbulb, FlipVertical, BookOpen, FileText, CalendarDays, Stethoscope, Siren, PenTool, Image,
  Trophy, Crown, Bot, TrendingUp, Map, AlertTriangle, Sparkles, BookMarked, Clock, Briefcase, Target, Zap
} from "lucide-react";
import StudyTimer from "@/components/dashboard/StudyTimer";
import BottomTabBar from "./BottomTabBar";
import enazizi from "@/assets/enazizi-mascot.png";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useInstitution } from "@/hooks/useInstitution";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/hooks/useTheme";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import ActiveVideoRoomPopup from "@/components/dashboard/ActiveVideoRoomPopup";
import TutorDrawer from "@/components/tutor/TutorDrawer";
import ProficiencyGate from "@/components/dashboard/ProficiencyGate";
import { useInvisibleMnemonic } from "@/hooks/useInvisibleMnemonic";
import { InvisibleMnemonicOverlay } from "@/components/mnemonic/InvisibleMnemonicOverlay";
import ForceUpdateButton from "@/components/layout/ForceUpdateButton";
import { useStudyContext } from "@/lib/studyContext";

interface MobileNavGroup {
  title: string;
  items: { to: string; label: string; moduleKey: string }[];
}

const mobileNavGroups: MobileNavGroup[] = [
  {
    title: "Principal",
    items: [
      { to: "/dashboard", label: "🚀 Dashboard", moduleKey: "dashboard" },
      { to: "/dashboard?autostart=true&source=sidebar", label: "⚡ Começar Agora", moduleKey: "dashboard" },
    ],
  },
  {
    title: "Avaliação",
    items: [
      { to: "/dashboard/simulados", label: "📝 Simulados", moduleKey: "simulados" },
      { to: "/dashboard/image-quiz", label: "🖼️ Questões com Imagem", moduleKey: "image-quiz" },
      { to: "/dashboard/gerador-questoes", label: "💡 Gerador Questões", moduleKey: "questoes" },
      { to: "/dashboard/discursivas", label: "✍️ Discursivas", moduleKey: "discursivas" },
      { to: "/dashboard/prova-pratica", label: "🩺 Prova Prática", moduleKey: "prova-pratica" },
    ],
  },
  {
    title: "Treino & Revisão",
    items: [
      { to: "/dashboard/flashcards", label: "🃏 Flashcards", moduleKey: "flashcards" },
      { to: "/dashboard/gerar-flashcards", label: "⚡ Gerador Flashcards", moduleKey: "gerar-flashcards" },
      { to: "/dashboard/mnemonic-studio-v2", label: "🧠 Mnemônico", moduleKey: "mnemonico" },
      { to: "/dashboard/banco-erros", label: "🚨 Banco de Erros", moduleKey: "banco-erros" },
      { to: "/dashboard/sessao-estudo", label: "📖 Sessão de Estudo", moduleKey: "sessao-estudo" },
    ],
  },
  {
    title: "Clínica & Simulação",
    items: [
      { to: "/dashboard/anamnese", label: "🩺 Anamnese", moduleKey: "anamnese" },
      { to: "/dashboard/plantao", label: "🚨 Plantão", moduleKey: "plantao" },
      { to: "/dashboard/simulacao-clinica", label: "🏥 Simulação Clínica", moduleKey: "simulacao-clinica" },
      { to: "/dashboard/entrevista", label: "🎤 Entrevista", moduleKey: "entrevista" },
    ],
  },
  {
    title: "Conteúdo & Estudo",
    items: [
      { to: "/dashboard/chatgpt", label: "✨ Tutor IA", moduleKey: "chatgpt" },
      { to: "/dashboard/resumos", label: "📖 Resumos", moduleKey: "resumos" },
      { to: "/dashboard/apostilas", label: "📚 Apostilas", moduleKey: "apostilas" },
      { to: "/dashboard/cronicas", label: "📖 Crônicas Médicas", moduleKey: "cronicas" },
      { to: "/dashboard/mapas-mentais", label: "🧠 Mapas Mentais", moduleKey: "mapas-mentais" },
      { to: "/dashboard/mentor", label: "🤖 Mentor IA", moduleKey: "mentor" },
      { to: "/dashboard/revisor", label: "📋 Revisor Médico", moduleKey: "revisor" },
    ],
  },
  {
    title: "Progresso & Estratégia",
    items: [
      { to: "/dashboard/analytics", label: "📊 Analytics", moduleKey: "analytics" },
      { to: "/dashboard/mapa-dominio", label: "🗺️ Mapa de Evolução", moduleKey: "mapa-dominio" },
      { to: "/dashboard/predictor", label: "📈 Previsão", moduleKey: "predictor" },
      { to: "/dashboard/proficiencia", label: "🎓 Proficiência", moduleKey: "proficiencia" },
      { to: "/dashboard/diagnostico", label: "🩺 Nivelamento", moduleKey: "diagnostico" },
      { to: "/dashboard/planner", label: "📅 Plano Estratégico", moduleKey: "planner" },
      { to: "/dashboard/coach", label: "💪 Coach", moduleKey: "coach" },
    ],
  },
  {
    title: "Gamificação",
    items: [
      { to: "/dashboard/conquistas", label: "🏆 Conquistas", moduleKey: "conquistas" },
      { to: "/dashboard/rankings", label: "👑 Rankings", moduleKey: "rankings" },
      { to: "/dashboard/missao", label: "🎯 Modo Missão", moduleKey: "missao" },
    ],
  },
  {
    title: "Conta",
    items: [
      { to: "/dashboard/perfil", label: "👤 Meu Perfil", moduleKey: "perfil" },
    ],
  },
];

const MobileNavGroupSection = ({
  group,
  location,
  setOpen,
  isModuleEnabled,
  isAdmin,
}: {
  group: MobileNavGroup;
  location: ReturnType<typeof useLocation>;
  setOpen: (v: boolean) => void;
  isModuleEnabled: (key: string) => boolean;
  isAdmin: boolean;
}) => {
  const filteredItems = group.items.filter((item) => {
    if (item.moduleKey === "perfil") return true;
    return isModuleEnabled(item.moduleKey);
  });

  const hasActive = filteredItems.some((item) => location.pathname === item.to);
  const [isOpen, setIsOpen] = useState(hasActive || group.title === "Principal");

  if (filteredItems.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider",
          hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"
        )}
      >
        {group.title}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "" : "-rotate-90")} />
      </button>
      {isOpen &&
        filteredItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.to
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70"
            )}
          >
            {item.label}
          </Link>
        ))}
    </div>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { isModuleEnabled } = useModuleAccess();
  const { isStaff: isInstitutionalStaff } = useInstitution();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="landscape-tablet:hidden lg:hidden p-2"><Menu className="h-6 w-6" /></button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar border-sidebar-border w-72 p-0 flex flex-col">
        <VisuallyHidden>
          <SheetTitle>Menu de navegação</SheetTitle>
          <SheetDescription>Navegação principal do ENAZIZI</SheetDescription>
        </VisuallyHidden>
        <div className="p-6 border-b border-sidebar-border flex-shrink-0">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src={enazizi} alt="ENAZIZI" className="h-7 w-7 rounded-lg object-cover" />
            <span className="font-bold">ENAZIZI</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <nav className="px-3 py-2 space-y-2">
            {mobileNavGroups.map((group) => (
              <MobileNavGroupSection key={group.title} group={group} location={location} setOpen={setOpen} isModuleEnabled={isModuleEnabled} isAdmin={!adminLoading && isAdmin} />
            ))}
            <div className="pt-3 mt-3 border-t border-sidebar-border space-y-1">
              {(isProfessor || isAdmin) && (
                <Link to="/professor" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", location.pathname === "/professor" ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70")}>
                  <GraduationCap className="h-4 w-4" /> Painel Professor
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link to="/admin" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", location.pathname === "/admin" ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70")}>
                    <Shield className="h-4 w-4" /> Admin
                  </Link>
                  <Link to="/admin/ceo" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", location.pathname === "/admin/ceo" ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70")}>
                    <BarChart3 className="h-4 w-4" /> Painel CEO
                  </Link>
                </>
              )}
              {isInstitutionalStaff && (
                <Link to="/institucional" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", location.pathname === "/institucional" ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70")}>
                  <Building2 className="h-4 w-4" /> Painel Institucional
                </Link>
              )}
              <ForceUpdateButton variant="menu" onAfterClick={() => setOpen(false)} />
              <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors w-full">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          </nav>
        </ScrollArea>
        <div className="border-t border-sidebar-border flex-shrink-0">
          <StudyTimer />
        </div>
      </SheetContent>
    </Sheet>
  );
};

const DashboardLayout = () => {
  usePresenceHeartbeat();
  useJourneyRefresh();
  useLandscapeTablet();
  // Alert Orchestrator — telemetria automática (Fase 4)
  // Registra exposições e supressões em `alert_events` (fire-and-forget).
  useAlertTelemetry();
  // Resolution tracker — registra `resolved` quando estado do usuário melhora
  useAlertResolutionTracker();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const studyCtx = useStudyContext();
  const { mnemonic: invisibleMnemonic, dismiss: dismissMnemonic, markShown } = useInvisibleMnemonic({
    currentTopic: studyCtx?.topic,
    enabled: true,
  });

  const isMissionLocked = (() => {
    const isMissionRoute = location.pathname === "/dashboard/missao" || location.pathname === "/mission" || location.pathname.startsWith("/study/");
    const params = new URLSearchParams(location.search);
    const fromMission = params.get("sc_origin") === "mission" || params.get("tutor_mode") === "mission";
    return isMissionRoute || fromMission;
  })();

  return (
  <SessionMemoryProvider>
  <div className="flex min-h-[100dvh] min-h-screen bg-background w-full overflow-hidden">
    {!isMissionLocked && <DashboardSidebar />}
    <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
      {!isMissionLocked && (
        <header className="landscape-tablet:hidden lg:hidden h-14 border-b border-border flex items-center px-3 sm:px-4 gap-2 sm:gap-3 flex-shrink-0">
          <MobileNav />
          <img src={enazizi} alt="ENAZIZI" className="h-6 w-6 rounded object-cover flex-shrink-0" />
          <span className="font-bold text-sm truncate">ENAZIZI</span>
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <GlobalSearch />
            <NotificationBell />
            <button onClick={toggleTheme} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
      )}
      {!isMissionLocked && (
        <div className="hidden landscape-tablet:flex lg:flex h-12 border-b border-border items-center justify-end px-4 gap-2 flex-shrink-0">
          <GlobalSearch />
          <NotificationBell />
          <button onClick={toggleTheme} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm" aria-label="Alternar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden xl:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
          </button>
        </div>
      )}
      <main className={cn(
        "dashboard-main flex-1 overflow-x-hidden overflow-y-auto relative w-full min-h-0 min-w-0 flex flex-col",
        isMissionLocked ? "p-0" : "p-3 sm:p-4 md:p-6 lg:p-8"
      )}>
        {!isMissionLocked && <ProficiencyGate />}
        {!isMissionLocked && <ActiveVideoRoomPopup />}
        <div key={location.pathname} className={cn(
          "animate-fade-in relative z-10 w-full max-w-full flex-1 min-w-0 min-h-0 flex flex-col",
          isMissionLocked ? "" : "pb-16 lg:pb-0"
        )}>
          <Outlet />
        </div>
        {invisibleMnemonic && (
          <InvisibleMnemonicOverlay mnemonic={invisibleMnemonic} onDismiss={dismissMnemonic} onShown={markShown} />
        )}
      </main>
      {!isMissionLocked && <BottomTabBar />}
    </div>
    {/* F4 — Contextual Tutor IA drawer (global, openable from any module) */}
    <TutorDrawer />
  </div>
  </SessionMemoryProvider>
  );
};

export default DashboardLayout;
