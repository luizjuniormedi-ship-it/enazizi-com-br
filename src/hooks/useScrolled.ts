import { useEffect, useState } from "react";

/**
 * Detecta se a página foi rolada para além de um threshold.
 * Usado para dar comportamento "Netflix" à topbar (mais blur ao rolar).
 */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Considera tanto o window quanto possíveis containers internos
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setScrolled(y > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Alguns layouts rolam dentro de <main>; observamos também
    const main = document.querySelector("main.dashboard-main");
    main?.addEventListener("scroll", onScroll as EventListener, { passive: true } as AddEventListenerOptions);
    return () => {
      window.removeEventListener("scroll", onScroll);
      main?.removeEventListener("scroll", onScroll as EventListener);
    };
  }, [threshold]);

  return scrolled;
}
