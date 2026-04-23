import { useEffect, useRef } from "react";

interface Options {
  /** Força do magnetismo (0..1). Default 0.25 */
  strength?: number;
  /** Raio em px. Default 120 */
  radius?: number;
  /** Desabilitar quando reduced-motion */
  respectReducedMotion?: boolean;
}

/**
 * useMagneticHover — Apple/Arc-style magnetic pull em CTAs.
 * Aplica translate sutil seguindo o cursor dentro do raio.
 * GPU-only (transform), sem rerender React.
 */
export function useMagneticHover<T extends HTMLElement = HTMLButtonElement>({
  strength = 0.25,
  radius = 120,
  respectReducedMotion = true,
}: Options = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (respectReducedMotion) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) return;
    }

    let raf = 0;
    let active = false;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        if (active) reset();
        return;
      }
      active = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const tx = dx * strength;
        const ty = dy * strength;
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      });
    };

    const reset = () => {
      active = false;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = "translate3d(0,0,0)";
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("mouseleave", reset);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [strength, radius, respectReducedMotion]);

  return ref;
}
