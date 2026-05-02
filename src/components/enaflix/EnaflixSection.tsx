import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function EnaflixSection({ title, subtitle, children, className }: Props) {
  return (
    <section className={cn("space-y-6", className)}>
      <div className="px-4 sm:px-8 lg:px-14 space-y-1">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white/90">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-white/50 font-medium">
            {subtitle}
          </p>
        )}
      </div>
      <div className="w-full">
        {children}
      </div>
    </section>
  );
}
