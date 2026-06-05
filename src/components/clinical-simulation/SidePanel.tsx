import React, { memo } from "react";
import { Shield, CheckCircle, Wind, Droplets, Brain, Eye, Target, Clipboard } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import VitalsMonitor from "@/components/plantao/VitalsMonitor";

export const ABCDE_STEPS = [
  { key: "A", label: "Vias Aéreas", icon: Wind, keywords: ["via aérea", "vias aéreas", "airway", "orofaringe", "cânula", "guedel", "intub", "iot", "traqueo", "aspirar via"] },
  { key: "B", label: "Respiração", icon: Wind, keywords: ["ausculta pulmonar", "respiratório", "pulmão", "pulmões", "murmúrio", "sibilos", "estertores", "crepitações", "oxigên", "spo2", "ventil", "ambu", "nebuliz"] },
  { key: "C", label: "Circulação", icon: Droplets, keywords: ["acesso venoso", "hidratação", "soro", "cristaloide", "volume", "pulso", "perfusão", "enchimento capilar", "hemorrag", "sangr", "droga vasoativa", "noradrenalina", "ausculta cardíaca", "cardiovascular"] },
  { key: "D", label: "Neurológico", icon: Brain, keywords: ["neurológico", "consciência", "glasgow", "pupilas", "reflexo", "força muscular", "sensibilidade", "meníngeo", "nível de consciência", "confuso", "orientado"] },
  { key: "E", label: "Exposição", icon: Eye, keywords: ["exposição", "despir", "temperatura", "hipotermia", "pele", "mucosa", "dorso", "região lombar", "extremidades", "membros", "edema", "cianose", "turgor"] },
] as const;

export interface CategoryScores {
  anamnesis: number;
  physical_exam: number;
  complementary_exams: number;
  management: number;
}

interface MedicalRecordEntry {
  category: "anamnesis" | "physical_exam" | "lab" | "imaging" | "prescription" | "other";
  summary: string;
  system?: string;
  timestamp: number;
}

interface SidePanelProps {
  vitalsSnapshots: any[];
  patientStatus: string;
  statusAlert: boolean;
  abcdeChecklist: Record<string, boolean>;
  categoryScores: CategoryScores;
  differentialDiagnosis: string[];
  medicalRecord: MedicalRecordEntry[];
  medRecordOpen: boolean;
  onMedRecordOpenChange: (b: boolean) => void;
}


const SidePanel = memo(function SidePanel({
  vitalsSnapshots, patientStatus, statusAlert, abcdeChecklist, categoryScores,
  medicalRecord, medRecordOpen, onMedRecordOpenChange,
}: SidePanelProps) {
  const checkedCount = Object.values(abcdeChecklist).filter(Boolean).length;

  return (
    <div className="hidden lg:flex flex-col border-r border-border/30 bg-muted/5 overflow-y-auto">
      <div className="p-3 space-y-4">
        <VitalsMonitor
          snapshots={vitalsSnapshots}
          patientStatus={patientStatus}
          statusAlert={statusAlert}
        />

        {/* ABCDE Checklist */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ABCDE</span>
            <span className="text-[10px] text-muted-foreground">{checkedCount}/5</span>
          </div>
          <div className="space-y-1">
            {ABCDE_STEPS.map(step => (
              <div key={step.key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                abcdeChecklist[step.key]
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-muted/20 border border-border/20 opacity-40"
              }`}>
                <step.icon className={`h-3.5 w-3.5 ${abcdeChecklist[step.key] ? "text-emerald-400" : "text-muted-foreground"}`} />
                <span className="text-[11px] font-medium flex-1">{step.label}</span>
                {abcdeChecklist[step.key] && <CheckCircle className="h-3 w-3 text-emerald-400" />}
              </div>
            ))}
          </div>
        </div>

        {/* Category Scores */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Desempenho</span>
          </div>
          {[
            { key: "anamnesis", label: "Anamnese", max: 15 },
            { key: "physical_exam", label: "Ex. Físico", max: 15 },
            { key: "complementary_exams", label: "Exames", max: 15 },
            { key: "management", label: "Conduta", max: 15 },
          ].map(cat => (
            <div key={cat.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{cat.label}</span>
                <span className="font-mono font-bold">{categoryScores[cat.key as keyof CategoryScores]}/{cat.max}</span>
              </div>
              <Progress value={(categoryScores[cat.key as keyof CategoryScores] / cat.max) * 100} className="h-1" />
            </div>
          ))}
        </div>

        {/* Prontuário */}
        <Sheet open={medRecordOpen} onOpenChange={onMedRecordOpenChange}>
          <SheetTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
              <Clipboard className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold block">Prontuário</span>
                <span className="text-[9px] text-muted-foreground">{medicalRecord.length} registros</span>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[340px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-primary" /> Mini-Prontuário
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3 overflow-y-auto max-h-[80vh]">
              {medicalRecord.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma informação coletada ainda.</p>
              )}
              {(["anamnesis", "physical_exam", "lab", "imaging", "prescription"] as const).map(cat => {
                const entries = medicalRecord.filter(e => e.category === cat);
                if (entries.length === 0) return null;
                const catLabels: Record<string, string> = { anamnesis: "📋 Anamnese", physical_exam: "🩺 Exame Físico", lab: "🔬 Laboratório", imaging: "📷 Imagem", prescription: "💊 Prescrição" };
                return (
                  <div key={cat} className="space-y-1">
                    <p className="text-xs font-semibold">{catLabels[cat]}</p>
                    {entries.map((e, i) => (
                      <div key={i} className="text-xs text-muted-foreground p-2 rounded bg-muted/30 border border-border/30">
                        {e.system && <Badge variant="outline" className="text-[10px] mb-1">{e.system}</Badge>}
                        <p>{e.summary}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
});

export default SidePanel;
