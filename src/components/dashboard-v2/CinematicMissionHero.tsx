import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Clock,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Info,
  BrainCircuit,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StudyNextRecommendation, AdaptiveState } from "@/hooks/useStudyNext";
import { useApprovalPrediction } from "@/hooks/useApprovalPrediction";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNeuroanalytics } from "@/hooks/useNeuroanalytics";
import { approvalToneClass, getApprovalFocus } from "@/engines/approvalEngine";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

const TYPE_CONFIG: Record<string, { label: string; icon: string; cta?: string }> = {
  review: { label: "Revisão", icon: "🔄" },
  error_review: { label: "Correção de Erro", icon: "🔴" },
  daily_task: { label: "Missão do Dia", icon: "📋" },
  free_study: { label: "Estudo Livre", icon: "📚" },
  image_quiz: { label: "Questões com Imagem", icon: "🖼️", cta: "Treinar com imagens" },
  mnemonic: { label: "Mnemônico", icon: "🧠", cta: "Fixar com mnemônico" },
};

interface Props {
  recommendation: StudyNextRecommendation;
  adaptiveState?: AdaptiveState;
  onStart: () => void;
  onRefresh: () => void;
  onShowAlternatives: () => void;
}

/**
 * CinematicMissionHero — Hero premium do Dashboard.
 * Substitui MissionHeroAnimated mantendo a mesma API.
 *
 * Camadas (de fora para dentro):
 *  1. Ambient backdrop (radial gradients suaves, partículas flutuantes)
 *  2. Glass premium com glow contextual (módulo dashboard)
 *  3. Conteúdo: saudação → preparation index gigante → missão → CTA
 */
