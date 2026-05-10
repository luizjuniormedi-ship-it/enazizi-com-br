/**
 * FooterSafe — Fase 2 Mobile Hardening
 * NÃO IMPORTAR em telas produtivas durante o freeze.
 *
 * Wrapper declarativo para footers fixos. Aplica padding-bottom
 * = env(safe-area-inset-bottom) + offset extra opcional.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { useSafeAreaInsets, safeAreaPadding } from "../hooks/useSafeAreaInsets";

export interface FooterSafeProps extends React.HTMLAttributes<HTMLElement> {
  /** Padding extra além do safe-area-inset-bottom (default 16). */
  extraBottom?: number;
  as?: keyof JSX.IntrinsicElements;
}

export const FooterSafe = React.forwardRef<HTMLElement, FooterSafeProps>(
  (
    { extraBottom = 16, as: Tag = "footer", className, style, children, ...rest },
    ref
  ) => {
    const insets = useSafeAreaInsets();
    const merged: React.CSSProperties = {
      ...safeAreaPadding(insets, { bottom: extraBottom }),
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
FooterSafe.displayName = "FooterSafe";
