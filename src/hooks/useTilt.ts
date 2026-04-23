import { useEffect, useRef } from "react";

interface Options {
  /** Inclinação máxima em graus. Default 6 */
  max?: number;
  /** Escala no hover. Default 1.01 */
  scale?: number;
  /** Desabilitar em reduced-motion. Default true */
  respectReducedMotion?: boolean;
}

/**
 * useTilt — leve tilt 3D Pixar/Apple, sutil (não exagerado).
 * GPU-only, sem rerender. Combina perfeitamente com usePointerLight.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>({
  max = 6,
  scale = 1.01,
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
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) scale(${scale})`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = "perspective(900px) rotateX(0) rotateY(0) scale(1)";
      });
    };

    el.style.transition = "transform 400ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))";
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      el.style.transform = "";
      el.style.transition = "";
    };
  }, [max, scale, respectReducedMotion]);

  return ref;
}
