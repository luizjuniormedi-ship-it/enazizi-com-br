/**
 * useKeyboardSafe — Fase 2 Mobile Hardening
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Detecta o teclado virtual via visualViewport API (iOS Safari/Chrome).
 * Retorna a altura ocupada pelo teclado em px e um flag `isOpen`.
 *
 * Uso futuro: aplicar `paddingBottom: keyboardHeight` em containers
 * com input fixo (Tutor IA, Anamnese Trainer).
 */
import { useEffect, useState } from "react";

export interface KeyboardState {
  /** Altura em px que o teclado está ocupando (0 quando fechado). */
  keyboardHeight: number;
  /** True se o teclado provavelmente está aberto. */
  isOpen: boolean;
  /** Altura visível do viewport em px (window.visualViewport.height). */
  visualHeight: number;
}

const OPEN_THRESHOLD_PX = 120; // diferença mínima para considerar teclado aberto

export function useKeyboardSafe(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(() => ({
    keyboardHeight: 0,
    isOpen: false,
    visualHeight:
      typeof window !== "undefined"
        ? window.visualViewport?.height ?? window.innerHeight
        : 0,
  }));

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    let raf = 0;

    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const visualHeight = vv.height;
        const layoutHeight = window.innerHeight;
        const diff = Math.max(0, layoutHeight - visualHeight - vv.offsetTop);
        setState({
          keyboardHeight: diff,
          isOpen: diff > OPEN_THRESHOLD_PX,
          visualHeight,
        });
      });
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
