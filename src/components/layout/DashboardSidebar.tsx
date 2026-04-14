import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Rocket, Brain, FileText, FlipVertical,
  BarChart3, LogOut, Shield, User,
  Zap, Lightbulb, CalendarDays, GraduationCap,
  ChevronDown, Building2, BookOpen, Target,
  Stethoscope, Siren, PenTool, Image,
  Trophy, Crown, Bot, TrendingUp,
  Map, AlertTriangle, Settings, Sparkles,
  BookMarked, Clock, Briefcase
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useInstitution } from "@/hooks/useInstitution";
import enazizi from "@/assets/enazizi-mascot.png";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import StudyTimer from "@/components/dashboard/StudyTimer";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudyContext } from "@/lib/studyContext";

/* ── Types ── */
interface NavItem {
  to: string;
  moduleKey: string;
  icon: React.ElementType;
  label: string;
  useAvatar?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
  adminOnly?: boolean;
}

/* ── All nav groups (6 blocks) ── */
const navGroups: NavGroup[] = [
  {
    id: "principal",
    title: "Principal",
    defaultOpen: true,
    items: [
      { to: "/dashboard", moduleKey: "dashboard", icon: Rocket, label: "Missão do Dia" },
      { to: "/dashboard/gerador-questoes", moduleKey: "questoes", icon: Lightbulb, label: "Questões" },
      { to: "/dashboard/flashcards", moduleKey: "flashcards", icon: FlipVertical, label: "Flashcards" },
      { to: "/dashboard/chatgpt", moduleKey: "chatgpt", icon: Brain, label: "Tutor IA", useAvatar: true },
      { to: "/dashboard/analytics", moduleKey: "analytics", icon: BarChart3, label: "Progresso" },
    ],
  },
  {
    id: "treino",
    title: "Treino Avançado",
    items: [
      { to: "/dashboard/simulados", moduleKey: "simulados", icon: FileText, label: "Simulados" },
      { to: "/dashboard/proficiencia", moduleKey: "proficiencia", icon: GraduationCap, label: "Proficiência" },
      { to: "/dashboard/image-quiz", moduleKey: "image-quiz", icon: Image, label: "Quiz de Imagens" },
      { to: "/dashboard/anamnese", moduleKey: "anamnese", icon: Stethoscope, label: "Anamnese" },
      { to: "/dashboard/plantao", moduleKey: "plantao", icon: Siren, label: "Modo Plantão" },
      { to: "/dashboard/prova-pratica", moduleKey: "prova-pratica", icon: Briefcase, label: "Prova Prática" },
      { to: "/dashboard/discursivas", moduleKey: "discursivas", icon: PenTool, label: "Discursivas" },
      { to: "/dashboard/simulacao-clinica", moduleKey: "simulacao-clinica", icon: Siren, label: "Simulação Clínica" },
      { to: "/dashboard/entrevista", moduleKey: "entrevista", icon: Target, label: "Entrevista" },
    ],
  },
  {
    id: "apoio",
    title: "Apoio ao Estudo",
    items: [
      { to: "/dashboard/resumos", moduleKey: "resumos", icon: BookOpen, label: "Resumos" },
      { to: "/dashboard/mnemonico", moduleKey: "mnemonico", icon: Brain, label: "Mnemônicos" },
      { to: "/dashboard/apostilas", moduleKey: "apostilas", icon: BookMarked, label: "Apostilas" },
      { to: "/dashboard/cronicas", moduleKey: "cronicas", icon: BookOpen, label: "Crônicas Médicas" },
      { to: "/dashboard/planner", moduleKey: "planner", icon: CalendarDays, label: "Plano Estratégico" },
      { to: "/dashboard/plano-dia", moduleKey: "plano-dia", icon: Zap, label: "Plano do Dia" },
      { to: "/dashboard/sessao-estudo", moduleKey: "sessao-estudo", icon: Clock, label: "Sessão de Estudo" },
      { to: "/dashboard/gerar-flashcards", moduleKey: "gerar-flashcards", icon: Sparkles, label: "Gerador Flashcards" },
      { to: "/dashboard/revisor", moduleKey: "revisor", icon: FileText, label: "Revisor Médico" },
      { to: "/dashboard/diagnostico", moduleKey: "diagnostico", icon: Stethoscope, label: "Nivelamento" },
    ],
  },
  {
    id: "inteligencia",
    title: "Inteligência IA",
    items: [
      { to: "/dashboard/mentor", moduleKey: "mentor", icon: Bot, label: "Mentor IA" },
      { to: "/dashboard/coach", moduleKey: "coach", icon: TrendingUp, label: "Coach IA" },
      { to: "/dashboard/predictor", moduleKey: "predictor", icon: Target, label: "Previsão" },
      { to: "/dashboard/mapa-dominio", moduleKey: "mapa-dominio", icon: Map, label: "Mapa Evolução" },
      { to: "/dashboard/banco-erros", moduleKey: "banco-erros", icon: AlertTriangle, label: "Banco de Erros" },
      { to: "/dashboard/banco-questoes", moduleKey: "banco-questoes", icon: Lightbulb, label: "Banco Questões" },
      { to: "/dashboard/missao", moduleKey: "missao", icon: Target, label: "Modo Missão" },
    ],
  },
  {
    id: "sistema",
    title: "Conta",
    items: [
      { to: "/dashboard/perfil", moduleKey: "perfil", icon: User, label: "Perfil" },
      { to: "/dashboard/conquistas", moduleKey: "conquistas", icon: Trophy, label: "Conquistas" },
      { to: "/dashboard/rankings", moduleKey: "rankings", icon: Crown, label: "Rankings" },
    ],
  },
];

