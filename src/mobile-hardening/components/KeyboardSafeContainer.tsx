/**
 * KeyboardSafeContainer — Fase 2 Mobile Hardening
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Container que reage ao teclado virtual iOS via visualViewport.
 * Aplica padding-bottom igual à altura do teclado, evitando que
 * inputs/CTAs fiquem cobertos.
 *
 * Uso futuro (Tutor IA chat):
 *   <KeyboardSafeContainer className="flex flex-col h-dvh">
 *     <ChatList />
 *     <ChatInput />
 *   </KeyboardSafeContainer>
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { useKeyboardSafe } from "../hooks/useKeyboardSafe";
import { useSafeAreaInsets } from "../hooks/useSafeAreaInsets";

export interface KeyboardSafeContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Se true, ao abrir o teclado faz scroll para o input ativo (default true). */
  scrollIntoViewOnOpen?: boolean;
}

export const KeyboardSafeContainer = React.forwardRef<
  HTMLDivElement,
  KeyboardSafeContainerProps
>(({ scrollIntoViewOnOpen = true, className, style, children, ...rest }, ref) => {
  const { keyboardHeight, isOpen } = useKeyboardSafe();
  const insets = useSafeAreaInsets();

  // Quando o teclado abre, dispensa o safe-area-bottom (já não é a borda visível).
  const paddingBottom = isOpen ? keyboardHeight : insets.bottom;

  React.useEffect(() => {
    if (!scrollIntoViewOnOpen || !isOpen) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [isOpen, scrollIntoViewOnOpen]);

  return (
    <div
      ref={ref}
      className={cn("w-full", className)}
      style={{
        paddingBottom,
        transition: "padding-bottom 180ms ease-out",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
KeyboardSafeContainer.displayName = "KeyboardSafeContainer";
