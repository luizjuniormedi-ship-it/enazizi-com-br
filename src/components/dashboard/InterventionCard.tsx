/**
 * InterventionCard — Next Best Action (Fase 1)
 * ─────────────────────────────────────────────
 * Card único que mostra a próxima ação prioritária do usuário, decidida
 * pelo `useInterventionEngine`. Renderiza 1 CTA direto.
 *
 * Telemetria:
 *   - `exposed` quando o card monta com uma ação visível (1× por sessão)
 *   - `clicked` ao clicar no CTA, com `actionType` no metadata
 *
 * Não compete com o Alert Orchestrator: este card é uma SUGESTÃO de
 * próxima ação, não um alerta. Aparece sempre (com tipo `default` no caso
 * de tudo bem).
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  RefreshCw,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  useInterventionEngine,
  type InterventionType,
} from "@/hooks/useInterventionEngine";
import { trackAlertEvent } from "@/lib/alertTelemetry";
import { useAuth } from "@/hooks/useAuth";
import { clearPenaltyForType } from "@/lib/interventionPenaltyUpdater";

const TYPE_ICON: Record<InterventionType, React.ComponentType<{ className?: string }>> = {
  "min-mission": Rocket,
  fsrs: RefreshCw,
  recovery: AlertTriangle,
  coverage: Layers,
  default: Sparkles,
};

const TYPE_ACCENT: Record<InterventionType, string> = {
  "min-mission": "border-l-destructive bg-destructive/5",
  fsrs: "border-l-primary bg-primary/5",
  recovery: "border-l-amber-500 bg-amber-500/5",
  coverage: "border-l-blue-500 bg-blue-500/5",
  default: "border-l-emerald-500 bg-emerald-500/5",
};

const TYPE_ICON_COLOR: Record<InterventionType, string> = {
  "min-mission": "text-destructive",
  fsrs: "text-primary",
  recovery: "text-amber-600 dark:text-amber-400",
  coverage: "text-blue-600 dark:text-blue-400",
  default: "text-emerald-600 dark:text-emerald-400",
};

export default function InterventionCard() {
  const action = useInterventionEngine();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Telemetria de exposição — fire-and-forget, deduped por sessão.
  useEffect(() => {
    if (!action) return;
    trackAlertEvent({
      alert: {
        id: `intervention-${action.type}`,
        source: "intervention",
        priority: "important",
        layer: "structural",
        legacyOrigin: "core",
        viaBridge: false,
        metadata: {
          actionType: action.type,
          weight: action.weight,
          finalWeight: action.finalWeight ?? action.weight,
          adaptiveDelta: action.adaptiveDelta ?? 0,
          adaptiveReason: action.adaptiveReason ?? "v2-off",
          penaltyLevel: action.penaltyLevel ?? 0,
          penaltyDelta: action.penaltyDelta ?? 0,
          penaltyApplied: !!action.penaltyApplied,
          profileDelta: action.profileDelta ?? 0,
          profileReason: action.profileReason ?? "v3-off",
          profileScore: action.profileScore ?? 0,
        },
      },
      eventType: "exposed",
    });
  }, [action]);

  if (!action) return null;

  const Icon = TYPE_ICON[action.type];

  const handleClick = () => {
    trackAlertEvent({
      alert: {
        id: `intervention-${action.type}`,
        source: "intervention",
        priority: "important",
        layer: "structural",
        legacyOrigin: "core",
        viaBridge: false,
        metadata: {
          actionType: action.type,
          weight: action.weight,
          finalWeight: action.finalWeight ?? action.weight,
          adaptiveDelta: action.adaptiveDelta ?? 0,
          adaptiveReason: action.adaptiveReason ?? "v2-off",
          penaltyLevel: action.penaltyLevel ?? 0,
          penaltyDelta: action.penaltyDelta ?? 0,
          penaltyApplied: !!action.penaltyApplied,
          profileDelta: action.profileDelta ?? 0,
          profileReason: action.profileReason ?? "v3-off",
          profileScore: action.profileScore ?? 0,
        },
      },
      eventType: "clicked",
      extra: {
        actionType: action.type,
        href: action.href,
        finalWeight: action.finalWeight ?? action.weight,
        adaptiveDelta: action.adaptiveDelta ?? 0,
        adaptiveReason: action.adaptiveReason ?? "v2-off",
        penaltyLevel: action.penaltyLevel ?? 0,
        penaltyDelta: action.penaltyDelta ?? 0,
        penaltyApplied: !!action.penaltyApplied,
        profileDelta: action.profileDelta ?? 0,
        profileReason: action.profileReason ?? "v3-off",
        profileScore: action.profileScore ?? 0,
      },
    });
    // Reset imediato — clique zera a penalidade desse tipo (fire-and-forget).
    if (user?.id) {
      void clearPenaltyForType(user.id, action.type);
    }
    navigate(action.href);
  };

  return (
    <Card
      className={`border-l-4 ${TYPE_ACCENT[action.type]} transition-all hover:shadow-md`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="rounded-lg bg-background p-2 shrink-0 shadow-sm">
              <Icon className={`h-5 w-5 ${TYPE_ICON_COLOR[action.type]}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
                Próxima ação
              </div>
              <h3 className="font-semibold text-base leading-tight truncate">
                {action.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {action.description}
              </p>
            </div>
          </div>
          <Button
            onClick={handleClick}
            size="sm"
            className="w-full sm:w-auto shrink-0 gap-1.5"
          >
            {action.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
