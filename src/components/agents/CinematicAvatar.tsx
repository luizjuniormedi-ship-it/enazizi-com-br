import { useState, useCallback, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import tutorCinematicAvatar from "@/assets/tutor-cinematic-avatar.png";

interface CinematicAvatarProps {
  isSpeaking: boolean;
  subtitle?: string;
  className?: string;
  /** Compact mode — no subtitles, smaller size */
  compact?: boolean;
}

export default function CinematicAvatar({
  isSpeaking,
  subtitle,
  className = "",
  compact = false,
}: CinematicAvatarProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 ${className}`}
    >
      {/* Vignette overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl"
        style={{
          boxShadow: "inset 0 0 80px 30px rgba(0,0,0,0.6)",
        }}
      />

      {/* Ambient glow when speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-primary/15 blur-3xl animate-pulse" />
        </div>
      )}

      {/* Avatar image */}
      <div className="relative z-[1] flex items-center justify-center h-full">
        <img
          src="/src/assets/enazizi-mascot.png"
          alt="Tutor Dr. Enazizi"
          className={`
            object-contain transition-all duration-700
            ${compact ? "max-h-full" : "max-h-[85%]"}
            ${isSpeaking
              ? "scale-[1.02] drop-shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
              : "scale-100 drop-shadow-[0_0_15px_rgba(0,0,0,0.4)]"
            }
          `}
          style={{
            animation: isSpeaking
              ? "cinematic-breathe 2.5s ease-in-out infinite"
              : "cinematic-idle 4s ease-in-out infinite",
          }}
        />
      </div>

      {/* Audio wave bars when speaking */}
      {isSpeaking && !compact && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-end gap-[3px]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-primary/60"
              style={{
                animation: `cinematic-wave ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.08}s`,
                height: "8px",
              }}
            />
          ))}
        </div>
      )}

      {/* Subtitle area */}
      {!compact && subtitle && (
        <div className="absolute bottom-2 left-3 right-3 z-20">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2.5 text-center">
            <p className="text-white text-sm sm:text-base leading-relaxed font-medium tracking-wide">
              {subtitle}
            </p>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes cinematic-breathe {
          0%, 100% { transform: scale(1.02) translateY(0px); }
          50% { transform: scale(1.025) translateY(-2px); }
        }
        @keyframes cinematic-idle {
          0%, 100% { transform: scale(1) translateY(0px); }
          50% { transform: scale(1.005) translateY(-1px); }
        }
        @keyframes cinematic-wave {
          from { height: 4px; }
          to { height: 18px; }
        }
      `}</style>
    </div>
  );
}
