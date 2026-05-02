import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function EnaflixSection({ title, subtitle, children, className }: Props) {
  return (
    <section className={cn("space-y-6 py-8", className)}>
      <div className="px-4 sm:px-8 lg:px-14 space-y-1">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        >
          {title}
        </motion.h2>
        {subtitle && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base text-white/60 font-medium max-w-2xl"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      <div className="w-full">
        {children}
      </div>
    </section>
  );
}