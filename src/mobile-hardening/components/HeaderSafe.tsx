/**
 * HeaderSafe — Fase 2 Mobile Hardening
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Wrapper declarativo para headers fixos/sticky. Aplica padding-top
 * = env(safe-area-inset-top) + offset extra opcional.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { useSafeAreaInsets, safeAreaPadding } from "../hooks/useSafeAreaInsets";

export interface HeaderSafeProps extends React.HTMLAttributes<HTMLElement> {
  /** Padding extra além do safe-area-inset-top (default 0). */
  extraTop?: number;
  /** Renderiza como tag custom (default `header`). */
  as?: keyof JSX.IntrinsicElements;
}

export const HeaderSafe = React.forwardRef<HTMLElement, HeaderSafeProps>(
  ({ extraTop = 0, as: Tag = "header", className, style, children, ...rest }, ref) => {
    const insets = useSafeAreaInsets();
    const merged: React.CSSProperties = {
      ...safeAreaPadding(insets, { top: extraTop }),
      ...style,
    };
    return (
      // @ts-expect-error dynamic intrinsic tag
      <Tag ref={ref} className={cn("w-full", className)} style={merged} {...rest}>
        {children}
      </Tag>
    );
  }
);
HeaderSafe.displayName = "HeaderSafe";
