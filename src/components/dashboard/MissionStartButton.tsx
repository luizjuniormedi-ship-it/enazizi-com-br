import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useMissionMode } from "@/hooks/useMissionMode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Rocket, Play, Loader2, ArrowRight } from "lucide-react";
import { useSafeCta } from "@/hooks/useSafeCta";
import { useAuth } from "@/hooks/useAuth";
import { trackStudyAction, type EntryPoint } from "@/lib/behavioralTelemetry";

export default function MissionStartButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: starting, execute: safeCta } = useSafeCta();
  const {
    state, progress, totalMinutes, completedMinutes,
    engineLoading, hasTasks, startMission, resumeMission,
  } = useMissionMode();
  const autostartFired = useRef(false);

  // Sprint 4 — entry_point inferido da rota onde o botão renderiza.
  // /dashboard => visao_geral, qualquer outra => other.
  const entryPoint: EntryPoint = location.pathname === "/dashboard" ? "visao_geral" : "other";

  // Autostart from MissionEntry via ?autostart=mission
  useEffect(() => {
    if (autostartFired.current) return;
    if (searchParams.get("autostart") !== "mission") return;
    if (engineLoading || !hasTasks) return;
    if (state.status !== "idle") {
      // Already active/paused — just clean param
      setSearchParams({}, { replace: true });
      autostartFired.current = true;
      return;
    }
    autostartFired.current = true;
    startMission();
    setSearchParams({}, { replace: true });
    navigate("/mission");
  }, [searchParams, engineLoading, hasTasks, state.status, startMission, setSearchParams]);

  // Active or paused — show resume card
  if (state.status === "active" || state.status === "paused") {
    return (
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-[0_0_40px_hsl(var(--primary)/0.1)] animate-fade-in">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">Missão em andamento</p>
                <p className="text-[11px] text-muted-foreground">
                  {state.completedIds.length}/{state.tasks.length} tarefas · {completedMinutes}/{totalMinutes}min
                </p>
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <Button
            className="w-full gap-2 font-bold text-base py-5"
            size="lg"
            onClick={() => {
              const wasPaused = state.status === "paused";
              if (wasPaused) resumeMission();
              if (user) {
                trackStudyAction(user.id, "mission_resume",
                  wasPaused ? "resume_mission" : "continue_session",
                  { progress, completedMinutes, totalMinutes });
              }
              navigate("/mission");
            }}
          >
            <ArrowRight className="h-5 w-5" />
            {state.status === "paused" ? "RETOMAR MISSÃO" : "CONTINUAR MISSÃO"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleStart = () => {
    if (user) {
      trackStudyAction(user.id, entryPoint, "start_mission", { hasTasks });
    }
    safeCta({
      action: () => { startMission(); },
      nextStep: "/mission",
      errorMessage: "Não foi possível iniciar a sessão. Tente novamente em alguns segundos.",
    });
  };

  const isLoading = engineLoading || starting;

  // Idle — show start button
  return (
    <Card data-mission-cta className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-[0_0_40px_hsl(var(--primary)/0.1)] animate-fade-in">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base">Sua Missão de Hoje</h3>
            <p className="text-xs text-muted-foreground">
              Estudo personalizado com base no seu desempenho
            </p>
          </div>
        </div>

        <Button
          className="w-full gap-2 font-bold text-lg py-6 shadow-lg shadow-primary/20"
          size="lg"
          disabled={isLoading}
          onClick={handleStart}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparando...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              COMEÇAR ESTUDO
            </>
          )}
        </Button>

        {!isLoading && hasTasks && (
          <p className="text-[10px] text-center text-muted-foreground">
            Revisão → Conteúdo → Questões → Reforço
          </p>
        )}
      </CardContent>
    </Card>
  );
}
