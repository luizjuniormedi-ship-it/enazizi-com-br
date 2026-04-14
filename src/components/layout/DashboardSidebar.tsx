import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Rocket, Brain, FileText, FlipVertical,
  BarChart3, LogOut, Shield, User,
  Zap, Lightbulb, CalendarDays, GraduationCap,
  ChevronDown, Building2, BookOpen
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
      { to: "/dashboard", icon: Rocket, label: "Missão" },
      { to: "/dashboard/chatgpt", icon: Brain, label: "Tutor IA" },
      { to: "/dashboard/gerador-questoes", icon: Lightbulb, label: "Questões" },
      { to: "/dashboard/flashcards", icon: FlipVertical, label: "Flashcards" },
      { to: "/dashboard/simulados", icon: FileText, label: "Simulados" },
      { to: "/dashboard/resumos", icon: BookOpen, label: "Resumos" },
    ],
  },
  {
    title: "Progresso",
    defaultOpen: false,
    items: [
      { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
      { to: "/dashboard/planner", icon: CalendarDays, label: "Plano Estratégico" },
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
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const { isStaff: isInstitutionalStaff } = useInstitution();
  const { isModuleEnabled } = useModuleAccess();

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
    <aside className="hidden landscape-tablet:flex lg:flex flex-col w-52 md:w-56 lg:w-60 border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
      <div className="p-5 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <img src={enazizi} alt="ENAZIZI" className="h-8 w-8 rounded-lg object-cover" />
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

        <div className="pt-3 border-t border-sidebar-border mt-3 space-y-1">
          <Link
            to="/dashboard/perfil"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/dashboard/perfil"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <User className="h-4 w-4" />
            Perfil
          </Link>
          {(isProfessor || isAdmin) && (
            <Link
              to="/professor"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/professor"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <GraduationCap className="h-4 w-4" />
              Professor
            </Link>
          )}
          {isInstitutionalStaff && (
            <Link
              to="/institucional"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/institucional"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Building2 className="h-4 w-4" />
              Institucional
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/admin"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-sidebar-border pt-2 flex-shrink-0">
        <StudyTimer />
        <div className="px-3 pb-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors w-full"
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
