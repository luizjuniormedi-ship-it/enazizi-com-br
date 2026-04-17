import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Rocket, Sparkles, AlertTriangle, Brain, Layers, Compass, RefreshCw, Zap, Battery, Target } from "lucide-react";
import type { CockpitData } from "@/hooks/useCockpitData";
import type { StudyNextRecommendation } from "@/hooks/useStudyNext";
import type { OrchestratorRecommendation, OrchestratorResponse } from "@/types/orchestrator";
import { openTutorDrawer } from "@/hooks/useTutorDrawer";

interface Props {
  cockpit: CockpitData | undefined;
  /** Legacy fallback recommendation from study-next */
  recommendation: StudyNextRecommendation | undefined;
  /** Justification from study-next (legacy) */
  justification: string;
  /** F3: orchestrator output (preferred when present) */
  orchestrator?: OrchestratorResponse | null;
  userName?: string;
  onPrimaryAction?: () => void;
  onAlternativeAction?: (action: OrchestratorRecommendation) => void;
}

function buildSearchParams(payload: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * P0-bis: targetModule may already contain a query string (e.g. "/dashboard/sessao-estudo?focus=reviews").
 * Naive concat with `?did=...` would produce "?focus=reviews?did=..." (invalid → did is lost).
 * Merge both into a single, well-formed query string.
 */
function appendQuery(targetModule: string, payload: Record<string, string | number | boolean | undefined>): string {
  const [path, existingQs = ""] = targetModule.split("?");
  const params = new URLSearchParams(existingQs);
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export default function CockpitHero({
  cockpit,
  recommendation,
  justification,
  orchestrator,
  userName,
  onPrimaryAction,
  onAlternativeAction,
}: Props) {
  const navigate = useNavigate();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  // ── F3: Prefer orchestrator output, fall back to study-next/cockpit ──
  const orchRec = orchestrator?.success ? orchestrator.recommendation : null;
  const alternatives = orchestrator?.success ? orchestrator.alternatives ?? [] : [];

  const primaryStep = cockpit?.nextSteps?.find((s) => s.priority === "primary") ?? cockpit?.nextSteps?.[0];

  const headline = orchRec
    ? orchRec.cta
    : (recommendation?.title ??
        primaryStep?.title ??
        (cockpit?.topWeaknesses?.[0]
          ? `Foque em ${cockpit.topWeaknesses[0].tema} agora`
          : "Comece sua sessão de hoje"));

  const reason = (orchRec as any)?.humanReason ||
    orchRec?.reason ||
    justification ||
    (cockpit?.alerts?.[0]?.message ??
      "Vamos transformar suas fraquezas em pontos fortes com sessões guiadas.");

  const badges = (orchRec as any)?.badges as string[] | undefined;
  const adaptive = orchestrator?.adaptiveState as any;
  const badgeMeta: Record<string, { label: string; icon: any; tone: string }> = {
    exploring:           { label: "Explorando",         icon: Compass,   tone: "border-primary/30 text-primary" },
    repetition_avoided:  { label: "Repetição evitada",  icon: RefreshCw, tone: "border-muted-foreground/30 text-muted-foreground" },
    tutor_favored:       { label: "Modalidade favorável", icon: Zap,     tone: "border-primary/30 text-primary" },
    high_review_urgency: { label: "Alta urgência de revisão", icon: AlertTriangle, tone: "border-destructive/40 text-destructive" },
    fatigue_aware:       { label: "Ajustado para fadiga", icon: Battery, tone: "border-amber-500/30 text-amber-600 dark:text-amber-400" },
    phase_aligned:       { label: "Alinhado à fase",    icon: Target,    tone: "border-primary/30 text-primary" },
  };

  const decisionId = orchestrator?.decisionId;

  const handleAction = (rec: OrchestratorRecommendation) => {
    if (onAlternativeAction) return onAlternativeAction(rec);
    // F4 — drawer mode opens contextual Tutor without leaving the dashboard
    if (rec.executionMode === "drawer" && rec.nextAction === "tutor") {
      openTutorDrawer({
        topic: rec.payload?.topic as string | undefined,
        subtopic: rec.payload?.subtopic as string | undefined,
        specialty: rec.payload?.specialty as string | undefined,
        tutorPhase: rec.payload?.tutorPhase as string | undefined,
        reason: rec.reason,
        source: "Orquestrador",
        decisionId,
      });
      return;
    }
    // P0: propagate decisionId so the destination can close the adaptive loop
    const payload = decisionId ? { ...rec.payload, did: decisionId } : rec.payload;
    const qs = buildSearchParams(payload);
    navigate(`${rec.targetModule}${qs}`);
  };

  const handleStart = () => {
    if (onPrimaryAction) return onPrimaryAction();
    if (orchRec) return handleAction(orchRec);
    if (primaryStep) return navigate(primaryStep.route);
    navigate("/dashboard/quiz");
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-secondary/40 p-6 md:p-8 shadow-[var(--shadow-glow)]">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "var(--gradient-primary)", maskImage: "radial-gradient(ellipse at top right, black 0%, transparent 60%)" }}
      />
      <div className="relative z-10 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary" />
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              Cockpit Cognitivo
            </Badge>
            {orchRec && (
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Brain className="h-3 w-3" /> Orquestrador
              </Badge>
            )}
            {adaptive?.studyPhase && adaptive.studyPhase !== "unknown" && (
              <Badge variant="outline" className="gap-1 border-primary/20 text-primary capitalize">
                {adaptive.studyPhase.replace("_", " ")}
              </Badge>
            )}
            {badges?.map((b) => {
              const meta = badgeMeta[b];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <Badge key={b} variant="outline" className={`gap-1 ${meta.tone}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </Badge>
              );
            })}
            {cockpit?.alerts?.find((a) => a.severity === "high") && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Atenção
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            {greeting}{userName ? `, ${userName}` : ""} 👋
          </p>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-3">
            {headline}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {reason}
          </p>

          {/* F3: Alternative actions surfaced by orchestrator */}
          {alternatives.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <Layers className="h-3 w-3" /> Alternativas:
              </span>
              {alternatives.slice(0, 3).map((alt) => (
                <Button
                  key={alt.nextAction}
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(alt)}
                  className="h-7 text-xs"
                  title={alt.reason}
                >
                  {alt.cta}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <Button size="lg" onClick={handleStart} className="gap-2 shadow-lg">
            <Rocket className="h-4 w-4" /> Começar agora
          </Button>
          <p className="text-xs text-muted-foreground text-center max-w-[220px]">
            {orchRec
              ? `Decidido pelo Orquestrador (prioridade ${orchRec.priority})`
              : "Próximo passo automático selecionado pela IA"}
          </p>
        </div>
      </div>
    </Card>
  );
}
