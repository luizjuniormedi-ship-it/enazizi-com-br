import React from "react";
import { DialogContent, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TeacherDialogContentProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  maxWidth?: string; // e.g., "max-w-lg", "max-w-2xl", "max-w-5xl"
}

export function TeacherDialogContent({
  children,
  header,
  footer,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  maxWidth = "max-w-lg"
}: TeacherDialogContentProps) {
  return (
    <DialogContent className={cn(maxWidth, "teacher-modal-content", className)}>
      {header && (
        <DialogHeader className={cn("p-6 sm:p-8 pb-0 sm:pb-0", headerClassName)}>
          {header}
        </DialogHeader>
      )}
      
      <DialogBody className={cn(bodyClassName)}>
        {children}
      </DialogBody>

      {footer && (
        <DialogFooter className={cn("gap-2 sm:gap-2", footerClassName)}>
          {footer}
        </DialogFooter>
      )}
    </DialogContent>
  );
}
