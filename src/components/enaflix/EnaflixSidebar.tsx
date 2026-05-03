import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar, 
  Target, 
  PlayCircle, 
  Clock, 
  FileText, 
  AlertTriangle, 
  Sparkles, 
  User, 
  Heart, 
  History, 
  Shield, 
  GraduationCap,
  LayoutDashboard,
  Search,
  Bell,
  Settings,
  ChevronRight,
  MonitorPlay,
  BrainCircuit,
  LayoutGrid,
  Users,
  Activity,
  UserCheck,
  ImageIcon
} from "lucide-react";

import { motion } from "framer-motion";
import enazizi from "@/assets/enazizi-mascot.png";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";
import { ForceUpdateButton } from "@/components/layout/ForceUpdateButton";


const NAV_SECTIONS = [
  {
    title: "PANORAMA",
    items: [
      { to: "/enaflix", label: "Início ENAFLIX", icon: Home },
      { to: "/dashboard", label: "Hoje", icon: Calendar },
      { to: "/dashboard/analytics", label: "Meu Progresso", icon: BrainCircuit },
    ]
  },
  {
    title: "ESTUDAR",
    items: [
      { to: "/dashboard/sessao-estudo", label: "Continuar", icon: PlayCircle },
      { to: "/dashboard/videoaulas/explorar", label: "Videoaulas", icon: MonitorPlay },
      { to: "/dashboard/flashcards", label: "Revisões", icon: Clock },
      { to: "/dashboard/simulados", label: "Simulados", icon: LayoutGrid },
      { to: "/dashboard/banco-erros", label: "Banco de Erros", icon: AlertTriangle },
      { to: "/dashboard/chatgpt", label: "Tutor IA", icon: Sparkles },
    ]
  },
  {
    title: "MINHA ÁREA",
    items: [
      { to: "/dashboard/videoaulas", label: "Minhas Aulas", icon: LayoutDashboard },
      { to: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
      { to: "/dashboard/historico", label: "Histórico", icon: History },
      { to: "/dashboard/perfil", label: "Perfil", icon: User },
    ]
  }
];

interface SidebarItemProps {
  to: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}

function SidebarItem({ to, label, icon: Icon, active }: SidebarItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-500 overflow-hidden",
        active 
          ? "bg-white/10 text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] ring-1 ring-white/10" 
          : "text-white/40 hover:text-white hover:bg-white/5"
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}

      <div className={cn(
        "p-2 rounded-xl transition-all duration-500",
        active ? "bg-primary/20 shadow-[0_0_15px_rgba(var(--pixar-blue),0.3)]" : "bg-transparent"
      )}>
        <Icon className={cn(
          "h-4 w-4 transition-all duration-500",
          active ? "text-primary scale-110" : "opacity-70 group-hover:opacity-100 group-hover:scale-110"
        )} />
      </div>
      
      <span className={cn(
        "text-xs font-black tracking-tight transition-all duration-500",
        active ? "translate-x-1" : "group-hover:translate-x-0.5"
      )}>
        {label}
      </span>
      
      {active && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--pixar-blue),1)]"
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      )}
    </Link>
  );
}

export function EnaflixSidebar() {
  const location = useLocation();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#0a0a0e]/95 backdrop-blur-3xl border-r border-white/5 flex flex-col z-50 hidden lg:flex shadow-[20px_0_40px_-20px_rgba(0,0,0,0.8)]">
      {/* Brand */}
      <div className="p-8 pb-4">
        <Link to="/" className="flex items-center gap-4 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full group-hover:bg-primary/50 transition-all duration-700 group-hover:scale-125" />
            <img 
              src={enazizi} 
              alt="ENAZIZI" 
              className="relative h-12 w-12 rounded-2xl object-cover border-2 border-white/10 shadow-pixar transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110" 
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-[0.15em] text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">ENAFLIX</span>
            <span className="text-[8px] font-black text-primary tracking-[0.3em] uppercase opacity-60">Studio Engine</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar mt-6">
        <div className="space-y-8 pb-8">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="px-4 text-[9px] font-black tracking-[0.2em] text-white/20 uppercase">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.to}
                    {...item}
                    active={location.pathname === item.to}
                  />
                ))}
              </div>
            </div>
          ))}

          {(isAdmin || isProfessor) && (
            <div className="space-y-2">
              <h3 className="px-4 text-[9px] font-black tracking-[0.2em] text-white/20 uppercase">
                ADMINISTRAÇÃO
              </h3>
              <div className="space-y-1">
                {isProfessor && (
                  <SidebarItem
                    to="/professor"
                    label="Professor"
                    icon={GraduationCap}
                    active={location.pathname === "/professor"}
                  />
                )}
                {isAdmin && (
                  <>
                    <SidebarItem
                      to="/admin"
                      label="Admin Hub"
                      icon={Shield}
                      active={location.pathname === "/admin" && !location.search}
                    />
                    
                    {/* Atalhos Rápidos de Gestão */}
                    <div className="py-2 space-y-1">
                      <SidebarItem
                        to="/admin?tab=ingestion"
                        label="Gerar Questões"
                        icon={Sparkles}
                        active={location.search === "?tab=ingestion"}
                      />
                      <SidebarItem
                        to="/admin?tab=question-review"
                        label="Aprovar Questões"
                        icon={UserCheck}
                        active={location.search === "?tab=question-review"}
                      />
                      <SidebarItem
                        to="/admin?tab=image-review"
                        label="Aprovar Imagens"
                        icon={ImageIcon}
                        active={location.search === "?tab=image-review"}
                      />
                    </div>

                    <SidebarItem
                      to="/admin/users"
                      label="Usuários"
                      icon={Users}
                      active={location.pathname === "/admin/users"}
                    />
                    <SidebarItem
                      to="/admin/monitoring"
                      label="Monitoramento"
                      icon={Activity}
                      active={location.pathname === "/admin/monitoring"}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Footer / User */}
      <div className="p-4 border-t border-white/5 space-y-4 bg-[#0a0a0e]/50 backdrop-blur-md">
        <div className="px-2">
          <ForceUpdateButton 
            variant="sidebar" 
            className="hover:bg-white/10 text-white/40 hover:text-white"
          />
        </div>
        
        <div className="flex items-center justify-between px-2">
          <button className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <Search className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-[#0a0a0e]" />
          </button>
          <button className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

    </aside>
  );
}
