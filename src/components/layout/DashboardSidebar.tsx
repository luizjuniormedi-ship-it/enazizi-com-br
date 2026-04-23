/**
 * DashboardSidebar — versão MINIMALISTA (pós-ENAFLIX).
 *
 * Filosofia: o ENAFLIX é o hub principal de descoberta. A sidebar deixou
 * de ser menu administrativo e virou suporte contextual silencioso.
 *
 * Estrutura (4 áreas):
 *   1. Foco Agora      — contexto vivo (continuar / sessão / revisões)
 *   2. Atalhos pinados — 4 módulos críticos do dia-a-dia
 *   3. Hub ENAFLIX     — CTA único para descobrir todo o resto
 *   4. Utilidades      — perfil, admin/professor compactado, sair
 *
 * Tudo o que saiu daqui continua acessível via /enaflix e busca global.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Clock,
  FileText,
  FlipVertical,
  AlertTriangle,
  User,
  LogOut,
  Shield,
  GraduationCap,
  Building2,
  Clapperboard,
  Sparkles,
  PlayCircle,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useInstitution } from "@/hooks/useInstitution";
import enazizi from "@/assets/enazizi-mascot.png";
import StudyTimer from "@/components/dashboard/StudyTimer";
import ForceUpdateButton from "@/components/layout/ForceUpdateButton";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/* ────────────────────────── Types ────────────────────────── */
interface PinnedItem {
  to: string;
  moduleKey: string;
  icon: React.ElementType;
  label: string;
  description: string;
}

/* ─────────────── Atalhos de execução (sub-itens de Estudar) ─────────────── */
const PINNED_ITEMS: PinnedItem[] = [
  {
    to: "/dashboard/flashcards",
    moduleKey: "flashcards",
    icon: RotateCcw,
    label: "Revisões",
    description: "Flashcards FSRS — cards vencidos e pendentes",
  },
  {
    to: "/dashboard/simulados",
    moduleKey: "simulados",
    icon: FileText,
    label: "Simulados",
    description: "Provas no formato das principais bancas",
  },
  {
    to: "/dashboard/banco-erros",
    moduleKey: "banco-erros",
    icon: AlertTriangle,
    label: "Banco de Erros",
    description: "Domine os temas onde mais erra",
  },
];

/* ────────────────── Item helper ────────────────── */
const SidebarLink = ({
  to,
  icon: Icon,
  label,
  description,
  active,
  variant = "default",
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  description?: string;
  active: boolean;
  variant?: "default" | "muted";
}) => (
  <Tooltip delayDuration={400}>
    <TooltipTrigger asChild>
      <Link
        to={to}
        className={cn(
          "group/nav relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium",
          "transition-all duration-300 ease-out overflow-hidden",
          "hover:translate-x-0.5",
          active
            ? "bg-gradient-to-r from-primary/12 via-sidebar-accent to-transparent text-primary shadow-[inset_2px_0_0_hsl(var(--primary))]"
            : variant === "muted"
            ? "text-muted-foreground/55 hover:bg-sidebar-accent/40 hover:text-foreground"
            : "text-muted-foreground/75 hover:bg-sidebar-accent/40 hover:text-foreground",
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 bg-primary/35 blur-md rounded-full pointer-events-none"
          />
        )}
        <Icon
          className={cn(
            "relative h-4 w-4 flex-shrink-0 transition-transform duration-300 group-hover/nav:scale-110",
            active && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]",
          )}
        />
        <span className="truncate">{label}</span>
      </Link>
    </TooltipTrigger>
    {description && (
      <TooltipContent side="right" className="max-w-[220px]">
        <p className="font-semibold text-xs">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </TooltipContent>
    )}
  </Tooltip>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">
    {children}
  </div>
);

