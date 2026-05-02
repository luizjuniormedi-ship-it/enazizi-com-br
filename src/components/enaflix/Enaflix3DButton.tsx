import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Enaflix3DButton — Pixar Medical 3D capsule button (Fase 5 Global Engine).
 * Reutiliza as classes CSS .btn-pixar (definidas em index.css).
 *
 * Variants: primary (cyan/blue), violet, mint, danger, ghost, outline.
 * Sizes: sm | md | lg.
 */
export type Enaflix3DButtonVariant =
  | "primary"
  | "violet"
  | "mint"
  | "cyan"
  | "danger"
  | "ghost"
  | "outline";

export type Enaflix3DButtonSize = "sm" | "md" | "lg";

export interface Enaflix3DButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Enaflix3DButtonVariant;
  size?: Enaflix3DButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  glow?: boolean;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Enaflix3DButtonVariant, string> = {
  primary: "btn-pixar",
  violet: "btn-pixar btn-pixar-violet",
  mint: "btn-pixar btn-pixar-mint",
  cyan: "btn-pixar",
  ghost: "btn-pixar btn-pixar-ghost",
  outline:
    "btn-pixar btn-pixar-ghost border-white/30 !bg-transparent !shadow-none hover:!bg-white/5",
  danger: "btn-pixar",
};

const VARIANT_INLINE: Partial<Record<Enaflix3DButtonVariant, React.CSSProperties>> = {
  danger: {
    background: "var(--enaflix-grad-danger)",
    boxShadow:
      "0 1px 0 hsl(0 0% 100% / 0.35) inset, 0 -10px 18px -10px hsl(354 80% 22% / 0.75) inset, 0 14px 28px -10px hsl(var(--enaflix-danger) / 0.55), 0 22px 40px -18px hsl(354 80% 10% / 0.8)",
  },
};

const SIZE_CLASSES: Record<Enaflix3DButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 h-9",
  md: "text-sm px-4 py-2 h-11",
  lg: "text-base px-6 py-3 h-13",
};

export const Enaflix3DButton = forwardRef<HTMLButtonElement, Enaflix3DButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      iconLeft,
      iconRight,
      glow = false,
      loading = false,
      className,
      children,
      disabled,
      style,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{ ...VARIANT_INLINE[variant], ...style }}
        className={cn(
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          glow && "pixar-breathe",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          iconLeft
        )}
        {children && <span className="relative z-[1]">{children}</span>}
        {iconRight}
      </button>
    );
  },
);

Enaflix3DButton.displayName = "Enaflix3DButton";
