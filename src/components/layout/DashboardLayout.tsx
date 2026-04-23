import { Outlet } from "react-router-dom";
import { SessionMemoryProvider } from "@/contexts/SessionMemoryContext";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useJourneyRefresh } from "@/hooks/useJourneyRefresh";
import { useLandscapeTablet } from "@/hooks/useLandscapeTablet";
import { useAlertTelemetry } from "@/hooks/useAlertTelemetry";
import { useAlertResolutionTracker } from "@/hooks/useAlertResolutionTracker";
import { useTimeToAction } from "@/hooks/useTimeToAction";
import DashboardSidebar from "./DashboardSidebar";
import GlobalSearch from "./GlobalSearch";
import NotificationBell from "@/components/dashboard/NotificationBell";
import { Menu, LogOut, User, Shield, GraduationCap, Sun, Moon, ChevronDown, Brain, BarChart3, Building2,
  Rocket, Lightbulb, FlipVertical, BookOpen, FileText, CalendarDays, Stethoscope, Siren, PenTool, Image,
  Trophy, Crown, Bot, TrendingUp, Map, AlertTriangle, Sparkles, BookMarked, Clock, Briefcase, Target, Zap,
  Clapperboard
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
import { EnaflixButton } from "@/components/enaflix/EnaflixButton";
import { EnaflixBackButton } from "@/components/enaflix/EnaflixBackButton";
import { useScrolled } from "@/hooks/useScrolled";

/* ─────────────── Mobile sheet — espelho da sidebar minimalista ───────────────
 * 4 áreas alinhadas com desktop:
 *   1. Foco agora     — Hoje + Estudar agora
 *   2. Núcleo         — Revisões, Simulados, Erros, Progresso
 *   3. Explorar       — ENAFLIX (CTA único, silencioso)
 *   4. Conta          — Perfil, Professor/Admin/Institucional, Sair
 * Sem emoji. Sem 30 itens. Tudo o que sumiu daqui está no /enaflix.
 */
interface MobileNavItem {
  to: string;
  label: string;
  moduleKey?: string;
  icon: React.ElementType;
}

// Visão Geral = panorama (entender). Estudar = execução (fazer).
const MOBILE_PANORAMA_ITEMS: MobileNavItem[] = [
  { to: "/dashboard", label: "Visão Geral", icon: Target },
];

const MOBILE_EXECUTION_ITEMS: MobileNavItem[] = [
  { to: "/dashboard/sessao-estudo", label: "Estudar", moduleKey: "sessao-estudo", icon: Sparkles },
  { to: "/dashboard/flashcards", label: "Revisões", moduleKey: "flashcards", icon: Clock },
  { to: "/dashboard/simulados", label: "Simulados", moduleKey: "simulados", icon: FileText },
  { to: "/dashboard/banco-erros", label: "Banco de Erros", moduleKey: "banco-erros", icon: AlertTriangle },
];

const MobileSection = ({
  title,
  items,
  location,
  setOpen,
  isModuleEnabled,
}: {
  title: string;
  items: MobileNavItem[];
  location: ReturnType<typeof useLocation>;
  setOpen: (v: boolean) => void;
  isModuleEnabled: (key: string) => boolean;
}) => {
  const filtered = items.filter((i) => !i.moduleKey || isModuleEnabled(i.moduleKey));
  if (filtered.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
        {title}
      </div>
      {filtered.map((item) => {
        const [path, search] = item.to.split("?");
        const active =
          location.pathname === path &&
          (!search || location.search.includes(search));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
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

  const onEnaflix = location.pathname.startsWith("/enaflix");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="landscape-tablet:hidden lg:hidden p-2" aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar border-sidebar-border w-72 p-0 flex flex-col">
        <VisuallyHidden>
          <SheetTitle>Menu de navegação</SheetTitle>
          <SheetDescription>Navegação principal do ENAZIZI</SheetDescription>
        </VisuallyHidden>

        <div className="p-5 border-b border-sidebar-border flex-shrink-0">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src={enazizi} alt="ENAZIZI" className="h-7 w-7 rounded-lg object-cover" />
            <span className="font-bold tracking-[0.14em] text-[14px]">ENAZIZI</span>
          </Link>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <nav className="px-3 py-3 space-y-3">
            <MobileSection title="Panorama" items={MOBILE_PANORAMA_ITEMS} location={location} setOpen={setOpen} isModuleEnabled={isModuleEnabled} />
            <MobileSection title="Estudar" items={MOBILE_EXECUTION_ITEMS} location={location} setOpen={setOpen} isModuleEnabled={isModuleEnabled} />

            {/* Explorar — ENAFLIX único, silencioso */}
            <div className="space-y-0.5">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
                Explorar
              </div>
              <Link
                to="/enaflix"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                  onEnaflix
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/40",
                )}
              >
                <Clapperboard className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">ENAFLIX</span>
                <ChevronDown className="ml-auto h-4 w-4 -rotate-90 opacity-40" />
              </Link>
              <p className="px-3 pt-1 text-[11px] text-muted-foreground/55 leading-snug">
                Hub visual: flashcards, mnemônicos, anamnese, OSCE, mapas, analytics e mais.
              </p>
            </div>

            {/* Conta */}
            <div className="pt-3 mt-2 border-t border-sidebar-border space-y-0.5">
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
                Conta
              </div>
              <Link
                to="/dashboard/perfil"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                  location.pathname === "/dashboard/perfil"
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40",
                )}
              >
                <User className="h-4 w-4" /> Meu Perfil
              </Link>
              {(isProfessor || isAdmin) && (
                <Link
                  to="/professor"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                    location.pathname === "/professor"
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40",
                  )}
                >
                  <GraduationCap className="h-4 w-4" /> Painel Professor
                </Link>
              )}
              {!adminLoading && isAdmin && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                      location.pathname === "/admin"
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40",
                    )}
                  >
                    <Shield className="h-4 w-4" /> Admin
                  </Link>
                  <Link
                    to="/admin/ceo"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                      location.pathname === "/admin/ceo"
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40",
                    )}
                  >
                    <BarChart3 className="h-4 w-4" /> Painel CEO
                  </Link>
                </>
              )}
              {isInstitutionalStaff && (
                <Link
                  to="/institucional"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors",
                    location.pathname === "/institucional"
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40",
                  )}
                >
                  <Building2 className="h-4 w-4" /> Institucional
                </Link>
              )}
              <ForceUpdateButton variant="menu" onAfterClick={() => setOpen(false)} />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-sidebar-foreground/70 hover:bg-sidebar-accent/40 transition-colors w-full"
              >
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
  // Sprint 4 — Telemetria de tempo-até-ação (login → primeira ação real)
  useTimeToAction();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const studyCtx = useStudyContext();
  const scrolled = useScrolled(8);
  const { mnemonic: invisibleMnemonic, dismiss: dismissMnemonic, markShown } = useInvisibleMnemonic({
    currentTopic: studyCtx?.topic,
    enabled: true,
  });

  // Modo foco — sidebar e header somem para imersão total.
  // Cobre: missão, sessão de estudo, ENAFLIX, simulação clínica imersiva,
  // anamnese, OSCE/prova prática e plantão. Tudo o que pede zero distração.
  const isMissionLocked = (() => {
    const path = location.pathname;
    const focusRoutes = [
      "/dashboard/missao",
      "/mission",
      "/dashboard/anamnese",
      "/dashboard/plantao",
      "/dashboard/simulacao-clinica",
      "/dashboard/prova-pratica",
    ];
    const isFocusRoute =
      focusRoutes.includes(path) ||
      path.startsWith("/study/") ||
      path.startsWith("/enaflix");
    // Simulado em andamento: detectado por query param `?running=1` ou rota filha
    const isSimuladoRunning =
      path.startsWith("/dashboard/simulados/") &&
      path !== "/dashboard/simulados";
    const params = new URLSearchParams(location.search);
    const fromMission =
      params.get("sc_origin") === "mission" ||
      params.get("tutor_mode") === "mission";
    return isFocusRoute || isSimuladoRunning || fromMission;
  })();

  return (
  <SessionMemoryProvider>
  <div className="flex min-h-[100dvh] min-h-screen bg-background w-full overflow-hidden">
    {!isMissionLocked && <DashboardSidebar />}
    <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
      {!isMissionLocked && (
        <header
          className={cn(
            "landscape-tablet:hidden lg:hidden sticky top-0 z-40 h-14 flex items-center px-3 sm:px-4 gap-2 flex-shrink-0",
            "transition-colors duration-300 ease-out",
            scrolled
              ? "bg-background/85 backdrop-blur-xl border-b border-border/40"
              : "bg-background/60 backdrop-blur-sm border-b border-transparent",
          )}
        >
          <MobileNav />

          {/* Wordmark sóbrio (sem gradient/glow) */}
          <Link
            to="/"
            className="flex items-center min-w-0 text-foreground/85 hover:text-foreground transition-colors duration-200"
            aria-label="ENAZIZI — início"
          >
            <span className="font-bold text-[14px] tracking-[0.18em]">ENAZIZI</span>
          </Link>

          {/* ENAFLIX como tab principal (centro) — único ponto cinematográfico permitido */}
          <div className="flex-1 flex justify-center">
            <EnaflixButton variant="compact" />
          </div>

          {/* Ações secundárias — ghost icons com peso uniforme */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <GlobalSearch variant="icon" />
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors duration-200"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
      )}
      {!isMissionLocked && (
        <div
          className={cn(
            "hidden landscape-tablet:flex lg:flex sticky top-0 z-40 h-14 items-center px-6 lg:px-8 gap-5 flex-shrink-0",
            "transition-colors duration-300 ease-out",
            scrolled
              ? "bg-background/85 backdrop-blur-xl border-b border-border/40"
              : "bg-background/60 backdrop-blur-sm border-b border-transparent",
          )}
        >
          {/* === ESQUERDA: wordmark sóbrio + nav contextual === */}
          <Link
            to="/"
            className="flex items-center text-foreground/85 hover:text-foreground transition-colors duration-200"
            aria-label="ENAZIZI — início"
          >
            <span className="font-bold text-[15px] tracking-[0.18em]">ENAZIZI</span>
          </Link>

          {/* === DIREITA: ações secundárias (ghost, peso uniforme) === */}
          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch variant="pill" />
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors duration-200"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
      <main className={cn(
        "dashboard-main flex-1 overflow-x-hidden overflow-y-auto relative w-full min-h-0 min-w-0 flex flex-col",
        isMissionLocked ? "p-0" : "p-3 sm:p-4 md:p-6 lg:p-8"
      )}>
        {!isMissionLocked && <ProficiencyGate />}
        {!isMissionLocked && <ActiveVideoRoomPopup />}
        <div key={location.pathname} className={cn(
          "relative z-10 w-full max-w-full flex-1 min-w-0 min-h-0 flex flex-col",
          "animate-fade-in [animation-duration:600ms] [animation-timing-function:cubic-bezier(0.22,1,0.36,1)]",
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
    {/* ENAFLIX — botão flutuante de retorno ao hub (só aparece se origem foi ENAFLIX) */}
    <EnaflixBackButton />
  </div>
  </SessionMemoryProvider>
  );
};

export default DashboardLayout;
