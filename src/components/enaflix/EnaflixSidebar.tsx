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
  Settings
} from "lucide-react";
import { motion } from "framer-motion";
import enazizi from "@/assets/enazizi-mascot.png";

const NAV_SECTIONS = [
  {
    title: "PANORAMA",
    items: [
      { to: "/enaflix", label: "Início ENAFLIX", icon: Home },
      { to: "/dashboard", label: "Hoje", icon: Calendar },
      { to: "/dashboard/analytics", label: "Meu Progresso", icon: Target },
    ]
  },
  {
    title: "ESTUDAR",
    items: [
      { to: "/dashboard/sessao-estudo", label: "Continuar", icon: PlayCircle },
      { to: "/dashboard/videoaulas/explorar", label: "Videoaulas", icon: PlayCircle },
      { to: "/dashboard/flashcards", label: "Revisões", icon: Clock },
      { to: "/dashboard/simulados", label: "Simulados", icon: FileText },
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
        "group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
        active 
          ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
          : "text-white/50 hover:text-white hover:bg-white/5"
      )}
    >
      <Icon className={cn(
        "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
        active ? "text-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : ""
      )} />
      <span className="text-sm font-medium tracking-wide">{label}</span>
      
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </Link>
  );
}

export function EnaflixSidebar() {
  const location = useLocation();
  const isAdmin = true; // Placeholder, should use useAdminCheck
  const isProfessor = true; // Placeholder

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#0a0a0e] border-r border-white/5 flex flex-col z-50 hidden lg:flex">
      {/* Brand */}
      <div className="p-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors" />
            <img src={enazizi} alt="ENAZIZI" className="relative h-10 w-10 rounded-xl object-cover border border-white/10" />
          </div>
          <span className="font-black text-xl tracking-[0.2em] text-white">ENAFLIX</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <div className="space-y-8 pb-8">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="px-4 text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
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
              <h3 className="px-4 text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
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
                  <SidebarItem
                    to="/admin"
                    label="Admin"
                    icon={Shield}
                    active={location.pathname === "/admin"}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Footer / User */}
      <div className="p-4 border-t border-white/5 space-y-4 bg-[#0a0a0e]/50 backdrop-blur-md">
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
