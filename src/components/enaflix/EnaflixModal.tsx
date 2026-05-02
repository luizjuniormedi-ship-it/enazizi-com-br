import { memo, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * EnaflixModal — modal cinematográfico Pixar Glass (Fase 5).
 * Encapsula o Dialog do shadcn com identidade ENAFLIX:
 *  - blur ambiente
 *  - borda holográfica
 *  - entrada cinematográfica (já do shadcn)
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** "md" (default) | "lg" | "xl" | "full" */
  size?: "md" | "lg" | "xl" | "full";
}

const SIZE_CLASSES = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[90vw]",
} as const;

function ModalBase({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  size = "md",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "enaflix-glass border-white/10 rounded-[var(--radius-pixar)]",
          "shadow-[var(--shadow-cinematic)]",
          SIZE_CLASSES[size],
          className,
        )}
      >
        {(title || description) && (
          <DialogHeader>
            {title && (
              <DialogTitle className="enaflix-text-holo text-xl font-extrabold">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        <div className="relative">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export const EnaflixModal = memo(ModalBase);
