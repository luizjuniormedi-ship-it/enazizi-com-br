import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar, 
  PlayCircle, 
  Sparkles, 
  User,
  Menu
} from "lucide-react";
import { motion } from "framer-motion";

const MOBILE_ITEMS = [
  { to: "/enaflix", label: "Início", icon: Home },
  { to: "/dashboard", label: "Hoje", icon: Calendar },
  { to: "/dashboard/sessao-estudo", label: "Estudar", icon: PlayCircle },
  { to: "/dashboard/videoaulas", label: "Aulas", icon: MonitorPlay },
  { to: "/dashboard/perfil", label: "Perfil", icon: User },
];

export function EnaflixMobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 h-20 bg-[#0a0a0e]/80 backdrop-blur-2xl border-t border-white/5 z-50 lg:hidden flex items-center justify-around px-2 pb-safe">
      {MOBILE_ITEMS.map((item) => {
        const active = location.pathname === item.to;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-3 py-2 transition-all duration-300",
              active ? "text-white" : "text-white/40"
            )}
          >
            <Icon className={cn(
              "h-6 w-6 transition-transform duration-300",
              active ? "scale-110" : "scale-100"
            )} />
            <span className="text-[10px] font-bold tracking-wider uppercase">{item.label}</span>
            
            {active && (
              <motion.div
                layoutId="mobile-active"
                className="absolute -top-[1px] inset-x-0 h-[2px] bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
