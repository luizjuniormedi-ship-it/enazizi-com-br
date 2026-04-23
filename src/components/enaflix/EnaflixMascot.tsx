import { Sparkles } from "lucide-react";

export function EnaflixMascot() {
  return (
    <div className="relative h-12 w-12 shrink-0">
      {/* Glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-violet-500 to-pink-500 blur-md opacity-70 animate-pulse" />
      {/* Disco */}
      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-primary via-violet-500 to-pink-500 flex items-center justify-center shadow-xl">
        <Sparkles className="h-6 w-6 text-white drop-shadow" />
      </div>
    </div>
  );
}
