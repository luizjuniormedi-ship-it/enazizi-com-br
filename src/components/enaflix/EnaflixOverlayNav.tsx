import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onSearchClick?: () => void;
  searchActive?: boolean;
}

/**
 * EnaflixOverlayNav — topbar overlay flutuante estilo Netflix.
 *
 * - No topo: quase invisível (gradiente preto → transparente)
 * - Ao rolar: ganha solidez (#0a0a12/95 com shadow)
 * - Sempre flutuante (position: fixed). O conteúdo passa POR TRÁS dela.
 * - Sem caixas, sem bordas pesadas, sem glow excessivo.
 */
export function EnaflixOverlayNav({ onClose, onSearchClick, searchActive }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-out",
        scrolled
          ? "bg-[#0a0a12]/92 backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8)]"
          : "bg-gradient-to-b from-black/70 via-black/30 to-transparent backdrop-blur-[2px]",
      )}
    >
      <div className="flex items-center justify-between px-4 sm:px-8 lg:px-14 h-16">
        {/* Esquerda: Voltar + wordmark ENAFLIX */}
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Sair do modo ENAFLIX"
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium",
              "text-white/70 hover:text-white transition-colors",
              "rounded-md px-2 py-1 hover:bg-white/5",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] shrink-0" />
            <span
              className="font-black text-base sm:text-lg tracking-[0.18em] bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent select-none"
              style={{ fontFeatureSettings: '"ss01"' }}
            >
              ENAFLIX
            </span>
          </div>
        </div>

        {/* Direita: ações secundárias discretas */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSearchClick}
            aria-label={searchActive ? "Fechar busca" : "Buscar"}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
              searchActive
                ? "bg-white/15 text-white"
                : "text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            {searchActive ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Notificações"
            className="h-9 w-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
