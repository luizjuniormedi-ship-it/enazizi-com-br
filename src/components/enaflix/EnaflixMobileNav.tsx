import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Brain,
  PlayCircle, 
  User,
  MonitorPlay,
  LayoutGrid,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";

const MOBILE_ITEMS = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/dashboard/enaflix", label: "Enaflix", icon: MonitorPlay },
  { to: "/dashboard/sessao-estudo", label: "Missão", icon: Brain },
  { to: "/dashboard/simulados", label: "Simulados", icon: LayoutGrid },
  { to: "/dashboard/flashcards", label: "Flashcards", icon: Clock },
];

export function EnaflixMobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 h-20 bg-[#0a0a0e]/95 backdrop-blur-3xl border-t border-white/5 z-[100] lg:hidden flex items-center justify-around px-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.8)] supports-[padding:env(safe-area-inset-bottom)]:h-[calc(5rem+env(safe-area-inset-bottom))] supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]">
      {MOBILE_ITEMS.map((item) => {
        const active = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
        const Icon = item.icon;
        
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-3 py-2 transition-all duration-300 active:scale-95 touch-none",
              active ? "text-primary" : "text-white/40"
            )}
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
            }}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-all duration-500 relative",
              active ? "bg-primary/20 ring-1 ring-primary/30" : "bg-transparent"
            )}>
              {active && (
                <div className="pointer-events-none absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
              )}
              <Icon className={cn(
                "h-6 w-6 relative z-10 transition-all duration-500",
                active ? "scale-110" : "scale-100 opacity-70"
              )} />
            </div>
            <span className={cn(
              "text-[9px] font-black tracking-widest uppercase transition-all duration-300",
              active ? "opacity-100 translate-y-0" : "opacity-50"
            )}>
              {item.label}
            </span>
            
            {active && (
              <motion.div
                layoutId="mobile-active-indicator"
                className="absolute -top-[1px] inset-x-4 h-[2px] bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)] rounded-full"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
