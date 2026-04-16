import { useGamification } from "@/hooks/useGamification";
import { X } from "lucide-react";

const AchievementToast = () => {
  const { newAchievement, dismissAchievement } = useGamification();

  if (!newAchievement) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-down">
      <div className="glass-card p-4 flex items-center gap-3 shadow-2xl border-2 border-primary/50 min-w-[280px]">
        <div className="text-3xl animate-score-pop">{newAchievement.icon}</div>
        <div className="flex-1">
          <div className="text-xs text-primary font-semibold uppercase tracking-wide">🏆 Conquista desbloqueada!</div>
          <div className="text-sm font-bold text-foreground">{newAchievement.title}</div>
          <div className="text-xs text-muted-foreground">{newAchievement.description}</div>
        </div>
        <button onClick={dismissAchievement} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AchievementToast;
