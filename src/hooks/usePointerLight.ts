import { useEffect, useRef } from "react";

interface Options {
  /** Desabilitar em reduced-motion. Default true */
  respectReducedMotion?: boolean;
}

/**
 * usePointerLight — luz contextual seguindo o cursor sobre o elemento.
 * Atualiza CSS vars `--mx` e `--my` (0..1) que o componente usa em
 * gradients radiais. Sem rerender React, GPU-only.
 *
 * No CSS:
 *   background: radial-gradient(
 *     circle at calc(var(--mx,0.5)*100%) calc(var(--my,0.5)*100%),
 *     hsl(var(--module-hue) / .25), transparent 50%);
 */
export function usePointerLight<T extends HTMLElement = HTMLDivElement>({
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
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", x.toFixed(3));
        el.style.setProperty("--my", y.toFixed(3));
        el.style.setProperty("--pointer-active", "1");
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--pointer-active", "0");
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [respectReducedMotion]);

  return ref;
}
