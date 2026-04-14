import { useVisualSkill } from "@/hooks/useVisualSkill";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Eye, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { VisualCategory } from "@/lib/visualSkillEngine";

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  critico: { label: "Crítico", color: "text-red-400" },
  fraco: { label: "Fraco", color: "text-orange-400" },
  intermediario: { label: "Intermediário", color: "text-yellow-400" },
  bom: { label: "Bom", color: "text-emerald-400" },
  avancado: { label: "Avançado", color: "text-green-400" },
};

const TYPE_LABELS: Record<VisualCategory, string> = {
  ecg: "ECG",
  xray: "Raio-X",
  ct: "Tomografia",
  us: "Ultrassom",
  dermatology: "Dermatologia",
  ophthalmology: "Oftalmologia",
  pathology: "Patologia",
};

export default function VisualSkillCard() {
  const { data: skill, isLoading } = useVisualSkill();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="p-4 bg-card/60 border-border/40">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando habilidade visual…</span>
        </div>
      </Card>
    );
  }

  if (!skill || skill.categories.every((c) => c.attemptsCount === 0)) {
    return (
      <Card className="p-4 bg-card/60 border-border/40">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Habilidade Visual</p>
            <p className="text-xs text-muted-foreground">
              Responda questões de imagem para desbloquear seu perfil visual
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => navigate("/image-quiz")}
        >
          Começar treino de imagem <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </Card>
    );
  }

  const level = LEVEL_CONFIG[skill.globalLevel] || LEVEL_CONFIG.intermediario;
  const weakLabel = skill.weakestArea ? TYPE_LABELS[skill.weakestArea] : null;
  const strongLabel = skill.strongestArea ? TYPE_LABELS[skill.strongestArea] : null;

  return (
    <Card className="p-4 bg-card/60 border-border/40 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Habilidade Visual</span>
        </div>
        <Badge variant="outline" className={level.color}>
          {skill.globalScore} — {level.label}
        </Badge>
      </div>

      {/* Progress bar */}
      <Progress value={skill.globalScore} className="h-2" />

      {/* Strong / Weak */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {strongLabel && (
          <div className="flex items-center gap-1 text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            <span>Forte: {strongLabel}</span>
          </div>
        )}
        {weakLabel && (
          <div className="flex items-center gap-1 text-orange-400">
            <TrendingDown className="h-3 w-3" />
            <span>Fraqueza: {weakLabel}</span>
          </div>
        )}
      </div>

      {/* Alerts */}
      {skill.weaknessAlerts.length > 0 && (
        <div className="space-y-1">
          {skill.weaknessAlerts.slice(0, 3).map((alert, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-500 shrink-0" />
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          const params = skill.weakestArea ? `?type=${skill.weakestArea}` : "";
          navigate(`/image-quiz${params}`);
        }}
      >
        {skill.weakestArea
          ? `Treinar ${weakLabel}`
          : "Treinar imagens"}
        <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    </Card>
  );
}
