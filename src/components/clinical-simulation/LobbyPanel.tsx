import React, { memo } from "react";
import { Activity, Loader2, Zap, MessageCircle, Stethoscope, FileSearch, Syringe, GraduationCap, History, RotateCcw, CheckCircle, XCircle, Eye, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import CycleFilter, { getFilteredSpecialties } from "@/components/CycleFilter";

const PEDIATRIC_AGE_RANGES = [
  { key: "neonato", label: "Neonato (0-28 dias)", vitalRef: "FC 120-160, FR 40-60, PA 60-80/30-45, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "lactente", label: "Lactente (1-24 meses)", vitalRef: "FC 100-150, FR 25-40, PA 80-100/50-65, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "pre_escolar", label: "Pré-escolar (2-6 anos)", vitalRef: "FC 80-120, FR 20-30, PA 85-110/50-70, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "escolar", label: "Escolar (7-12 anos)", vitalRef: "FC 70-110, FR 18-25, PA 90-120/55-75, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "adolescente", label: "Adolescente (13-17 anos)", vitalRef: "FC 60-100, FR 12-20, PA 100-130/60-80, Temp 36.5-37.5, SpO2 ≥95%" },
  { key: "aleatorio", label: "Aleatório", vitalRef: "" },
];

interface LobbyPanelProps {
  // Setup state
  specialty: string;
  cycleFilter: string | null;
  subtopic: string;
  difficulty: string;
  pediatricAge: string;
  realisticMode: boolean;
  learnerMode: boolean;
  loading: boolean;
  // Setters
  onSpecialtyChange: (s: string) => void;
  onCycleChange: (c: string | null) => void;
  onSubtopicChange: (s: string) => void;
  onDifficultyChange: (d: string) => void;
  onPediatricAgeChange: (a: string) => void;
  onRealisticChange: (b: boolean) => void;
  onLearnerChange: (b: boolean) => void;
  onStart: () => void;
  // Resume
  pendingSession: { updated_at: string; session_data: Record<string, any> } | null;
  resumeChecked: boolean;
  onResume: (data: Record<string, any>) => void;
  onAbandon: () => void;
  // History
  history: any[];
  historyLoading: boolean;
  onRefreshHistory: () => void;
  onSelectHistory: (h: any) => void;
  onDeleteHistory: (id: string) => void;
}

const LobbyPanel = memo(function LobbyPanel({
  specialty, cycleFilter, subtopic, difficulty, pediatricAge, realisticMode, learnerMode, loading,
  onSpecialtyChange, onCycleChange, onSubtopicChange, onDifficultyChange, onPediatricAgeChange,
  onRealisticChange, onLearnerChange, onStart,
  pendingSession, resumeChecked, onResume, onAbandon,
  history, historyLoading, onRefreshHistory, onSelectHistory, onDeleteHistory,
}: LobbyPanelProps) {
  const isPediatrics = specialty === "Pediatria";

  return (
    <div className="space-y-4">
      <StudyContextBanner />
      {resumeChecked && pendingSession && (
        <ResumeSessionBanner
          updatedAt={pendingSession.updated_at}
          onResume={() => onResume(pendingSession.session_data)}
          onDiscard={onAbandon}
        />
      )}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <Activity className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">🏥 Plantão Clínico</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Atenda um paciente virtual em tempo real. Faça anamnese, peça exames,
              defina diagnóstico e prescreva o tratamento. Cada decisão afeta sua pontuação!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { icon: MessageCircle, label: "Anamnese", desc: "Interrogue o paciente" },
              { icon: Stethoscope, label: "Exame Físico", desc: "Examine o paciente" },
              { icon: FileSearch, label: "Exames", desc: "Peça complementares" },
              { icon: Syringe, label: "Conduta", desc: "Prescreva e trate" },
            ].map((step, i) => (
              <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <step.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-xs font-semibold">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Especialidade do Caso</label>
              <CycleFilter activeCycle={cycleFilter} onCycleChange={onCycleChange} className="mb-2" />
              <select
                value={specialty}
                onChange={(e) => onSpecialtyChange(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {getFilteredSpecialties(cycleFilter).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Input
                value={subtopic}
                onChange={(e) => onSubtopicChange(e.target.value)}
                placeholder="Ex: IAM, Dengue Grave, Eclâmpsia..."
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">Subassunto (opcional): direcione o caso clínico</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dificuldade</label>
              <select
                value={difficulty}
                onChange={(e) => onDifficultyChange(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="básico">Básico</option>
                <option value="intermediário">Intermediário</option>
                <option value="avançado">Avançado</option>
              </select>
            </div>
          </div>

          {isPediatrics && (
            <div className="animate-fade-in space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                👶 Faixa Etária Pediátrica
              </label>
              <select
                value={pediatricAge}
                onChange={(e) => onPediatricAgeChange(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {PEDIATRIC_AGE_RANGES.map(a => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
              {pediatricAge !== "aleatorio" && (
                <p className="text-xs text-muted-foreground">
                  📊 Valores de referência: {PEDIATRIC_AGE_RANGES.find(a => a.key === pediatricAge)?.vitalRef}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
            <div className="space-y-1">
              <label className="text-sm font-semibold flex items-center gap-2">🔴 Modo Real</label>
              <p className="text-xs text-muted-foreground">
                Paciente piora automaticamente se você demorar para agir (90s de inatividade)
              </p>
            </div>
            <Switch checked={realisticMode} onCheckedChange={onRealisticChange} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
            <div className="space-y-1">
              <label className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Modo Aprendiz
              </label>
              <p className="text-xs text-muted-foreground">
                Receba dicas didáticas contextuais após cada ação clínica
              </p>
            </div>
            <Switch checked={learnerMode} onCheckedChange={onLearnerChange} />
          </div>
          <Button onClick={onStart} disabled={loading} className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loading ? "Preparando plantão..." : "🚨 Iniciar Plantão"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Histórico de Plantões
            </h4>
            <Button variant="ghost" size="sm" onClick={onRefreshHistory} disabled={historyLoading} className="text-xs gap-1">
              <RotateCcw className={`h-3 w-3 ${historyLoading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>

          {historyLoading && history.length === 0 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!historyLoading && history.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum plantão concluído ainda. Inicie seu primeiro plantão!
            </p>
          )}

          {history.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map((h) => {
                const gradeColor: Record<string, string> = { A: "text-green-500", B: "text-blue-500", C: "text-amber-500", D: "text-orange-500", F: "text-destructive" };
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => onSelectHistory(h)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-black ${gradeColor[h.grade] || "text-muted-foreground"}`}>{h.grade}</span>
                        <span className="text-[10px] text-muted-foreground">{h.final_score}/100</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{h.specialty}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{h.difficulty}</span>
                          <span>•</span>
                          <span>{h.time_total_minutes} min</span>
                          <span>•</span>
                          <span>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {h.student_got_diagnosis ? (
                        <Badge className="bg-green-500/20 text-green-500 text-[10px] gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> ✓</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] gap-0.5"><XCircle className="h-2.5 w-2.5" /> ✗</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDeleteHistory(h.id); }}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default LobbyPanel;
