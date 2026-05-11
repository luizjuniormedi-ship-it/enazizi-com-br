import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Brain,
  PlayCircle, 
  User,
  MonitorPlay,
  LayoutGrid
} from "lucide-react";
import { motion } from "framer-motion";

const MOBILE_ITEMS = [
  { to: "/enaflix", label: "Início", icon: Home },
  { to: "/dashboard/sessao-estudo", label: "Tutor IA", icon: Brain },
  { to: "/dashboard/sessao-estudo", label: "Estudar", icon: PlayCircle },
  { to: "/dashboard/simulados", label: "Simulados", icon: LayoutGrid },
  { to: "/dashboard/perfil", label: "Perfil", icon: User },
];

export function EnaflixMobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 h-20 bg-[#0a0a0e]/95 backdrop-blur-3xl border-t border-white/5 z-[100] lg:hidden flex items-center justify-around px-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
      {MOBILE_ITEMS.map((item) => {
        const active = location.pathname === item.to || (item.to === "/enaflix" && location.pathname === "/dashboard");
        const Icon = item.icon;
        
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-3 py-2 transition-all duration-300",
              active ? "text-primary" : "text-white/40"
            )}
          >
            <Icon className={cn(
              "h-6 w-6 transition-transform duration-300",
              active ? "scale-110" : "scale-100"
            )} />
            <span className="text-[9px] font-black tracking-widest uppercase">{item.label}</span>
            
            {active && (
              <motion.div
                layoutId="mobile-active"
                className="absolute -top-[1px] inset-x-0 h-[2px] bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
