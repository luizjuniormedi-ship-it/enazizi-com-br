import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onSearchClick?: () => void;
  searchActive?: boolean;
}

/**
 * EnaflixOverlayNav — topbar overlay flutuante estilo Netflix/Apple TV.
 *
 * - Scroll progressivo: 3 estágios (top → mid → solid) usando o mesmo
 *   easing cinematográfico, em vez de um boolean cru.
 * - ENAFLIX wordmark com glow ambient + dot pulsante (vida discreta).
 * - Botões "ghost" com hover suave (scale 1.03 + bg fade).
 */
export function EnaflixOverlayNav({ onClose, onSearchClick, searchActive }: Props) {
  // 0 = no topo (transparente), 1 = totalmente sólida.
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        // 0–120px de scroll mapeia para 0–1
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

  // Estilo dinâmico interpolado (transição CSS dá o easing)
  const bgAlpha = 0.15 + scrollProgress * 0.77; // 0.15 → 0.92
  const blurPx = 2 + scrollProgress * 16; // 2 → 18
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
      {/* Gradiente preto top-down quando estamos no topo (cinematográfico) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out bg-gradient-to-b from-black/70 via-black/30 to-transparent"
        style={{ opacity: 1 - scrollProgress }}
      />

      {/* Linha luminosa no fundo (aparece com o scroll) */}
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
        {/* Esquerda: Voltar + wordmark ENAFLIX */}
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Sair do modo ENAFLIX"
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium",
              "text-white/70 hover:text-white transition-all duration-300",
              "rounded-full px-2.5 py-1.5 hover:bg-white/[0.06] hover:scale-[1.03]",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>

          <div className="flex items-center gap-2 min-w-0 group">
            {/* Dot vermelho com pulse cinematográfico */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inset-0 rounded-full bg-red-500/60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]" />
            </span>

            {/* Wordmark com shimmer ambient muito sutil */}
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

          <nav className="hidden md:flex items-center gap-6 ml-4">
            <button 
              onClick={() => (window.location.href = "/enaflix")}
              className={cn(
                "text-sm font-semibold transition-colors hover:text-white",
                window.location.pathname === "/enaflix" ? "text-white" : "text-white/60"
              )}
            >
              Início
            </button>
            <button 
              onClick={() => (window.location.href = "/dashboard/videoaulas/explorar")}
              className={cn(
                "text-sm font-semibold transition-colors hover:text-white",
                window.location.pathname.includes("explorar") ? "text-white" : "text-white/60"
              )}
            >
              Explorar Videoaulas
            </button>
            <button 
              onClick={() => (window.location.href = "/dashboard/minhas-aulas")}
              className={cn(
                "text-sm font-semibold transition-colors hover:text-white",
                window.location.pathname.includes("minhas-aulas") ? "text-white" : "text-white/60"
              )}
            >
              Minhas Aulas
            </button>
          </nav>
        </div>

        {/* Direita: ações secundárias discretas (ghost) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSearchClick}
            aria-label={searchActive ? "Fechar busca" : "Buscar"}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center",
              "transition-all duration-300 ease-out hover:scale-[1.06] active:scale-95",
              searchActive
                ? "bg-white/15 text-white"
                : "text-white/70 hover:text-white hover:bg-white/[0.08]",
            )}
          >
            {searchActive ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Notificações"
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center",
              "text-white/70 hover:text-white hover:bg-white/[0.08]",
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
