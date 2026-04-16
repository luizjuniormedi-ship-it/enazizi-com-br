import { useState, useEffect, useRef } from "react";
import { Flame, Star, TrendingUp } from "lucide-react";
import { useGamification, levelFromXp, getLevelName } from "@/hooks/useGamification";
import { Link } from "react-router-dom";

const XpWidget = () => {
  const { gamification, loading } = useGamification();
  const prevXpRef = useRef<number | null>(null);
  const [xpDelta, setXpDelta] = useState(0);
  const [streakBounce, setStreakBounce] = useState(false);

  useEffect(() => {
    if (!gamification) return;
    if (prevXpRef.current !== null && gamification.xp > prevXpRef.current) {
      setXpDelta(gamification.xp - prevXpRef.current);
      const t = setTimeout(() => setXpDelta(0), 2200);
      return () => clearTimeout(t);
    }
    prevXpRef.current = gamification.xp;
  }, [gamification?.xp]);

  useEffect(() => {
    if (gamification?.currentStreak && gamification.currentStreak > 0) {
      setStreakBounce(true);
      const t = setTimeout(() => setStreakBounce(false), 700);
      return () => clearTimeout(t);
    }
  }, [gamification?.currentStreak]);

  if (loading || !gamification) return null;

  const { currentLevelXp, nextLevelXp } = levelFromXp(gamification.xp);
  const progress = Math.round((currentLevelXp / nextLevelXp) * 100);
  const levelName = getLevelName(gamification.level);

  return (
    <Link to="/dashboard/conquistas" className="block relative">
      {/* Floating XP delta */}
      {xpDelta > 0 && (
        <div className="absolute -top-6 right-2 z-10 animate-xp-float pointer-events-none">
          <span className="text-sm font-bold text-primary">+{xpDelta} XP</span>
        </div>
      )}

      <div className="glass-card p-3 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xs font-bold shadow-md ${xpDelta > 0 ? 'animate-score-pop' : ''}`}>
              {gamification.level}
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">{levelName}</div>
              <div className="text-[10px] text-muted-foreground">{gamification.xp.toLocaleString()} XP total</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {gamification.currentStreak > 0 && (
              <div className={`flex items-center gap-1 text-destructive ${streakBounce ? 'animate-streak-fire' : ''}`}>
                <Flame className="h-4 w-4" />
                <span className="text-xs font-bold">{gamification.currentStreak}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">+{gamification.weeklyXp} sem</span>
            </div>
          </div>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{currentLevelXp} / {nextLevelXp} XP</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Star className="h-3 w-3" /> Conquistas
          </span>
        </div>
      </div>
    </Link>
  );
};

export default XpWidget;
