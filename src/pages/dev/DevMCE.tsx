import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemoryConsolidationCard } from "@/components/study/MemoryConsolidationCard";
import type { CompleteSessionResult } from "@/types/memoryConsolidation";

type Preset = {
  id: "full" | "standard" | "simplified";
  label: string;
  topicLabel: string;
  specialty: string;
  highYieldScore: number;
  enamedRelevance: number;
  recentMistakes: string[];
};

const PRESETS: Preset[] = [
  {
    id: "full",
    label: "Rigor pleno (high-yield crítico)",
    topicLabel: "IAM com supra de ST",
    specialty: "Cardiologia",
    highYieldScore: 92,
    enamedRelevance: 95,
    recentMistakes: ["confundiu Killip III com IV", "atrasou trombólise"],
  },
  {
    id: "standard",
    label: "Rigor padrão (HYS médio)",
    topicLabel: "Pneumonia adquirida na comunidade",
    specialty: "Pneumologia",
    highYieldScore: 55,
    enamedRelevance: 60,
    recentMistakes: ["errou critério CURB-65"],
  },
  {
    id: "simplified",
    label: "Rigor simplificado (HYS baixo)",
    topicLabel: "Acne vulgar",
    specialty: "Dermatologia",
    highYieldScore: 25,
    enamedRelevance: 20,
    recentMistakes: [],
  },
];

const CHECKLIST = [
  "start cria sessão sem erro RLS/auth",
  "step responde nas 3 trilhas (full/standard/simplified)",
  "complete retorna output estruturado",
  "false_confidence dispara quando confiança ≥80 e mastery <60",
  "enamed_takeaways aparecem no resultado",
  "advance_allowed / micro_reinforcement_required corretos",
];

export default function DevMCE() {
  const [preset, setPreset] = useState<Preset | null>(null);
  const [lastResult, setLastResult] = useState<CompleteSessionResult | null>(null);
  const [runs, setRuns] = useState<Record<string, CompleteSessionResult>>({});

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Memory Consolidation Engine — Dev Harness</h1>
        <p className="text-muted-foreground">
          Validação isolada das 3 trilhas de rigor antes de pendurar no SessaoEstudo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critérios de aprovação</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Badge variant={Object.keys(runs).length >= 3 ? "default" : "secondary"} className="h-5 text-[10px]">
                  {Object.keys(runs).length >= 3 ? "OK" : "..."}
                </Badge>
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presets</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              variant={preset?.id === p.id ? "default" : "outline"}
              onClick={() => {
                setPreset(p);
                setLastResult(null);
              }}
            >
              {p.label}
              {runs[p.id] ? <Badge className="ml-2" variant="secondary">✓</Badge> : null}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => { setPreset(null); setLastResult(null); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {preset && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">tema: {preset.topicLabel}</Badge>
            <Badge variant="outline">esp: {preset.specialty}</Badge>
            <Badge variant="outline">HYS: {preset.highYieldScore}</Badge>
            <Badge variant="outline">ENAMED: {preset.enamedRelevance}</Badge>
          </div>
          <MemoryConsolidationCard
            key={preset.id}
            topicLabel={preset.topicLabel}
            specialty={preset.specialty}
            highYieldScore={preset.highYieldScore}
            enamedRelevance={preset.enamedRelevance}
            recentMistakes={preset.recentMistakes}
            source="tutor_v3"
            onCompleted={(r) => {
              setLastResult(r);
              setRuns((prev) => ({ ...prev, [preset.id]: r }));
            }}
          />
        </div>
      )}

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Output bruto (debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
