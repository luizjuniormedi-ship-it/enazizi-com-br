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
  ImageIcon,
  Star,
  Upload,
  Brain
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
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
      { to: "/dashboard/mnemonic-studio", label: "Mnemônicos", icon: BrainCircuit },
      { to: "/dashboard/tutor-v2", label: "Tutor IA", icon: Brain, badge: "Premium" },
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
  badge?: string;
}

function SidebarItem({ to, label, icon: Icon, active, badge }: SidebarItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative z-10 flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-500 overflow-hidden isolate cursor-pointer",
        active 
          ? "text-white" 
          : "text-white/40 hover:text-white"
      )}
    >
      <AnimatePresence>
        {active && (
          <motion.div
            layoutId="sidebar-active-pill"
            className="pointer-events-none absolute inset-0 bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)] -z-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "p-2 rounded-xl transition-all duration-500 relative",
        active ? "bg-primary/20 ring-1 ring-primary/30" : "bg-white/5 group-hover:bg-white/10 ring-1 ring-white/5"
      )}>
        {active && (
          <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
        )}
        <Icon className={cn(
          "h-4 w-4 relative z-10 transition-all duration-500",
          active ? "text-primary scale-110" : "opacity-70 group-hover:opacity-100 group-hover:scale-110"
        )} />
      </div>
      
      <span className={cn(
        "text-[11px] font-black tracking-tight transition-all duration-500 flex-1",
        active ? "translate-x-1" : "group-hover:translate-x-0.5"
      )}>
        {label}
      </span>

      {badge && (
        <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest ring-1 ring-primary/30">
          {badge}
        </span>
      )}
      
      {active && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="pointer-events-none absolute left-0 w-0.5 h-5 bg-primary rounded-r-full shadow-[0_0_15px_hsl(var(--primary))]"
          initial={{ height: 0 }}
          animate={{ height: 20 }}
          transition={{ duration: 0.3 }}
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
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#050508]/60 backdrop-blur-[80px] border-r border-white/5 flex flex-col z-50 hidden lg:flex shadow-[20px_0_60px_-20px_rgba(0,0,0,1)]">
      {/* Brand Header */}
      <div className="p-8 pb-4">
        <Link to="/" className="flex items-center gap-4 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full group-hover:bg-primary/50 transition-all duration-700 group-hover:scale-125" />
            <div className="relative h-14 w-14 rounded-2xl p-1 bg-gradient-to-br from-white/10 to-transparent border border-white/10 shadow-2xl transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110">
              <img 
                src={enazizi} 
                alt="ENAZIZI" 
                className="h-full w-full rounded-xl object-cover" 
              />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-[0.2em] text-white leading-none drop-shadow-[0_2px_15px_rgba(var(--primary),0.5)]">ENAFLIX</span>
            <span className="text-[9px] font-black text-primary tracking-[0.4em] uppercase opacity-80 mt-1">Cognitive v5</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-hide">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <h3 className="px-4 text-[9px] font-black tracking-[0.3em] text-white/20 uppercase">
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
          <div className="space-y-3">
            <h3 className="px-4 text-[9px] font-black tracking-[0.3em] text-white/20 uppercase">
              ADMINISTRAÇÃO
            </h3>
            <div className="space-y-1">
              {(isProfessor || isAdmin) && (
                <SidebarItem
                  to="/dashboard/professor"
                  label="Professor"
                  icon={GraduationCap}
                  active={location.pathname === "/dashboard/professor"}
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
                  
                  <div className="py-2 space-y-1 opacity-80">
                    <SidebarItem
                      to="/admin?tab=uploads"
                      label="Upload Arquivos"
                      icon={Upload}
                      active={location.search === "?tab=uploads"}
                    />
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
      </nav>

      {/* Footer / User / Global Actions */}
      <div className="p-4 bg-[#0a0a0e]/80 backdrop-blur-xl border-t border-white/5 space-y-4">
        <div className="px-2">
          <ForceUpdateButton 
            variant="sidebar" 
            className="w-full justify-start h-10 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border-white/5"
          />
        </div>
        
        <div className="flex items-center justify-around px-2 py-1">
          <button className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all group/btn">
            <Search className="h-5 w-5 transition-transform group-hover/btn:scale-110" />
          </button>
          <button className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all relative group/btn">
            <Bell className="h-5 w-5 transition-transform group-hover/btn:scale-110" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-[#0a0a0e] shadow-[0_0_8px_hsl(var(--primary))]" />
          </button>
          <button className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all group/btn">
            <Settings className="h-5 w-5 transition-transform group-hover/btn:scale-110" />
          </button>
        </div>
      </div>
    </aside>
  );
}
