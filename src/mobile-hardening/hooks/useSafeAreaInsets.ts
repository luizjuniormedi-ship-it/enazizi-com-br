/**
 * useSafeAreaInsets — Fase 2 Mobile Hardening
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Lê os 4 insets `env(safe-area-inset-*)` em pixels, reativos a:
 * - rotação de tela
 * - mudança de viewport
 * - aparição/desaparição de barras nativas
 */
import { useEffect, useState } from "react";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const SIDES: (keyof SafeAreaInsets)[] = ["top", "right", "bottom", "left"];

function readInsets(): SafeAreaInsets {
  if (typeof window === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // Cria um probe invisível para medir env() resolvido em px.
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:0",
    "height:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top)",
    "padding-right:env(safe-area-inset-right)",
    "padding-bottom:env(safe-area-inset-bottom)",
    "padding-left:env(safe-area-inset-left)",
  ].join(";");

  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets: SafeAreaInsets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  document.body.removeChild(probe);
  return insets;
}

export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => readInsets());

  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setInsets(readInsets()));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return insets;
}

/** Helpers tipo CSS-string para usar em `style={{ ... }}`. */
export function safeAreaPadding(
  insets: SafeAreaInsets,
  extra: Partial<Record<keyof SafeAreaInsets, number>> = {}
): React.CSSProperties {
  const out: React.CSSProperties = {};
  for (const side of SIDES) {
    const base = insets[side];
    const add = extra[side] ?? 0;
    if (base + add > 0) {
      const key = `padding${side[0].toUpperCase()}${side.slice(1)}` as
        | "paddingTop"
        | "paddingRight"
        | "paddingBottom"
        | "paddingLeft";
      out[key] = base + add;
    }
  }
  return out;
}