/* ─────────────────────── Sidebar ─────────────────────── */
const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { isStaff: isInstitutionalStaff } = useInstitution();
  const { isModuleEnabled } = useModuleAccess();

  // Modo compacto quando há sessão de estudo ativa
  const isStudyActive = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("enazizi_study_session");
      if (!raw) return false;
      return JSON.parse(raw)?.active === true;
    } catch {
      return false;
    }
    // recompute on route change to capture starts/ends
  }, [location.pathname]);

  // Detecta se há missão diária pendente (para o "Continuar agora")
  const hasMissionToday = useMemo(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return localStorage.getItem(`enazizi:mission:${today}`) !== null;
    } catch {
      return false;
    }
  }, [location.pathname]);

  // Pinados filtrados por permissão
  const pinned = useMemo(
    () => PINNED_ITEMS.filter((i) => isModuleEnabled(i.moduleKey)),
    [isModuleEnabled],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const showProfessor = isProfessor || isAdmin;
  const showAdmin = isAdmin;
  const showInstitutional = isInstitutionalStaff;
  const onEnaflix = location.pathname.startsWith("/enaflix");

  /* ───────── Modo compacto (icon-only) ───────── */
  if (isStudyActive) {
    return (
      <TooltipProvider delayDuration={200}>
        <aside className="hidden landscape-tablet:flex lg:flex flex-col w-14 border-r border-sidebar-border bg-sidebar h-screen sticky top-0 transition-all duration-300">
          <div className="p-3 flex justify-center flex-shrink-0">
            <Link to="/" className="group">
              <span className="relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                />
                <img
                  src={enazizi}
                  alt="ENAZIZI"
                  className="relative h-7 w-7 rounded-lg object-cover ring-1 ring-white/10"
                />
              </span>
            </Link>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <nav className="px-1.5 py-2 space-y-1">
              {/* Hub ENAFLIX em destaque */}
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Link
                    to="/enaflix"
                    className={cn(
                      "flex items-center justify-center w-9 h-9 mx-auto rounded-xl transition-colors",
                      onEnaflix
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/60 hover:bg-sidebar-accent/40 hover:text-foreground",
                    )}
                  >
                    <Clapperboard className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs font-semibold">ENAFLIX</p>
                </TooltipContent>
              </Tooltip>

              <div className="border-t border-sidebar-border my-2" />

              {pinned.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Tooltip key={item.to} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex items-center justify-center w-9 h-9 mx-auto rounded-xl transition-colors",
                          active
                            ? "bg-sidebar-accent text-primary"
                            : "text-muted-foreground/55 hover:bg-sidebar-accent/40 hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs font-semibold">{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              <div className="border-t border-sidebar-border my-2" />

              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Link
                    to="/dashboard/perfil"
                    className={cn(
                      "flex items-center justify-center w-9 h-9 mx-auto rounded-xl transition-colors",
                      location.pathname === "/dashboard/perfil"
                        ? "bg-sidebar-accent text-primary"
                        : "text-muted-foreground/55 hover:bg-sidebar-accent/40",
                    )}
                  >
                    <User className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">Perfil</p>
                </TooltipContent>
              </Tooltip>
            </nav>
          </ScrollArea>

          <div className="border-t border-sidebar-border flex-shrink-0 p-1.5 space-y-1">
            <ForceUpdateButton variant="sidebar" collapsed />
            <button
              onClick={handleSignOut}
              title="Sair"
              className="flex items-center justify-center p-2 rounded-xl text-sm text-muted-foreground/55 hover:bg-sidebar-accent/40 transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>
      </TooltipProvider>
    );
  }

  /* ───────── Modo expandido (minimalista) ───────── */
  return (
    <TooltipProvider delayDuration={400}>
      <aside className="hidden landscape-tablet:flex lg:flex flex-col w-52 md:w-56 lg:w-60 border-r border-sidebar-border bg-sidebar h-screen sticky top-0 transition-all duration-300">
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center p-4 gap-2">
          <Link to="/" className="group flex items-center gap-2">
            <span className="relative flex-shrink-0">
              <span
                aria-hidden
                className="absolute inset-0 rounded-lg bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
              <img
                src={enazizi}
                alt="ENAZIZI"
                className="relative h-7 w-7 rounded-lg object-cover ring-1 ring-white/10"
              />
            </span>
            <span className="text-base font-black bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent tracking-wide">
              ENAZIZI
            </span>
          </Link>
        </div>

        {/* Navegação minimalista — duas mentalidades distintas */}
        <ScrollArea className="flex-1 min-h-0">
          <nav className="px-3 py-1 space-y-0.5">
            {/* ─── 1. PANORAMA (entender) ─── */}
            <SectionLabel>Panorama</SectionLabel>

            <SidebarLink
              to="/dashboard"
              icon={PlayCircle}
              label="Visão Geral"
              description="Panorama do dia: progresso, ritmo, contexto e orientação"
              active={location.pathname === "/dashboard"}
            />

            {/* ─── 2. ESTUDAR (executar) ─── */}
            <SectionLabel>Estudar</SectionLabel>

            <SidebarLink
              to="/dashboard/sessao-estudo"
              icon={Sparkles}
              label="Estudar agora"
              description="Cockpit operacional: iniciar sessão, revisões, foco"
              active={location.pathname === "/dashboard/sessao-estudo" && !location.search}
            />
            {pinned.map((item) => {
              const active =
                location.pathname + (location.search || "") === item.to ||
                (location.pathname === item.to.split("?")[0] && item.to.includes(location.search) && location.search);
              return (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  active={!!active}
                  variant="muted"
                />
              );
            })}

            {/* ─── 3. EXPLORAR (descobrir) ─── */}
            <SectionLabel>Explorar</SectionLabel>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Link
                  to="/enaflix"
                  className={cn(
                    "group/hub flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium",
                    "transition-colors duration-200 ease-out",
                    onEnaflix
                      ? "bg-sidebar-accent text-foreground"
                      : "text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground",
                  )}
                >
                  <Clapperboard className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">ENAFLIX</span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-40 transition-transform duration-200 group-hover/hub:translate-x-0.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                <p className="font-semibold text-xs">ENAFLIX</p>
                <p className="text-[11px] text-muted-foreground">
                  Hub visual de todos os módulos: simulados, flashcards, mnemônicos,
                  anamnese, OSCE, analytics e mais.
                </p>
              </TooltipContent>
            </Tooltip>

            {/* ─── 4. Utilidades + Admin ─── */}
            <div className="pt-3 mt-2 border-t border-sidebar-border space-y-0.5">
              <SidebarLink
                to="/dashboard/perfil"
                icon={User}
                label="Meu Perfil"
                active={location.pathname === "/dashboard/perfil"}
                variant="muted"
              />

              {showProfessor && (
                <SidebarLink
                  to="/professor"
                  icon={GraduationCap}
                  label="Painel Professor"
                  active={location.pathname === "/professor"}
                  variant="muted"
                />
              )}
              {showAdmin && (
                <>
                  <SidebarLink
                    to="/admin"
                    icon={Shield}
                    label="Admin"
                    active={location.pathname === "/admin"}
                    variant="muted"
                  />
                </>
              )}
              {showInstitutional && (
                <SidebarLink
                  to="/institucional"
                  icon={Building2}
                  label="Institucional"
                  active={location.pathname === "/institucional"}
                  variant="muted"
                />
              )}
            </div>
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border flex-shrink-0">
          <StudyTimer />
          <div className="px-3 pb-3 space-y-1">
            <ForceUpdateButton variant="sidebar" />
            <button
              onClick={handleSignOut}
              title="Sair"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm text-muted-foreground/55 hover:bg-sidebar-accent/40 hover:text-foreground transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default DashboardSidebar;