/* ── Contextual highlight mapping ── */
const CONTEXT_HIGHLIGHTS: Record<string, string[]> = {
  error_review: ["banco-erros", "questoes", "chatgpt"],
  review: ["flashcards", "resumos"],
  daily_task: ["dashboard", "planner", "questoes"],
  practice: ["simulados", "analytics"],
  clinical: ["anamnese", "prova-pratica", "simulacao-clinica"],
  new: ["questoes", "resumos", "chatgpt"],
};

/* ── Sidebar group component ── */
const SidebarGroup = ({
  group,
  isOpen,
  onToggle,
  highlightedKeys,
  isStudyActive,
}: {
  group: NavGroup & { items: NavItem[] };
  isOpen: boolean;
  onToggle: () => void;
  highlightedKeys: Set<string>;
  isStudyActive: boolean;
}) => {
  const location = useLocation();
  const hasActive = group.items.some((item) => location.pathname === item.to);

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors",
          hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
        )}
      >
        {group.title}
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen ? "" : "-rotate-90")} />
      </button>
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((item) => {
            const active = location.pathname === item.to;
            const highlighted = highlightedKeys.has(item.moduleKey);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : highlighted && !isStudyActive
                    ? "text-sidebar-primary/80 bg-sidebar-accent/30"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                )}
              >
                {item.useAvatar ? (
                  <img src={tutorAvatar} alt="Tutor" className="h-4 w-4 rounded-full object-contain flex-shrink-0" />
                ) : (
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate text-[13px]">{item.label}</span>
                {highlighted && !active && !isStudyActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary/60 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Main Sidebar ── */
const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { isStaff: isInstitutionalStaff } = useInstitution();
  const { isModuleEnabled } = useModuleAccess();
  const studyCtx = useStudyContext();

  // Detect active study session
  const isStudyActive = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("enazizi_study_session");
      if (!raw) return false;
      return JSON.parse(raw)?.active === true;
    } catch {
      return false;
    }
  }, [location.pathname]);

  // Contextual highlights based on study context
  const highlightedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (studyCtx?.taskType) {
      const mapped = CONTEXT_HIGHLIGHTS[studyCtx.taskType];
      if (mapped) mapped.forEach((k) => keys.add(k));
    }
    return keys;
  }, [studyCtx]);

  // Group open/close state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      const hasActive = g.items.some((item) => location.pathname === item.to);
      initial[g.id] = g.defaultOpen || hasActive;
    });
    return initial;
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Filter items by module access
  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.moduleKey === "mnemonico") return isAdmin;
          if (item.moduleKey === "perfil") return true;
          return isModuleEnabled(item.moduleKey);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [isModuleEnabled, isAdmin]);

  // Admin/conditional links
  const showProfessor = isProfessor || isAdmin;
  const showAdmin = isAdmin;
  const showInstitutional = isInstitutionalStaff;
  const hasAdminBlock = showProfessor || showAdmin || showInstitutional;

  return (
    <aside className={cn(
      "hidden landscape-tablet:flex lg:flex flex-col border-r border-sidebar-border bg-sidebar h-screen sticky top-0 transition-all duration-300",
      isStudyActive ? "w-14" : "w-52 md:w-56 lg:w-60"
    )}>
      {/* Logo */}
      <div className={cn("flex-shrink-0 flex items-center", isStudyActive ? "p-3 justify-center" : "p-4 gap-2")}>
        <Link to="/" className="flex items-center gap-2">
          <img src={enazizi} alt="ENAZIZI" className="h-7 w-7 rounded-lg object-cover flex-shrink-0" />
          {!isStudyActive && <span className="text-base font-bold text-sidebar-foreground">ENAZIZI</span>}
        </Link>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className={cn("space-y-2", isStudyActive ? "px-1.5 py-2" : "px-3 py-1")}>
          {isStudyActive ? (
            /* Compact icon-only mode */
            <>
              {filteredGroups[0]?.items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={cn(
                      "flex items-center justify-center w-9 h-9 mx-auto rounded-lg transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                    )}
                  >
                    {item.useAvatar ? (
                      <img src={tutorAvatar} alt="Tutor" className="h-4 w-4 rounded-full object-contain" />
                    ) : (
                      <item.icon className="h-4 w-4" />
                    )}
                  </Link>
                );
              })}
              {/* Divider + system links */}
              <div className="border-t border-sidebar-border my-2" />
              <Link
                to="/dashboard/perfil"
                title="Perfil"
                className={cn(
                  "flex items-center justify-center w-9 h-9 mx-auto rounded-lg transition-colors",
                  location.pathname === "/dashboard/perfil"
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/40"
                )}
              >
                <User className="h-4 w-4" />
              </Link>
            </>
          ) : (
            /* Full expanded mode */
            <>
              {filteredGroups.map((group) => (
                <SidebarGroup
                  key={group.id}
                  group={group}
                  isOpen={openGroups[group.id] ?? false}
                  onToggle={() => toggleGroup(group.id)}
                  highlightedKeys={highlightedKeys}
                  isStudyActive={isStudyActive}
                />
              ))}

              {/* Admin block */}
              {hasAdminBlock && (
                <div className="pt-2 border-t border-sidebar-border mt-2 space-y-0.5">
                  <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    Administração
                  </span>
                  {showProfessor && (
                    <Link
                      to="/professor"
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                        location.pathname === "/professor"
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40"
                      )}
                    >
                      <GraduationCap className="h-4 w-4" />
                      Professor
                    </Link>
                  )}
                  {showInstitutional && (
                    <Link
                      to="/institucional"
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                        location.pathname === "/institucional"
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40"
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      Institucional
                    </Link>
                  )}
                  {showAdmin && (
                    <>
                      <Link
                        to="/admin"
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                          location.pathname === "/admin"
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40"
                        )}
                      >
                        <Shield className="h-4 w-4" />
                        Admin
                      </Link>
                      <Link
                        to="/admin/ceo"
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                          location.pathname === "/admin/ceo"
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40"
                        )}
                      >
                        <BarChart3 className="h-4 w-4" />
                        Painel CEO
                      </Link>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border flex-shrink-0">
        {!isStudyActive && <StudyTimer />}
        <div className={cn(isStudyActive ? "p-1.5" : "px-3 pb-3")}>
          <button
            onClick={handleSignOut}
            title="Sair"
            className={cn(
              "flex items-center rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/40 transition-colors w-full",
              isStudyActive ? "justify-center p-2" : "gap-2.5 px-3 py-1.5"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isStudyActive && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
