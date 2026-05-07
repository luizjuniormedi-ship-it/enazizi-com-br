import React from "react";
import { DialogContent, DialogBody, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TeacherDialogContentProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

export function TeacherDialogContent({
  children,
  header,
  footer,
  maxWidth = "sm:max-w-2xl",
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: TeacherDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        "z-[120] fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] flex flex-col p-0 overflow-hidden bg-background border-white/5",
        maxWidth,
        className
      )}
    >
      {header && (
        <div className={cn("px-6 py-4 border-b border-white/5 bg-muted/20", headerClassName)}>
          {header}
        </div>
      )}

      <DialogBody className={cn("flex-1 overflow-y-auto px-6 py-4 min-h-0 max-h-[calc(90vh-140px)]", bodyClassName)}>
        {children}
      </DialogBody>

      {footer && (
        <div className={cn("px-6 py-4 border-t border-white/5 bg-muted/20 flex items-center justify-end gap-3", footerClassName)}>
          {footer}
        </div>
      )}
    </DialogContent>
  );
}