function CinematicMissionHero({
  recommendation,
  adaptiveState,
  onStart,
  onRefresh,
  onShowAlternatives,
}: Props) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[recommendation.type] || TYPE_CONFIG.free_study;
  const prediction = useApprovalPrediction();
  const { data: dashData } = useDashboardData();
  const { profile } = useNeuroanalytics();

  // Saudação inteligente
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Boa madrugada";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const firstName = useMemo(() => {
    const name = dashData?.displayName?.trim();
    if (!name) return null;
    return name.split(" ")[0];
  }, [dashData?.displayName]);

  // Tone shift por risco
  const isHighRisk = prediction?.hasEnoughData && prediction.riskLevel === "high";
  const isDownTrend = prediction?.hasEnoughData && prediction.trend === "down";

  const toneHue = isHighRisk
    ? "var(--destructive)"
    : isDownTrend
    ? "38 92% 55%"
    : "var(--hue-dashboard)";

  const focus = prediction?.hasEnoughData
    ? getApprovalFocus({
        riskLevel: prediction.riskLevel,
        trend: prediction.trend,
        daysToExam: prediction.daysToExam,
      })
    : null;

  const score = prediction?.hasEnoughData ? prediction.score : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ ["--module-hue" as never]: toneHue } as React.CSSProperties}
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "glass-premium-strong shadow-floating",
      )}
    >
      {/* ── Ambient backdrop ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top-right glow */}
        <div
          className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full opacity-70 animate-breathe"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--module-hue) / 0.35), transparent 60%)",
            filter: "blur(60px)",
          }}
        />
        {/* Bottom-left glow */}
        <div
          className="absolute -bottom-24 -left-16 w-[360px] h-[360px] rounded-full opacity-50 animate-ambient-pulse"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--accent) / 0.25), transparent 65%)",
            filter: "blur(70px)",
          }}
        />
        {/* Floating particles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-foreground/20"
            style={{
              width: 3 + (i % 2) * 2,
              height: 3 + (i % 2) * 2,
              left: `${15 + i * 18}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -18, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Conteúdo ── */}
      <div className="relative p-6 sm:p-9 lg:p-10">
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-10 items-center">
          {/* Left: greeting + mission */}
          <div className="space-y-5 min-w-0">
            {/* Saudação inteligente */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between w-full">
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-module">
                  <Sparkles className="h-3 w-3" />
                  Sua missão de hoje
                </div>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 gap-1.5 text-[10px] uppercase font-bold text-muted-foreground/60 hover:text-primary transition-colors"
                        onClick={() => navigate("/dashboard/minha-jornada")}
                      >
                        <BrainCircuit className="h-3 w-3" />
                        Transparência ACE
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[240px] text-xs">
                      Esta recomendação foi personalizada pelo motor ACE com base no seu histórico cognitivo. 
                      Clique para ver o detalhamento da sua jornada adaptativa.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <h2 className="text-base sm:text-lg text-muted-foreground font-medium">
                {firstName ? `${firstName}, seu resumo para hoje.` : "Seu resumo para hoje."}
              </h2>
            </motion.div>

            {/* Título da missão */}
            <motion.h1
              initial={{ opacity: 0, x: -8, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.05] tracking-tight text-foreground"
            >
              {recommendation.title}
            </motion.h1>

            {/* Descrição */}
            <div className="space-y-2">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-sm sm:text-[15px] text-muted-foreground/90 leading-relaxed line-clamp-2 max-w-xl font-medium"
              >
                {recommendation.description}
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="flex items-start gap-1.5 p-2 rounded-lg bg-primary/5 border border-primary/10 max-w-md"
              >
                <Info className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-tight italic">
                  "Por que isso? {adaptiveState?.justification || 'Ajuste adaptativo baseado no seu ritmo de aprendizado atual.'}"
                </p>
              </motion.div>
            </div>

            {/* Foco preditivo */}
            {focus && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xs sm:text-sm text-muted-foreground italic"
              >
                {focus.urgentCopy ? `${focus.urgentCopy} ` : ""}
                <span className="not-italic font-medium text-foreground/85">{focus.focus}</span>
              </motion.p>
            )}

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex items-center gap-2 flex-wrap"
            >
              <Badge className="text-xs bg-module-tint text-module border-0 backdrop-blur-md">
                {cfg.icon} {cfg.label}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground border-border/50 backdrop-blur-md"
              >
                <Clock className="h-3 w-3 mr-1" />
                {recommendation.estimatedMinutes} min
              </Badge>
              {adaptiveState?.recoveryActive && (
                <Badge variant="destructive" className="hidden sm:inline-flex text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Recuperação
                </Badge>
              )}
              {adaptiveState?.contentLocked && (
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex text-[10px] border-muted-foreground/30"
                >
                  <Shield className="h-3 w-3 mr-1" /> Bloqueado
                </Badge>
              )}
            </motion.div>

            {/* CTA Row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1"
            >
              <motion.div
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  onClick={onStart}
                  className={cn(
                    "w-full sm:w-auto h-13 px-8 text-base font-bold gap-2 rounded-2xl",
                    "bg-primary hover:bg-primary/90 text-primary-foreground",
                    "shadow-glow-md transition-all duration-300",
                    "[transition-timing-function:var(--ease-out-expo)]",
                  )}
                >
                  <Rocket className="h-5 w-5" />
                  Revisar agora
                </Button>
              </motion.div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                title="Atualizar missão"
                className="hidden sm:inline-flex h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              {/* Alternatives Popover logic would go here, but for now we keep the button for cleaner integration */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowAlternatives}
                className="self-start sm:self-auto text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1"
              >
                Alternativas <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          </div>

          {/* Right: Preparation Index gigante (desktop) / inline (mobile) */}
          {score !== null && prediction && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative shrink-0 self-center mx-auto lg:mx-0"
            >
              <PreparationDial
                score={score}
                trend={prediction.trend}
                delta={prediction.delta}
                riskLevel={prediction.riskLevel}
              />
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

/* ─── Preparation Dial — radial gauge cinematográfico ─── */
function PreparationDial({
  score,
  trend,
  delta,
  riskLevel,
}: {
  score: number;
  trend: "up" | "down" | "stable";
  delta: number | null;
  riskLevel: "high" | "medium" | "low";
}) {
  const size = 168;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  const tone = approvalToneClass(riskLevel);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Halo */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--module-hue) / 0.35), transparent 65%)",
          filter: "blur(20px)",
        }}
      />
      <svg width={size} height={size} className="relative -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeOpacity={0.4}
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#prepGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
        <defs>
          <linearGradient id="prepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--module-hue))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className={cn("text-4xl sm:text-5xl font-black tabular-nums leading-none", tone)}
        >
          {score}
          <span className="text-xl text-muted-foreground font-bold">%</span>
        </motion.span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5 font-semibold">
          Aprovação
        </span>
        {delta !== null && (
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
              tone,
            )}
          >
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {trend === "stable" && <Minus className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(CinematicMissionHero);
