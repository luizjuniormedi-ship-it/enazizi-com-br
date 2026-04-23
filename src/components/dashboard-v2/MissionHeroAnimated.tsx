import { memo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Clock, RefreshCw, ChevronDown, AlertTriangle, Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StudyNextRecommendation, AdaptiveState } from "@/hooks/useStudyNext";
import { useApprovalPrediction } from "@/hooks/useApprovalPrediction";
import { approvalToneClass, getApprovalFocus } from "@/engines/approvalEngine";

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

function MissionHeroAnimated({ recommendation, adaptiveState, onStart, onRefresh, onShowAlternatives }: Props) {
  const cfg = TYPE_CONFIG[recommendation.type] || TYPE_CONFIG.free_study;
  const prediction = useApprovalPrediction();

  // Tone shift por risco preditivo (sutil, não alarmista)
  const isHighRisk = prediction?.hasEnoughData && prediction.riskLevel === "high";
  const isDownTrend = prediction?.hasEnoughData && prediction.trend === "down";
  const heroBorder = isHighRisk
    ? "border-destructive/30 bg-gradient-to-br from-destructive/10 via-background to-destructive/5"
    : isDownTrend
    ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5"
    : "border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5";
  const focus = prediction?.hasEnoughData
    ? getApprovalFocus({
        riskLevel: prediction.riskLevel,
        trend: prediction.trend,
        daysToExam: prediction.daysToExam,
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-2xl border shadow-lg ${heroBorder}`}
    >
      {/* Subtle animated glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

      <div className="relative p-6 sm:p-8 space-y-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1 min-w-0">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-xs font-semibold uppercase tracking-widest text-primary/70"
            >
              Sua missão de hoje
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-2xl sm:text-3xl font-bold text-foreground leading-tight"
            >
              {recommendation.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-2 max-w-xl"
            >
              {recommendation.description}
            </motion.p>

            {/* Linha preditiva de aprovação */}
            {prediction && prediction.hasEnoughData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="flex items-center gap-2 text-xs sm:text-sm flex-wrap"
              >
                <span className={`font-bold ${approvalToneClass(prediction.riskLevel)}`}>
                  🔥 Chance de aprovação: {prediction.score}%
                </span>
                {prediction.delta !== null && (
                  <span className={`inline-flex items-center gap-0.5 tabular-nums ${approvalToneClass(prediction.riskLevel)}`}>
                    {prediction.trend === "up" && <TrendingUp className="h-3 w-3" />}
                    {prediction.trend === "down" && <TrendingDown className="h-3 w-3" />}
                    {prediction.trend === "stable" && <Minus className="h-3 w-3" />}
                    {prediction.delta > 0 ? "+" : ""}{prediction.delta}
                  </span>
                )}
                <span className="text-muted-foreground hidden sm:inline">· {prediction.message}</span>
              </motion.div>
            )}

            {/* Foco atual derivado da Aprovação Preditiva */}
            {focus && (
              <p className="text-xs sm:text-sm text-muted-foreground italic">
                {focus.urgentCopy ? `${focus.urgentCopy} ` : ""}
                <span className="not-italic font-medium text-foreground/80">{focus.focus}</span>
              </p>
            )}

            {/* Tags — em mobile, esconder Recuperação (já vem no banner acima) e Bloqueado (ruído) */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs bg-primary/15 text-primary border-0">
                {cfg.icon} {cfg.label}
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground border-border/50">
                <Clock className="h-3 w-3 mr-1" />
                {recommendation.estimatedMinutes} min
              </Badge>
              {adaptiveState?.recoveryActive && (
                <Badge variant="destructive" className="hidden sm:inline-flex text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Recuperação
                </Badge>
              )}
              {adaptiveState?.contentLocked && (
                <Badge variant="outline" className="hidden sm:inline-flex text-[10px] border-muted-foreground/30">
                  <Shield className="h-3 w-3 mr-1" /> Bloqueado
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* CTA Row — em mobile o CTA ocupa a largura, refresh some, "Alternativas" vira link discreto abaixo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto h-13 px-8 text-base font-bold gap-2 shadow-lg bg-primary hover:bg-primary/90 rounded-xl"
              onClick={onStart}
            >
              <Rocket className="h-5 w-5" />
              {cfg.cta || "🚀 Começar agora"}
            </Button>
          </motion.div>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground" onClick={onRefresh} title="Atualizar missão">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="self-start sm:self-auto -ml-2 sm:ml-0 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1"
            onClick={onShowAlternatives}
          >
            Ver alternativas <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default memo(MissionHeroAnimated);
