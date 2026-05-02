import { ReactNode, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  children: ReactNode;
  className?: string;
}

export function EnaflixRow({ title, children, className }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      rowRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  return (
    <div className={cn("space-y-4 group", className)}>
      <h2 className="px-4 sm:px-8 lg:px-14 text-lg sm:text-xl font-bold tracking-tight text-white/90">
        {title}
      </h2>
      
      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto px-4 sm:px-8 lg:px-14 pb-4 no-scrollbar scroll-smooth"
        >
          {children}
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>
    </div>
  );
}
