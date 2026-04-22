import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Rocket, Brain, FileText, FlipVertical,
  BarChart3, LogOut, Shield, User,
  Lightbulb, GraduationCap,
  ChevronDown, Building2, BookOpen,
  Stethoscope, Siren, Image,
  Trophy, Crown, Bot, TrendingUp,
  Map, AlertTriangle, Sparkles,
  BookMarked, PenTool, Target,
  CalendarDays, Clock, Briefcase, Zap
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useInstitution } from "@/hooks/useInstitution";
import enazizi from "@/assets/enazizi-mascot.png";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import StudyTimer from "@/components/dashboard/StudyTimer";
import ForceUpdateButton from "@/components/layout/ForceUpdateButton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudyContext } from "@/lib/studyContext";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

/* ── Types ── */
interface NavItem {
  to: string;
  moduleKey: string;
  icon: React.ElementType;
  label: string;
  description: string;
  useAvatar?: boolean;
  highlight?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
  collapsed?: boolean; // collapsed by default
}

/* ── Reorganized sidebar groups per user spec ── */
const navGroups: NavGroup[] = [
  {
    id: "principal",
    title: "Principal",
    defaultOpen: true,
    items: [
      { to: "/dashboard", moduleKey: "dashboard", icon: Rocket, label: "Dashboard", description: "Sua missão prioritária de estudo" },
      { to: "/dashboard?autostart=true&source=sidebar", moduleKey: "dashboard", icon: Zap, label: "Começar Agora", description: "Inicie sua missão imediatamente", highlight: true },
    ],
  },
  {
    id: "avaliacao",
    title: "Avaliação",
    defaultOpen: true,
    items: [
      { to: "/dashboard/simulados", moduleKey: "simulados", icon: FileText, label: "Simulados", description: "Simulados completos no formato das principais bancas" },
      { to: "/dashboard/image-quiz", moduleKey: "image-quiz", icon: Image, label: "Questões com Imagem", description: "Questões de prova com imagens médicas reais" },
      { to: "/dashboard/gerador-questoes", moduleKey: "questoes", icon: Lightbulb, label: "Gerador Questões", description: "Gere questões adaptativas por tema e banca" },
      { to: "/dashboard/discursivas", moduleKey: "discursivas", icon: PenTool, label: "Discursivas", description: "Pratique questões discursivas" },
      { to: "/dashboard/prova-pratica", moduleKey: "prova-pratica", icon: Briefcase, label: "Prova Prática", description: "Prepare-se para provas práticas (OSCE)" },
    ],
  },
  {
    id: "treino",
    title: "Treino & Revisão",
    defaultOpen: true,
    items: [
      { to: "/dashboard/flashcards", moduleKey: "flashcards", icon: FlipVertical, label: "Flashcards", description: "Revise conteúdos com repetição espaçada inteligente" },
      { to: "/dashboard/gerar-flashcards", moduleKey: "gerar-flashcards", icon: Sparkles, label: "Gerador Flashcards", description: "Gere flashcards automaticamente" },
      { to: "/dashboard/mnemonic-studio-v2", moduleKey: "mnemonico", icon: Brain, label: "Mnemônico", description: "Crie mnemônicos visuais memoráveis com IA" },
      { to: "/dashboard/banco-erros", moduleKey: "banco-erros", icon: AlertTriangle, label: "Banco de Erros", description: "Revise e domine os temas onde mais erra" },
      
      { to: "/dashboard/sessao-estudo", moduleKey: "sessao-estudo", icon: Clock, label: "Sessão de Estudo", description: "Aprendizado guiado com ciclo completo: ensinar, testar, corrigir e reforçar" },
    ],
  },
  {
    id: "clinica",
    title: "Clínica & Simulação",
    defaultOpen: true,
    items: [
      { to: "/dashboard/anamnese", moduleKey: "anamnese", icon: Stethoscope, label: "Anamnese", description: "Treine coleta de história clínica" },
      { to: "/dashboard/plantao", moduleKey: "plantao", icon: Siren, label: "Plantão", description: "Resolva casos urgentes em tempo real" },
      { to: "/dashboard/simulacao-clinica", moduleKey: "simulacao-clinica", icon: Siren, label: "Simulação Clínica", description: "Cenários OSCE interativos" },
      { to: "/dashboard/entrevista", moduleKey: "entrevista", icon: Target, label: "Entrevista", description: "Treine para entrevistas de residência" },
    ],
  },
  {
    id: "conteudo",
    title: "Conteúdo & Estudo",
    defaultOpen: true,
    items: [
      { to: "/dashboard/chatgpt", moduleKey: "chatgpt", icon: Brain, label: "Tutor IA", useAvatar: true, description: "Assistente para dúvidas, explicações e aprofundamento" },
      { to: "/dashboard/resumos", moduleKey: "resumos", icon: BookOpen, label: "Resumos", description: "Resumos inteligentes gerados por IA" },
      { to: "/dashboard/apostilas", moduleKey: "apostilas", icon: BookMarked, label: "Apostilas", description: "Apostilas organizadas por especialidade" },
      { to: "/dashboard/cronicas", moduleKey: "cronicas", icon: BookOpen, label: "Crônicas Médicas", description: "Aprenda através de narrativas clínicas" },
      { to: "/dashboard/mapas-mentais", moduleKey: "mapas-mentais", icon: Brain, label: "Mapas Mentais", description: "Mapas mentais interativos gerados por IA" },
      { to: "/dashboard/mentor", moduleKey: "mentor", icon: Bot, label: "Mentor IA", description: "Dúvidas rápidas e referências" },
      { to: "/dashboard/revisor", moduleKey: "revisor", icon: FileText, label: "Revisor Médico", description: "Correção médica por IA" },
    ],
  },
  {
    id: "progresso",
    title: "Progresso & Estratégia",
    defaultOpen: true,
    items: [
      { to: "/dashboard/analytics", moduleKey: "analytics", icon: BarChart3, label: "Analytics", description: "Acompanhe seu desempenho e metas" },
      { to: "/dashboard/mapa-dominio", moduleKey: "mapa-dominio", icon: Map, label: "Mapa de Evolução", description: "Visualize seu domínio por tema" },
      { to: "/dashboard/predictor", moduleKey: "predictor", icon: Target, label: "Previsão", description: "Chance estimada de aprovação por banca" },
      { to: "/dashboard/proficiencia", moduleKey: "proficiencia", icon: GraduationCap, label: "Proficiência", description: "Nível de domínio por especialidade" },
      { to: "/dashboard/diagnostico", moduleKey: "diagnostico", icon: Stethoscope, label: "Nivelamento", description: "Teste diagnóstico para mapear pontos fracos" },
      { to: "/dashboard/planner", moduleKey: "planner", icon: CalendarDays, label: "Plano Estratégico", description: "Cronograma personalizado" },
      { to: "/dashboard/coach", moduleKey: "coach", icon: TrendingUp, label: "Coach", description: "Orientação estratégica" },
    ],
  },
  {
    id: "gamificacao",
    title: "Gamificação",
    items: [
      { to: "/dashboard/conquistas", moduleKey: "conquistas", icon: Trophy, label: "Conquistas", description: "Medalhas e conquistas" },
      { to: "/dashboard/rankings", moduleKey: "rankings", icon: Crown, label: "Rankings", description: "Compare seu desempenho" },
      { to: "/dashboard/missao", moduleKey: "missao", icon: Target, label: "Modo Missão", description: "Missões temáticas com recompensas" },
    ],
  },
];
/* ── Sidebar group component ── */
const SidebarGroup = ({
  group,
  isOpen,
  onToggle,
  isStudyActive,
}: {
  group: NavGroup & { items: NavItem[] };
  isOpen: boolean;
  onToggle: () => void;
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
          hasActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground/70"
        )}
      >
        {group.title}
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isOpen ? "" : "-rotate-90")} />
      </button>
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((item) => {
            const active = location.pathname === item.to && !item.highlight;
            return (
              <Tooltip key={item.to + item.label} delayDuration={300}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200",
                      item.highlight
                        ? "bg-primary/15 text-primary hover:bg-primary/25 font-semibold"
                        : active
                        ? "bg-sidebar-accent text-primary"
                        : "text-muted-foreground/70 hover:bg-sidebar-accent/40 hover:text-foreground"
                    )}
                  >
                    {item.useAvatar ? (
                      <img src={tutorAvatar} alt="Tutor" className="h-4 w-4 rounded-full object-contain flex-shrink-0" />
                    ) : (
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate text-[13px]">{item.label}</span>
                    {item.highlight && (
                      <span className="ml-auto text-[10px]">🔥</span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  <p className="font-semibold text-xs">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
                </TooltipContent>
              </Tooltip>
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

  const isStudyActive = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("enazizi_study_session");
      if (!raw) return false;
      return JSON.parse(raw)?.active === true;
    } catch {
      return false;
    }
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      const hasActive = g.items.some((item) => location.pathname === item.to);
      initial[g.id] = hasActive || g.defaultOpen === true;
      if (g.collapsed && !hasActive) initial[g.id] = false;
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

  const filteredGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.moduleKey === "perfil") return true;
          return isModuleEnabled(item.moduleKey);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [isModuleEnabled]);

  const showProfessor = isProfessor || isAdmin;
  const showAdmin = isAdmin;
  const showInstitutional = isInstitutionalStaff;

  return (
    <TooltipProvider delayDuration={300}>
    <aside className={cn(
      "hidden landscape-tablet:flex lg:flex flex-col border-r border-sidebar-border bg-sidebar h-screen sticky top-0 transition-all duration-300",
      isStudyActive ? "w-14" : "w-52 md:w-56 lg:w-60"
    )}>
      {/* Logo */}
      <div className={cn("flex-shrink-0 flex items-center", isStudyActive ? "p-3 justify-center" : "p-4 gap-2")}>
        <Link to="/" className="flex items-center gap-2">
          <img src={enazizi} alt="ENAZIZI" className="h-7 w-7 rounded-lg object-cover flex-shrink-0" />
          {!isStudyActive && <span className="text-base font-bold text-foreground">ENAZIZI</span>}
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
                  <Tooltip key={item.to} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex items-center justify-center w-9 h-9 mx-auto rounded-xl transition-colors",
                          active
                            ? "bg-sidebar-accent text-primary"
                            : "text-muted-foreground/50 hover:bg-sidebar-accent/40 hover:text-foreground"
                        )}
                      >
                        {item.useAvatar ? (
                          <img src={tutorAvatar} alt="Tutor" className="h-4 w-4 rounded-full object-contain" />
                        ) : (
                          <item.icon className="h-4 w-4" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-semibold text-xs">{item.label}</p>
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
                        : "text-muted-foreground/50 hover:bg-sidebar-accent/40"
                    )}
                  >
                    <User className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right"><p className="text-xs">Perfil</p></TooltipContent>
              </Tooltip>
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
                  isStudyActive={isStudyActive}
                />
              ))}

              {/* Bottom: Profile + Admin */}
              <div className="pt-2 border-t border-sidebar-border mt-2 space-y-0.5">
                <Link
                  to="/dashboard/perfil"
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors",
                    location.pathname === "/dashboard/perfil"
                      ? "bg-sidebar-accent text-primary"
                      : "text-muted-foreground/65 hover:bg-sidebar-accent/40"
                  )}
                >
                  <User className="h-4 w-4" /> Meu Perfil
                </Link>

                {/* Admin-only items */}
                {showProfessor && (
                  <Link to="/professor" className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors",
                    location.pathname === "/professor" ? "bg-sidebar-accent text-primary" : "text-muted-foreground/65 hover:bg-sidebar-accent/40"
                  )}>
                    <GraduationCap className="h-4 w-4" /> Painel Professor
                  </Link>
                )}
                {showAdmin && (
                  <>
                    <Link to="/admin" className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors",
                      location.pathname === "/admin" ? "bg-sidebar-accent text-primary" : "text-muted-foreground/65 hover:bg-sidebar-accent/40"
                    )}>
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                    <Link to="/admin/ceo" className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors",
                      location.pathname === "/admin/ceo" ? "bg-sidebar-accent text-primary" : "text-muted-foreground/65 hover:bg-sidebar-accent/40"
                    )}>
                      <BarChart3 className="h-4 w-4" /> Painel CEO
                    </Link>
                  </>
                )}
                {showInstitutional && (
                  <Link to="/institucional" className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors",
                    location.pathname === "/institucional" ? "bg-sidebar-accent text-primary" : "text-muted-foreground/65 hover:bg-sidebar-accent/40"
                  )}>
                    <Building2 className="h-4 w-4" /> Institucional
                  </Link>
                )}
              </div>
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border flex-shrink-0">
        {!isStudyActive && <StudyTimer />}
        <div className={cn(isStudyActive ? "p-1.5 space-y-1" : "px-3 pb-3 space-y-1")}>
          <ForceUpdateButton variant="sidebar" collapsed={isStudyActive} />
          <button
            onClick={handleSignOut}
            title="Sair"
            className={cn(
              "flex items-center rounded-xl text-sm text-muted-foreground/60 hover:bg-sidebar-accent/40 transition-colors w-full",
              isStudyActive ? "justify-center p-2" : "gap-2.5 px-3 py-1.5"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isStudyActive && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
    </TooltipProvider>
  );
};

export default DashboardSidebar;
