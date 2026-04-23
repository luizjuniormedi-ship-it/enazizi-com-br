/**
 * EnaflixBackButton — botão flutuante "Voltar ao ENAFLIX".
 *
 * Aparece em qualquer página de módulo quando a sessão atual foi originada
 * em /enaflix (marcado em sessionStorage por useEnaflixUsage.recordVisit).
 *
 * Comportamento:
 * - Só renderiza fora da rota /enaflix.
 * - Só renderiza se sessionStorage["enaflix:origin"] === "1".
 * - Ao clicar, navega para /enaflix (mantém o flag para reentrada rápida).
 * - Estilo cinematográfico glassmorphism alinhado ao hub (sem cor custom).
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function EnaflixBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasOrigin, setHasOrigin] = useState(false);

  // Recalcula a flag ao mudar de rota (cobre voltas via history)
  useEffect(() => {
    try {
      setHasOrigin(sessionStorage.getItem("enaflix:origin") === "1");
    } catch {
      setHasOrigin(false);
    }
  }, [location.pathname]);

  // Não mostrar dentro do próprio hub
  const onEnaflix = location.pathname === "/enaflix" || location.pathname.startsWith("/enaflix/");
  if (onEnaflix || !hasOrigin) return null;

  const handleClick = () => {
    navigate("/enaflix");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Voltar ao ENAFLIX"
      className={cn(
        "fixed z-40 bottom-4 left-4 sm:bottom-6 sm:left-6",
        "group inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full",
        "bg-[#0a0a12]/85 backdrop-blur-xl border border-white/10",
        "shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)]",
        "text-white/90 hover:text-white",
        "transition-all duration-300 ease-out",
        "hover:bg-[#0a0a12]/95 hover:border-white/25 hover:scale-[1.03]",
        "hover:shadow-[0_18px_42px_-10px_rgba(0,0,0,0.85)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      )}
      style={{
        // não atrapalhar safe-area no mobile
        paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))",
      }}
    >
      <span
        aria-hidden
        className="relative inline-flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-rose-500/20 ring-1 ring-white/15"
      >
        <ArrowLeft className="h-3.5 w-3.5 text-white absolute opacity-100 group-hover:opacity-0 transition-opacity duration-200" />
        <Clapperboard className="h-3.5 w-3.5 text-white absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </span>
      <span className="text-[13px] font-bold tracking-[0.14em] leading-none">
        ENAFLIX
      </span>
    </button>
  );
}

export default EnaflixBackButton;
