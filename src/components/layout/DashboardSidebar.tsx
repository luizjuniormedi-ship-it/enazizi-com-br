import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, FlipVertical,
  FileText, Upload, BarChart3, LogOut, Shield, User,
  HelpCircle, BookOpen, Heart, Database, Zap, TrendingUp, Stethoscope, Award, Sparkles, AlertTriangle, Map, GraduationCap, PenLine, Activity, Trophy, Crown,
  ChevronDown, MessageCircle, Scroll, Lightbulb, Building2, Brain
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { useInstitution } from "@/hooks/useInstitution";
import enazizi from "@/assets/enazizi-mascot.png";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import StudyTimer from "@/components/dashboard/StudyTimer";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    title: "Estudar",
    defaultOpen: true,
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/dashboard/chatgpt", icon: Sparkles, label: "Tutor IA" },
      { to: "/dashboard/simulados", icon: FileText, label: "Simulados" },
      { to: "/dashboard/gerador-questoes", icon: Lightbulb, label: "Gerador de Questões" },
      { to: "/dashboard/flashcards", icon: FlipVertical, label: "Flashcards" },
      { to: "/dashboard/gerar-flashcards", icon: Zap, label: "Gerador de Flashcards" },
      { to: "/dashboard/resumos", icon: BookOpen, label: "Resumos" },
      { to: "/dashboard/diagnostico", icon: Stethoscope, label: "Nivelamento" },
    ],
  },
  {
    title: "Progresso",
    defaultOpen: false,
    items: [
      { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
      { to: "/dashboard/banco-erros", icon: AlertTriangle, label: "Banco de Erros" },
      { to: "/dashboard/mapa-dominio", icon: Map, label: "Mapa de Evolução" },
      { to: "/dashboard/rankings", icon: Crown, label: "Rankings" },
      { to: "/dashboard/conquistas", icon: Trophy, label: "Conquistas" },
    ],
  },
  {
    title: "Ferramentas",
    defaultOpen: false,
    items: [
      { to: "/dashboard/anamnese", icon: MessageCircle, label: "Anamnese" },
      { to: "/dashboard/prova-pratica", icon: Stethoscope, label: "Prova Prática" },
      { to: "/dashboard/plantao", icon: Activity, label: "Plantão" },
      { to: "/dashboard/apostilas", icon: FileText, label: "Apostilas" },
      { to: "/dashboard/cronicas", icon: Scroll, label: "Crônicas Médicas" },
      { to: "/dashboard/discursivas", icon: PenLine, label: "Discursivas" },
      { to: "/dashboard/predictor", icon: TrendingUp, label: "Previsão" },
      { to: "/dashboard/proficiencia", icon: GraduationCap, label: "Proficiência" },
      { to: "/dashboard/coach", icon: Heart, label: "Coach" },
      { to: "/dashboard/planner", icon: CalendarDays, label: "Plano Estratégico" },
      // Mnemônico movido para seção admin-only abaixo
    ],
  },
];

const SidebarGroup = ({ group, isOpen, onToggle }: { group: NavGroup; isOpen: boolean; onToggle: () => void }) => {
  const location = useLocation();
  const hasActive = group.items.some((item) => location.pathname === item.to);

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
          hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
        )}
      >
        {group.title}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "" : "-rotate-90")} />
      </button>
      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {item.to === "/dashboard/chatgpt" ? (
                  <img src={tutorAvatar} alt="Tutor" className="h-5 w-5 rounded-full object-contain flex-shrink-0" />
                ) : (
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DashboardSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { isStaff: isInstitutionalStaff } = useInstitution();
  const { isModuleEnabled } = useModuleAccess();

  // Only auto-open group with active route + "Principal" always open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      const hasActive = g.items.some((item) => location.pathname === item.to);
      initial[g.title] = g.defaultOpen || hasActive;
    });
    return initial;
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="hidden landscape-tablet:flex lg:flex flex-col w-52 md:w-56 lg:w-64 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
      <div className="p-6 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <img src={enazizi} alt="ENAZIZI" className="h-9 w-9 rounded-lg object-cover" />
          <span className="text-lg font-bold text-sidebar-foreground">ENAZIZI</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-3 overflow-y-auto min-h-0">
        {navGroups.map((group) => {
          const filteredGroup = {
            ...group,
            items: group.items.filter((item) => {
              const moduleKey = item.to.replace("/dashboard/", "").replace("/dashboard", "dashboard");
              return isModuleEnabled(moduleKey === "" ? "dashboard" : moduleKey);
            }),
          };
          if (filteredGroup.items.length === 0) return null;
          return (
            <SidebarGroup
              key={group.title}
              group={filteredGroup}
              isOpen={openGroups[group.title] ?? true}
              onToggle={() => toggleGroup(group.title)}
            />
          );
        })}

        <div className="pt-4 border-t border-sidebar-border mt-4 space-y-1">
          <Link
            to="/dashboard/perfil"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/dashboard/perfil"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <User className="h-4 w-4" />
            Meu Perfil
          </Link>
          {(isProfessor || isAdmin) && (
            <Link
              to="/professor"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/professor"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <GraduationCap className="h-4 w-4" />
              Painel Professor
            </Link>
          )}
          {isInstitutionalStaff && (
            <Link
              to="/institucional"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/institucional"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Building2 className="h-4 w-4" />
              Painel Institucional
            </Link>
          )}
          {isAdmin && (
            <>
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === "/admin"
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
              <Link
                to="/admin/ceo"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === "/admin/ceo"
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                Painel CEO
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="border-t border-sidebar-border pt-2 flex-shrink-0">
        <StudyTimer />
        <div className="px-3 pb-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
