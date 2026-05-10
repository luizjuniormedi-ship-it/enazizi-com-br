/**
 * SafeToastViewport — Fase 2 Mobile Hardening
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Toaster mobile-aware:
 * - respeita safe-area-top e safe-area-bottom
 * - posição compacta (top no desktop, bottom no mobile)
 * - largura limitada para não invadir CTAs
 *
 * Pós-freeze: substituir o `<Toaster />` global por este wrapper.
 */
import * as React from "react";
import { Toaster as Sonner } from "sonner";
import { useSafeAreaInsets } from "../hooks/useSafeAreaInsets";

export interface SafeToastViewportProps {
  /** "auto" usa bottom em telas <768px e top no resto (default). */
  position?: "auto" | "top" | "bottom";
  theme?: "light" | "dark" | "system";
}

export function SafeToastViewport({
  position = "auto",
  theme = "system",
}: SafeToastViewportProps) {
  const insets = useSafeAreaInsets();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const resolved =
    position === "auto" ? (isMobile ? "bottom-center" : "top-right") : position === "top" ? "top-right" : "bottom-center";

  const offset = resolved.startsWith("top") ? insets.top + 12 : insets.bottom + 12;

  return (
    <Sonner
      theme={theme}
      position={resolved as "top-right" | "bottom-center"}
      offset={offset}
      richColors
      closeButton
      toastOptions={{
        // Compacto no mobile, evita invadir CTAs.
        className: "max-w-[calc(100vw-32px)] sm:max-w-sm text-sm",
        duration: 3500,
      }}
    />
  );
}
