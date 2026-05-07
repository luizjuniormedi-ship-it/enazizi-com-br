import { memo, useMemo } from "react";
import { Gauge, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { EXAM_PROFILES } from "@/lib/examProfiles";

interface Props {
  questionCount: string;
  timeLimit: string;
  difficulty: string;
  difficultyMix: { facil: number; intermediario: number; dificil: number };
  examBoard: string;
  selectedTopics: string[];
  onQuestionCountChange: (v: string) => void;
  onTimeLimitChange: (v: string) => void;
  onDifficultyChange: (v: string) => void;
  onUpdateDifficultyMix: (key: "facil" | "intermediario" | "dificil", val: number) => void;
  onExamBoardChange: (v: string) => void;
}

const DIFFICULTY_KEYS = [
  { key: "facil" as const, label: "Fácil", emoji: "🟢", color: "text-emerald-500" },
  { key: "intermediario" as const, label: "Intermediário", emoji: "🟡", color: "text-yellow-500" },
  { key: "dificil" as const, label: "Difícil", emoji: "🔴", color: "text-red-500" },
];

const BANCA_KEY_MAP: Record<string, string> = {
  ENARE: "enare",
  REVALIDA: "revalida",
  "USP-SP": "usp",
  UNIFESP: "unifesp",
  "SUS-SP": "sus-sp",
  UNICAMP: "unicamp",
  SANTA_CASA: "santa-casa-sp",
};

/**
 * Bloco de quantidade + tempo + dificuldade (com sliders) + banca.
 * Isolado para que arrastar slider não rerenderize alunos, temas ou questões.
 */
const SimuladoDifficultyMix = memo(function SimuladoDifficultyMix({
  questionCount, timeLimit, difficulty, difficultyMix, examBoard, selectedTopics,
  onQuestionCountChange, onTimeLimitChange, onDifficultyChange,
  onUpdateDifficultyMix, onExamBoardChange,
}: Props) {
  const totalQ = parseInt(questionCount);
  const facilCount = Math.round((totalQ * difficultyMix.facil) / 100);
  const intermedCount = Math.round((totalQ * difficultyMix.intermediario) / 100);
  const dificilCount = totalQ - facilCount - intermedCount;

  const bancaProfile = useMemo(() => {
    if (examBoard === "all") return null;
    return EXAM_PROFILES[BANCA_KEY_MAP[examBoard] || "outra"];
  }, [examBoard]);

  const sortedWeights = useMemo(() => {
    if (!bancaProfile) return [];
    return Object.entries(bancaProfile.specialtyWeights).sort((a, b) => b[1] - a[1]);
  }, [bancaProfile]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Quantidade</Label>
          <Select value={questionCount} onValueChange={onQuestionCountChange}>
            <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 20, 30, 40, 50, 60, 80, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} questões</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Tempo Limite</Label>
          <Select value={timeLimit} onValueChange={onTimeLimitChange}>
            <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[30, 60, 90, 120, 180].map((m) => (
                <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Difficulty */}
      <div className="space-y-3 border border-white/5 rounded-2xl p-4 bg-white/5">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-80">Nível de Dificuldade</Label>
        </div>
        <Select value={difficulty} onValueChange={onDifficultyChange}>
          <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facil">🟢 Fácil</SelectItem>
            <SelectItem value="intermediario">🟡 Intermediário</SelectItem>
            <SelectItem value="dificil">🔴 Difícil</SelectItem>
            <SelectItem value="misto">🎯 Misto (personalizado)</SelectItem>
          </SelectContent>
        </Select>

        {difficulty === "misto" && (
          <div className="space-y-3">
            {DIFFICULTY_KEYS.map(({ key, label, emoji, color }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{emoji} {label}</span>
                  <span className={`font-bold ${color}`}>{difficultyMix[key]}%</span>
                </div>
                <Slider
                  value={[difficultyMix[key]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([val]) => onUpdateDifficultyMix(key, val)}
                />
              </div>
            ))}

            <div className="bg-secondary/50 rounded-md p-2 text-xs text-center">
              <span className="font-medium">{questionCount} questões →</span>{" "}
              <span className="text-emerald-500">{facilCount} fáceis</span>,{" "}
              <span className="text-yellow-500">{intermedCount} intermediárias</span>,{" "}
              <span className="text-red-500">{dificilCount} difíceis</span>
            </div>
          </div>
        )}

        {difficulty !== "misto" && (
          <p className="text-xs text-muted-foreground">
            Todas as {questionCount} questões serão de nível{" "}
            {difficulty === "facil"
              ? "fácil"
              : difficulty === "intermediario"
              ? "intermediário"
              : "difícil"}.
          </p>
        )}
      </div>

      {/* Banca */}
      <div className="space-y-3 border border-white/5 rounded-2xl p-4 bg-white/5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-80">Estilo de Banca</Label>
        </div>
        <Select value={examBoard} onValueChange={onExamBoardChange}>
          <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as bancas</SelectItem>
            <SelectItem value="ENARE">ENARE</SelectItem>
            <SelectItem value="REVALIDA">REVALIDA</SelectItem>
            <SelectItem value="USP-SP">USP-SP</SelectItem>
            <SelectItem value="UNIFESP">UNIFESP</SelectItem>
            <SelectItem value="SUS-SP">SUS-SP</SelectItem>
            <SelectItem value="UNICAMP">UNICAMP</SelectItem>
            <SelectItem value="SANTA_CASA">Santa Casa SP</SelectItem>
          </SelectContent>
        </Select>
        {bancaProfile && (
          <div className="space-y-1.5 mt-1">
            <p className="text-xs font-medium text-muted-foreground">
              Distribuição da {examBoard}:
            </p>
            <div className="flex flex-wrap gap-1">
              {sortedWeights.map(([spec, w]) => (
                <Badge
                  key={spec}
                  variant={selectedTopics.includes(spec) ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {spec} ({w}%)
                </Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {examBoard === "all"
            ? "Questões com estilo genérico."
            : "Temas da banca adicionados automaticamente."}
        </p>
      </div>
    </>
  );
});

export default SimuladoDifficultyMix;
