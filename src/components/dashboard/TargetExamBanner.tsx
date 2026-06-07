import { Link } from "react-router-dom";
import { Target, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { isTargetExamsFilled } from "@/lib/profileValidation";

const DISMISS_KEY = "enazizi_target_exam_banner_dismissed_v1";

/**
 * Stage B contextual CTA: pede a banca alvo sem bloquear acesso.
 * Mostrado apenas se o usuário não escolheu nenhuma banca ainda.
 * Pode ser dispensado (volta a aparecer ao logar em outro dispositivo).
 */
export default function TargetExamBanner() {
  const { profile, kind } = useProfileStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (kind !== "ready" || dismissed) return null;
  if (isTargetExamsFilled(profile?.target_exams)) return null;

  return (
    <div className="mx-4 sm:mx-8 lg:mx-14 relative z-10">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 flex flex-wrap items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold text-sm sm:text-base">Defina sua banca alvo</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Escolha sua prova (ENARE, USP, UNIFESP, ENAMED…) para personalizar simulados, planner e estatísticas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/profile"
            className="text-xs sm:text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Escolher banca
          </Link>
          <button
            aria-label="Dispensar"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "true");
              setDismissed(true);
            }}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
