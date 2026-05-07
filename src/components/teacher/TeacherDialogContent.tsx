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
  maxWidth = "sm:max-w-3xl",
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: TeacherDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        "teacher-modal-content",
        maxWidth,
        className
      )}
    >
      <div className="flex h-auto max-h-[88vh] flex-col overflow-hidden">
        {header && (
          <div className={cn("px-6 py-4 border-b border-white/5 bg-muted/20 shrink-0", headerClassName)}>
            {header}
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto px-6 py-4 min-h-0", bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className={cn("px-6 py-4 border-t border-white/5 bg-muted/20 flex items-center justify-end gap-3 shrink-0", footerClassName)}>
            {footer}
          </div>
        )}
      </div>
    </DialogContent>
  );
}
