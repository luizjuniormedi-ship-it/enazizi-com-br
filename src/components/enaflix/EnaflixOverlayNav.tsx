import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Search, X, User, LayoutDashboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useProfessorCheck } from "@/hooks/useProfessorCheck";

interface Props {
  onClose: () => void;
  onSearchClick?: () => void;
  searchActive?: boolean;
}

export function EnaflixOverlayNav({ onClose, onSearchClick, searchActive }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdminCheck();
  const { isProfessor } = useProfessorCheck();
  const isSpecialUser = isAdmin || isProfessor;
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const p = Math.min(1, Math.max(0, y / 120));
        setScrollProgress(p);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const bgAlpha = 0.15 + scrollProgress * 0.77; 
  const blurPx = 2 + scrollProgress * 16; 
  const shadowAlpha = scrollProgress * 0.55;

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
      style={{
        backgroundColor: `rgba(10, 10, 18, ${bgAlpha})`,
        backdropFilter: `blur(${blurPx}px) saturate(140%)`,
        WebkitBackdropFilter: `blur(${blurPx}px) saturate(140%)`,
        boxShadow: `0 12px 40px -16px rgba(0,0,0,${shadowAlpha})`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out bg-gradient-to-b from-black/70 via-black/30 to-transparent"
        style={{ opacity: 1 - scrollProgress }}
      />

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px pointer-events-none transition-opacity duration-500"
        style={{
          opacity: scrollProgress * 0.6,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
        }}
      />

      <div className="relative flex items-center justify-between px-4 sm:px-8 lg:px-14 h-16">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          {isSpecialUser ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Sair do modo ENAFLIX"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest",
                "text-white/70 hover:text-white transition-all duration-300",
                "rounded-full px-3 py-1.5 hover:bg-white/[0.06] hover:scale-[1.03] border border-white/5",
              )}
            >
              <LayoutDashboard className="h-3 w-3" />
              <span className="hidden sm:inline">Painel Admin</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/dashboard/perfil")}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest",
                "text-white/70 hover:text-white transition-all duration-300",
                "rounded-full px-3 py-1.5 hover:bg-white/[0.06] hover:scale-[1.03] border border-white/5",
              )}
            >
              <User className="h-3 w-3" />
              <span className="hidden sm:inline">Meu Perfil</span>
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0 group cursor-pointer" onClick={() => navigate("/dashboard")}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inset-0 rounded-full bg-red-500/60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]" />
            </span>

            <span
              className={cn(
                "relative font-black text-lg sm:text-xl tracking-[0.25em] select-none",
                "bg-clip-text text-transparent",
              )}
              style={{
                fontFeatureSettings: '"ss01"',
                backgroundImage:
                  "linear-gradient(110deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,1) 30%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,1) 70%, rgba(255,255,255,0.95) 100%)",
                backgroundSize: "200% 100%",
                animation: "enaflix-shimmer 8s linear infinite",
                textShadow: "0 0 20px rgba(255,255,255,0.15)",
              }}
            >
              ENAFLIX
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 ml-4">
            {[
              { label: "Início", path: "/study-hub" },
              { label: "Planner", path: "/dashboard/planner" },
              { label: "Simulados", path: "/dashboard/simulados" },
              { label: "Flashcards", path: "/dashboard/flashcards" },
              { label: "Tutor IA", path: "/dashboard/sessao-estudo" },
            ].map((item) => (
              <button 
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-white hover:scale-105",
                  location.pathname === item.path || (item.path === "/dashboard" && (location.pathname === "/study-hub" || location.pathname === "/dashboard"))
                    ? "text-white" 
                    : "text-white/40"
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSearchClick}
            aria-label={searchActive ? "Fechar busca" : "Buscar"}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center",
              "transition-all duration-300 ease-out hover:scale-[1.06] active:scale-95",
              searchActive
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-white/70 hover:text-white hover:bg-white/[0.08] border border-white/5",
            )}
          >
            {searchActive ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard/perfil")}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center",
              "text-white/70 hover:text-white hover:bg-white/[0.08] border border-white/5",
              "transition-all duration-300 ease-out hover:scale-[1.06] active:scale-95",
            )}
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
