import { useState, useMemo, useEffect } from "react";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import { FileText, Play, History, BookOpen, Timer, Skull, Trophy, Brain, Zap, Target, TrendingDown, Image, Swords, CheckCircle2, Clock } from "lucide-react";
import { CinematicHero } from "@/components/cinematic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import SimuladoHistory from "./SimuladoHistory";
import { EXAM_PROFILES, calculateTopicDistribution, calculateDifficultySlots, type TopicDistributionItem } from "@/lib/realExamDistribution";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useExamDistribution } from "@/hooks/useExamDistribution";
import type { ExamDistributionTree } from "@/lib/examDistributionFromCurriculum";
import { Loader2 } from "lucide-react";

import { ALL_SPECIALTIES as ALL_TOPICS, SPECIALTY_CYCLES } from "@/constants/specialties";
import { SPECIALTY_SUBTOPICS } from "@/constants/subtopics";
import CycleFilter, { getFilteredSpecialties } from "@/components/CycleFilter";

const DIFFICULTY_OPTIONS = [
  { value: "facil", label: "Fácil" },
  { value: "intermediario", label: "Intermediário" },
  { value: "dificil", label: "Difícil" },
  { value: "misto", label: "Misto" },
];

const EXAM_BOARDS = [
  { value: "all", label: "Todas as bancas" },
  { value: "ENARE", label: "ENARE" },
  { value: "REVALIDA", label: "REVALIDA" },
  { value: "USP-SP", label: "USP-SP" },
  { value: "UNIFESP", label: "UNIFESP" },
  { value: "SUS-SP", label: "SUS-SP" },
  { value: "UNICAMP", label: "UNICAMP" },
  { value: "SANTA_CASA", label: "Santa Casa SP" },
];

export type SimuladoMode = "prova" | "estudo" | "extremo" | "prova_real" | "tri" | "adaptativo";

interface SimuladoSetupProps {
  onStart: (config: { 
    topics: string[]; 
    count: number; 
    difficulty: string; 
    timePerQuestion: number; 
    mode: SimuladoMode; 
    specificTopic?: string; 
    examBoard?: string; 
    realExamProfile?: string; 
    imagePercent?: number; 
    dynamicDistribution?: ExamDistributionTree; 
    topicWeights?: any[];
    autoDistribution?: boolean;
    customDistribution?: TopicDistributionItem[];
    includeWeakThemes?: boolean;
    includePreviousErrors?: boolean;
  }) => void;
  onResumeSession: () => void;
  onDiscardSession: () => void;
  onRetryErrors: (sessionId: string) => void;
  pendingSession: any;
  checkedSession: boolean;
  userId?: string;
  adaptiveMeta?: { focus: string; strategy: string; weakness_targeted: string; distribution: { modalities: Record<string, number>; difficulty: Record<string, number>; exam_style: Record<string, number> } } | null;
  adaptiveLoading?: boolean;
  onFetchAdaptivePreview?: () => void;
}

/**
 * Prévia visual da distribuição de temas (com drill-down opcional em subáreas).
 * Apenas informativo — não altera a geração da prova.
 */
const TopicDistributionPreview = ({
  items,
  total,
  barColorClass,
}: {
  items: TopicDistributionItem[];
  total: number;
  barColorClass: string;
}) => {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const hasSubtopics = !!item.subtopics && item.subtopics.length > 0;
        const row = (
          <div className="flex items-center justify-between text-sm w-full">
            <span className="text-muted-foreground text-left">{item.topic}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColorClass}`}
                  style={{ width: `${(item.count / total) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium w-16 text-right">
                {item.count}q ({item.percent}%)
              </span>
            </div>
          </div>
        );

        if (!hasSubtopics) {
          return (
            <div key={item.topic} className="px-1">
              {row}
            </div>
          );
        }

        return (
          <Accordion
            key={item.topic}
            type="single"
            collapsible
            className="border-b-0"
          >
            <AccordionItem value={item.topic} className="border-b-0">
              <AccordionTrigger className="py-1 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                {row}
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <ul className="ml-3 mt-1 space-y-1 border-l border-border pl-3">
                  {item.subtopics!.map((s) => (
                    <li
                      key={s.name}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>{s.name}</span>
                      <span className="font-medium tabular-nums">
                        {s.count}q ({s.percent}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );
};

/**
 * Prévia dinâmica baseada em `curriculum_weights` (3 níveis: specialty →
 * topic → subtopic). Mostra um badge de fonte ("Distribuição dinâmica" ou
 * "Fallback estático"). Quando carregando, exibe um placeholder leve.
 */
const DynamicDistributionPreview = ({
  data,
  isLoading,
  total,
  barColorClass,
}: {
  data: ExamDistributionTree | undefined;
  isLoading: boolean;
  total: number;
  barColorClass: string;
}) => {
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Calculando distribuição...
      </div>
    );
  }

  const isDynamic = data.source === "curriculum_weights";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            isDynamic
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
          title={
            isDynamic
              ? `Pesos reais da banca ${data.debug.bancaUsed} (${data.debug.rawWeightsCount} pesos)`
              : "Esta banca ainda não tem pesos curriculares cadastrados"
          }
        >
          {isDynamic ? "● Distribuição dinâmica" : "○ Fallback estático"}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {data.specialties.length} áreas · {data.totalQuestions}q
        </span>
      </div>

      <div className="space-y-1">
        {data.specialties.map((spec) => {
          const hasTopics = spec.topics.length > 0;
          const specPercent = total > 0 ? Math.round((spec.estimatedQuestions / total) * 100) : 0;

          const headerRow = (
            <div className="flex items-center justify-between text-sm w-full">
              <span className="text-muted-foreground text-left flex items-center gap-1.5">
                {spec.specialtyName}
                {spec.isVirtualGroup && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                    title="Agrupamento virtual de subespecialidades clínicas"
                  >
                    grupo
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColorClass}`}
                    style={{ width: `${specPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-16 text-right tabular-nums">
                  {spec.estimatedQuestions}q ({specPercent}%)
                </span>
              </div>
            </div>
          );

          if (!hasTopics) {
            return (
              <div key={spec.specialtyName} className="px-1 py-1">
                {headerRow}
              </div>
            );
          }

          return (
            <Accordion
              key={spec.specialtyName}
              type="single"
              collapsible
              className="border-b-0"
            >
              <AccordionItem value={spec.specialtyName} className="border-b-0">
                <AccordionTrigger className="py-1 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  {headerRow}
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <ul className="ml-3 mt-1 space-y-1.5 border-l border-border pl-3">
                    {spec.topics.map((topic) => {
                      const hasSubs = topic.subtopics.length > 0;
                      const topicPercent =
                        total > 0
                          ? Math.round((topic.estimatedQuestions / total) * 100)
                          : 0;

                      return (
                        <li key={topic.topicId ?? topic.topicName} className="text-xs">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              {topic.topicName}
                            </span>
                            <span className="font-medium tabular-nums">
                              {topic.estimatedQuestions}q ({topicPercent}%)
                            </span>
                          </div>
                          {hasSubs && (
                            <ul className="ml-2 mt-1 space-y-0.5 border-l border-border/50 pl-2">
                              {topic.subtopics.map((sub) => (
                                <li
                                  key={sub.subtopicId ?? sub.subtopicName}
                                  className="flex items-center justify-between text-[11px] text-muted-foreground/80"
                                >
                                  <span>{sub.subtopicName}</span>
                                  <span className="tabular-nums">
                                    {sub.estimatedQuestions}q
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}
      </div>
    </div>
  );
};

const SimuladoSetup = ({ onStart, onResumeSession, onDiscardSession, onRetryErrors, pendingSession, checkedSession, userId, adaptiveMeta, adaptiveLoading, onFetchAdaptivePreview }: SimuladoSetupProps) => {
  const studyCtx = useStudyContext();
  const [tab, setTab] = useState<"novo" | "historico">("novo");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(() => {
    if (studyCtx?.specialty) return [studyCtx.specialty];
    if (studyCtx?.topic) return [studyCtx.topic];
    return [];
  });
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const [difficulty, setDifficulty] = useState("misto");
  const [timePerQuestion, setTimePerQuestion] = useState(3);
  const [specificTopic, setSpecificTopic] = useState("");
  const [examBoard, setExamBoard] = useState("all");
  const [mode, setMode] = useState<SimuladoMode>("estudo");
  const [realExamBoard, setRealExamBoard] = useState("GERAL");
  const [imagePercent, setImagePercent] = useState(20);

  // New states for configuration flow
  const [configStep, setConfigStep] = useState<"choosing" | "configuring">("choosing");
  const [generationMethod, setGenerationMethod] = useState<"automatic" | "custom">("automatic");
  const [customDistribution, setCustomDistribution] = useState<TopicDistributionItem[]>([]);
  const [includeWeakThemes, setIncludeWeakThemes] = useState(false);
  const [includePreviousErrors, setIncludePreviousErrors] = useState(false);
  const [customTotalQuestions, setCustomTotalQuestions] = useState<number>(0);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const selectedProfile = EXAM_PROFILES[realExamBoard] || EXAM_PROFILES.GERAL;

  // Initialize custom distribution when board or total questions changes
  useEffect(() => {
    if (mode === "prova_real" || mode === "tri") {
      const profile = EXAM_PROFILES[realExamBoard] || EXAM_PROFILES.GERAL;
      const initialDist = calculateTopicDistribution(profile, profile.totalQuestions);
      setCustomDistribution(initialDist);
      setCustomTotalQuestions(profile.totalQuestions);
    }
  }, [realExamBoard, mode]);

  // Distribuição dinâmica baseada em curriculum_weights (com fallback automático)
  const showDynamicPreview = mode === "prova_real" || mode === "tri";
  const { data: dynamicDistribution, isLoading: dynamicLoading } = useExamDistribution(
    showDynamicPreview ? realExamBoard : null,
    selectedProfile.totalQuestions,
  );

  const handleStart = () => {
    if (mode === "adaptativo") {
      const count = customCount ? parseInt(customCount) : questionCount;
      onStart({ topics: [], count, difficulty: "adaptativo", timePerQuestion: 3, mode: "adaptativo" });
      return;
    }
    if (mode === "prova_real" || mode === "tri") {
      const profile = selectedProfile;
      const topicsFromProfile = profile.topicWeights.map(tw => tw.topic);
      const count = profile.totalQuestions;
      const timePerQ = profile.timeMinutes / count;
      onStart({
        topics: topicsFromProfile,
        count,
        difficulty: mode === "tri" ? "tri" : "prova_real",
        timePerQuestion: timePerQ,
        mode,
        examBoard: realExamBoard,
        realExamProfile: realExamBoard,
        dynamicDistribution: dynamicDistribution?.source === "curriculum_weights"
          ? dynamicDistribution
          : undefined,
        topicWeights: profile.topicWeights,
      });
      return;
    }
    const count = customCount ? parseInt(customCount) : questionCount;
    
    // Fallback: If no topics selected but it's not a profile mode, 
    // we default to Clínica Médica to avoid blocking the user
    const finalTopics = selectedTopics.length > 0 ? selectedTopics : ["Clínica Médica"];
    
    onStart({ 
      topics: finalTopics, 
      count, 
      difficulty, 
      timePerQuestion, 
      mode, 
      specificTopic: specificTopic.trim() || undefined, 
      examBoard: examBoard !== "all" ? examBoard : undefined, 
      imagePercent 
    });
  };

  const totalTime = mode === "prova_real" || mode === "tri"
    ? selectedProfile.timeMinutes
    : (customCount ? parseInt(customCount) || questionCount : questionCount) * timePerQuestion;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <StudyContextBanner />
      {checkedSession && pendingSession && (
        <ResumeSessionBanner
          updatedAt={pendingSession.updated_at}
          onResume={onResumeSession}
          onDiscard={onDiscardSession}
        />
      )}

      <CinematicHero
        module="simulado"
        eyebrow={<><Swords className="h-3.5 w-3.5" /> Arena mental · Preparação de elite</>}
        title="Simulados"
        subtitle="Configure dificuldade, banca e cronômetro. Modo Estudo para feedback imediato, Modo Prova para tensão real, Prova Real e TRI para preparação cirúrgica."
        actions={
          <ModuleHelpButton moduleKey="simulados" moduleName="Simulados" steps={[
            "Escolha entre Modo Estudo (feedback imediato) ou Modo Prova (cronômetro)",
            "Selecione uma ou mais especialidades clicando nos chips de tema",
            "Defina a quantidade de questões (5 a 100) e o nível de dificuldade",
            "No Modo Estudo: veja explicação após cada resposta e aprenda em tempo real",
            "No Modo Prova: cronômetro, sem feedback, resultado completo no final",
            "No Modo Prova Real: simula uma prova de residência completa com distribuição real de temas",
            "Marque questões com a flag para revisão posterior em ambos os modos",
          ]} />
        }
        media={
          <div className="hidden lg:flex h-24 w-24 items-center justify-center rounded-2xl glass-premium-strong glow-module">
            <FileText className="h-10 w-10 text-module" />
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 pb-0 mb-6">
        <button
          onClick={() => setTab("novo")}
          className={`px-6 py-3 text-[13px] font-black uppercase tracking-widest border-b-2 transition-all duration-300 ${
            tab === "novo" 
              ? "border-primary text-primary shadow-[0_4px_12px_-4px_rgba(var(--primary-rgb),0.3)]" 
              : "border-transparent text-muted-foreground/60 hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Play className={`h-4 w-4 transition-transform duration-300 ${tab === "novo" ? "scale-110" : ""}`} />
            Novo Simulado
          </div>
        </button>
        <button
          onClick={() => setTab("historico")}
          className={`px-6 py-3 text-[13px] font-black uppercase tracking-widest border-b-2 transition-all duration-300 ${
            tab === "historico" 
              ? "border-primary text-primary shadow-[0_4px_12px_-4px_rgba(var(--primary-rgb),0.3)]" 
              : "border-transparent text-muted-foreground/60 hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <History className={`h-4 w-4 transition-transform duration-300 ${tab === "historico" ? "scale-110" : ""}`} />
            Histórico
          </div>
        </button>
      </div>

      {tab === "historico" ? (
        <SimuladoHistory userId={userId} onRetryErrors={onRetryErrors} />
      ) : (
        <div className="glass-card p-6 space-y-6" data-testid="generation-modal">
          <button 
            data-testid="close-modal-btn" 
            className="hidden"
            onClick={() => setTab("novo")} 
          />
          {/* Mode toggle */}
          <div>
            <label className="text-sm font-semibold mb-3 block">Modo do Simulado</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                onClick={() => setMode("estudo")}
                data-testid="mode-estudo-button"
                className={`group p-4 rounded-2xl border-2 transition-all duration-300 text-left relative overflow-hidden ${
                  mode === "estudo"
                    ? "border-primary bg-primary/10 shadow-glow-sm"
                    : "border-white/5 bg-white/5 hover:border-primary/30 hover:bg-white/10"
                }`}
              >
                {mode === "estudo" && <div className="absolute top-0 right-0 p-2"><CheckCircle2 className="h-4 w-4 text-primary" /></div>}
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Modo Estudo</span>
                </div>
                <p className="text-xs text-muted-foreground">Feedback imediato. Sem cronômetro. Ideal para aprender.</p>
              </button>
              <button
                onClick={() => setMode("prova")}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  mode === "prova"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/30 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Modo Prova</span>
                </div>
                <p className="text-xs text-muted-foreground">Cronômetro ativo. Resultado só no final.</p>
              </button>
              <button
                onClick={() => {
                  setMode("prova_real");
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  mode === "prova_real"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-border bg-secondary/30 hover:border-amber-500/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="font-semibold text-sm">Prova Real</span>
                </div>
                <p className="text-xs text-muted-foreground">Simula prova de residência. Distribuição e dificuldade reais.</p>
              </button>
              <button
                onClick={() => {
                  setMode("tri");
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  mode === "tri"
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-border bg-secondary/30 hover:border-violet-500/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-5 w-5 text-violet-500" />
                  <span className="font-semibold text-sm">Nível ENARE/USP</span>
                </div>
                <p className="text-xs text-muted-foreground">TRI psicométrica. Ranking real. Nota ponderada.</p>
              </button>
              <button
                onClick={() => {
                  setMode("extremo");
                  setDifficulty("dificil");
                  if (!customCount && questionCount < 50) setQuestionCount(50);
                  setTimePerQuestion(2);
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  mode === "extremo"
                    ? "border-destructive bg-destructive/10"
                    : "border-border bg-secondary/30 hover:border-destructive/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Skull className="h-5 w-5 text-destructive" />
                  <span className="font-semibold text-sm">Modo Extremo</span>
                </div>
                <p className="text-xs text-muted-foreground">Prova real. 50+ questões. Dificuldade alta. Pressão máxima.</p>
               </button>
              <button
                onClick={() => {
                  setMode("adaptativo");
                  onFetchAdaptivePreview?.();
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  mode === "adaptativo"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-border bg-secondary/30 hover:border-emerald-500/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold text-sm">Adaptativo</span>
                </div>
                <p className="text-xs text-muted-foreground">Baseado no seu desempenho. Foco em fraquezas. Com imagem.</p>
              </button>
            </div>
          </div>

          {/* ── Adaptive Mode Configuration ── */}
          {mode === "adaptativo" && (
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Simulado Adaptativo Inteligente
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Analisa seu <strong>desempenho real</strong> por modalidade de imagem</li>
                  <li>• Prioriza <strong>fraquezas críticas</strong> automaticamente</li>
                  <li>• Mistura questões do banco + geradas por IA sob demanda</li>
                  <li>• Distribuição inteligente de dificuldade e banca</li>
                </ul>
              </div>

              {adaptiveLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Analisando seu desempenho...
                </div>
              )}

              {adaptiveMeta && !adaptiveLoading && (
                <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" /> Estratégia do Motor
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-1">Foco principal</p>
                      <p className="font-semibold capitalize">{adaptiveMeta.focus}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Fraquezas alvo</p>
                      <p className="font-semibold">{adaptiveMeta.weakness_targeted || "Nenhuma crítica"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{adaptiveMeta.strategy}</p>

                  {Object.keys(adaptiveMeta.distribution.modalities).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Distribuição por modalidade</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(adaptiveMeta.distribution.modalities).map(([mod, count]) => (
                          <span key={mod} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-medium">
                            {mod.toUpperCase()}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(adaptiveMeta.distribution.difficulty).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Distribuição por dificuldade</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(adaptiveMeta.distribution.difficulty).map(([diff, count]) => (
                          <span key={diff} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                            {diff}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Prova Real Configuration ── */}
          {mode === "prova_real" && (
            <>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Simulado Prova Real
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>{selectedProfile.totalQuestions} questões</strong> com distribuição de temas idêntica à prova real</li>
                  <li>• Dificuldade mista: {selectedProfile.difficultyMix.easy}% fácil, {selectedProfile.difficultyMix.medium}% médio, {selectedProfile.difficultyMix.hard}% difícil</li>
                  <li>• Cronômetro: <strong>{selectedProfile.timeMinutes} minutos</strong> ({Math.round(selectedProfile.timeMinutes / 60)}h)</li>
                  <li>• Nota de corte estimada: <strong>{selectedProfile.cutoffEstimate}%</strong></li>
                  <li>• Resultado com percentil estimado e análise competitiva</li>
                </ul>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Selecione a Banca</label>
                <Select value={realExamBoard} onValueChange={setRealExamBoard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a banca" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXAM_PROFILES).map(([key, profile]) => (
                      <SelectItem key={key} value={key} data-testid={`banca-${key.toLowerCase()}-button`}>{profile.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Topic distribution preview (dynamic from curriculum_weights, with static fallback) */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Distribuição de Temas</label>
                <DynamicDistributionPreview
                  data={dynamicDistribution}
                  isLoading={dynamicLoading}
                  total={selectedProfile.totalQuestions}
                  barColorClass="bg-amber-500"
                />
              </div>
            </>
          )}

          {/* ── TRI Mode Configuration ── */}
          {mode === "tri" && (
            <>
              <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-violet-600 flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Simulado Nível ENARE/USP — TRI
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Usa <strong>Teoria de Resposta ao Item (TRI)</strong> — modelo psicométrico real</li>
                  <li>• Cada questão tem parâmetros de discriminação, dificuldade e chute</li>
                  <li>• Nota ponderada: questões difíceis valem mais se você acertar</li>
                  <li>• <strong>Ranking estimado</strong> entre candidatos reais</li>
                  <li>• Distribuição: {selectedProfile.difficultyMix.easy}% fácil, {selectedProfile.difficultyMix.medium}% médio, {selectedProfile.difficultyMix.hard}% difícil</li>
                  <li>• Cronômetro: <strong>{selectedProfile.timeMinutes} minutos</strong></li>
                </ul>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Banca Alvo</label>
                <Select value={realExamBoard} onValueChange={setRealExamBoard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a banca" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXAM_PROFILES).map(([key, profile]) => (
                      <SelectItem key={key} value={key}>{profile.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Topic distribution preview (dynamic from curriculum_weights, with static fallback) */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Distribuição de Temas</label>
                <DynamicDistributionPreview
                  data={dynamicDistribution}
                  isLoading={dynamicLoading}
                  total={selectedProfile.totalQuestions}
                  barColorClass="bg-violet-500"
                />
              </div>
            </>
          )}

          {/* ── Standard modes: Topic selection ── */}
          {mode !== "prova_real" && mode !== "tri" && mode !== "adaptativo" && (
            <>
              {/* Topic selection grouped by cycle */}
              <div>
                <label className="text-sm font-semibold mb-3 block">Selecione os assuntos</label>
                <CycleFilter activeCycle={cycleFilter} onCycleChange={setCycleFilter} className="mb-3" />
                {(cycleFilter
                  ? [{ label: cycleFilter, specialties: getFilteredSpecialties(cycleFilter) }]
                  : SPECIALTY_CYCLES
                ).map(cycle => (
                  <div key={cycle.label} className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{cycle.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {cycle.specialties.map(topic => (
                        <button
                          key={topic}
                          onClick={() => toggleTopic(topic)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            selectedTopics.includes(topic)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedTopics([...ALL_TOPICS])}>
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedTopics([])}>
                    Limpar
                  </Button>
                </div>
              </div>

              {/* Subtopics based on selected specialties */}
              {(() => {
                const availableSubtopics = selectedTopics.flatMap(t => (SPECIALTY_SUBTOPICS[t] || []).map(sub => ({ specialty: t, sub })));
                if (availableSubtopics.length === 0) return null;
                return (
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Subtemas (opcional)</label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {availableSubtopics.map(({ specialty, sub }) => (
                        <button
                          key={`${specialty}-${sub}`}
                          onClick={() => setSpecificTopic(prev => {
                            const current = prev.split(",").map(s => s.trim()).filter(Boolean);
                            return current.includes(sub)
                              ? current.filter(s => s !== sub).join(", ")
                              : [...current, sub].join(", ");
                          })}
                          className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
                            specificTopic.split(",").map(s => s.trim()).includes(sub)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Clique para selecionar subtemas ou digite abaixo</p>
                  </div>
                );
              })()}

              {/* Specific topic free text */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Tema específico (opcional)</label>
                <Input
                  placeholder="Ex: Doença de Chagas, Pré-eclâmpsia, IAM com supra..."
                  value={specificTopic}
                  onChange={(e) => setSpecificTopic(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Deixe vazio para temas variados dentro das especialidades selecionadas</p>
              </div>

              {/* Exam Board */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Banca / Estilo de Prova</label>
                <Select value={examBoard} onValueChange={setExamBoard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as bancas" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_BOARDS.map(b => (
                      <SelectItem key={b.value} value={b.value} data-testid={`setup-banca-${b.value.toLowerCase()}-button`}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Questões geradas seguirão o estilo e formato da banca selecionada</p>
              </div>
            </>
          )}

          {/* Extreme mode info banner */}
          {mode === "extremo" && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                <Skull className="h-4 w-4" /> Modo Prova Extremo
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Dificuldade fixa: <strong>Alta</strong> — raciocínio clínico avançado</li>
                <li>• Mínimo 50 questões — simula prova real completa</li>
                <li>• 2 minutos por questão — pressão de tempo realista</li>
                <li>• Sem feedback durante a prova — resultado só no final</li>
                <li>• Relatório detalhado com plano corretivo pós-prova</li>
              </ul>
            </div>
          )}

          {/* Difficulty — locked in extremo and prova_real */}
          {mode !== "extremo" && mode !== "prova_real" && mode !== "tri" && mode !== "adaptativo" && (
            <div>
              <label className="text-sm font-semibold mb-3 block">Nível de dificuldade</label>
              <div className="flex gap-2 flex-wrap">
                {DIFFICULTY_OPTIONS.map(d => (
              <Button 
                key={d.value} 
                variant={difficulty === d.value ? "default" : "outline"} 
                size="sm" 
                onClick={() => setDifficulty(d.value)}
                className="h-9 px-4 rounded-xl font-black uppercase tracking-wider text-[10px]"
              >
                    {d.label}
                  </Button>
                ))}
              </div>
              {difficulty === "misto" && (
                <p className="text-xs text-muted-foreground mt-2">Distribuição: ~30% intermediárias, ~70% difíceis</p>
              )}
            </div>
          )}

          {/* Question count — extremo has higher presets, prova_real is fixed */}
          {mode !== "prova_real" && mode !== "tri" && (
            <div>
              <label className="text-sm font-semibold mb-3 block">Quantas questões?</label>
              <div className="flex gap-2 flex-wrap">
                {(mode === "extremo" ? [50, 80, 100] : [5, 10, 15, 20, 30, 50, 100]).map(n => (
                  <Button 
                    key={n} 
                    variant={questionCount === n && !customCount ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => { setQuestionCount(n); setCustomCount(""); }}
                    className="h-9 w-12 rounded-xl font-black text-[10px]"
                    data-testid={`qtd-${n}-button`}
                  >
                    {n}
                  </Button>
                ))}
                {mode !== "extremo" && (
                  <Input 
                    type="number" 
                    placeholder="Outro..." 
                    className="w-24 h-9" 
                    min={1} 
                    max={100} 
                    value={customCount} 
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (val > 100) return;
                      setCustomCount(e.target.value);
                    }} 
                  />
                )}
              </div>
              {(customCount ? parseInt(customCount) : questionCount) > 40 && (
                <p className="text-[10px] text-amber-500 font-bold mt-2 uppercase tracking-widest animate-pulse flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Geração em lote: levará mais tempo para preparar {customCount || questionCount} questões
                </p>
              )}
            </div>
          )}

          {/* Image questions percentage */}
          {mode !== "adaptativo" && (
            <div>
              <label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                Questões com imagem médica
              </label>
              <div className="flex gap-2 flex-wrap">
                {[0, 10, 20, 30, 50].map(pct => (
                  <Button
                    key={pct}
                    variant={imagePercent === pct ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImagePercent(pct)}
                    className="h-9 px-4 rounded-xl font-black uppercase tracking-wider text-[10px]"
                  >
                    {pct === 0 ? "Nenhuma" : `${pct}%`}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {imagePercent === 0
                  ? "Apenas questões textuais"
                  : `~${Math.round((customCount ? parseInt(customCount) || questionCount : questionCount) * imagePercent / 100)} questões com ECG, RX, dermato, TC e mais`}
              </p>
            </div>
          )}


          {(mode === "prova" || mode === "extremo") && (
            <div>
              <label className="text-sm font-semibold mb-2 block">Tempo por questão</label>
              {mode === "extremo" ? (
                <p className="text-xs text-muted-foreground">Fixo em <strong>2 minutos</strong> por questão — Total: {(customCount ? parseInt(customCount) || questionCount : questionCount) * 2} minutos</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {[2, 3, 4, 5].map(m => (
                      <Button key={m} variant={timePerQuestion === m ? "default" : "outline"} size="sm" onClick={() => setTimePerQuestion(m)}>
                        {m} min
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Total: {totalTime} minutos</p>
                </>
              )}
            </div>
          )}

          <Button
            size="lg"
            className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[13px] shadow-glow-sm ${
              mode === "extremo" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : 
              mode === "prova_real" ? "bg-amber-600 hover:bg-amber-700 text-white" : 
              mode === "tri" ? "bg-violet-600 hover:bg-violet-700 text-white" : 
              mode === "adaptativo" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
            }`}
            onClick={handleStart}
            data-testid="iniciar-simulado-button"
            disabled={
              (mode !== "prova_real" && mode !== "tri" && mode !== "adaptativo") && 
              selectedTopics.length === 0 && 
              !specificTopic
            }
          >
            {mode === "extremo" ? <Skull className="h-4 w-4 mr-2" /> : mode === "prova_real" ? <Trophy className="h-4 w-4 mr-2" /> : mode === "tri" ? <Brain className="h-4 w-4 mr-2" /> : mode === "adaptativo" ? <Zap className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {mode === "adaptativo" ? `INICIAR SIMULADO ADAPTATIVO (${customCount || questionCount} QUESTÕES)` : mode === "estudo" ? "INICIAR MODO ESTUDO" : mode === "extremo" ? "INICIAR PROVA EXTREMA" : mode === "prova_real" ? `INICIAR PROVA REAL ${selectedProfile.name}` : mode === "tri" ? `INICIAR TRI ${selectedProfile.name}` : "INICIAR SIMULADO"} {mode !== "adaptativo" ? `(${mode === "prova_real" || mode === "tri" ? selectedProfile.totalQuestions : (customCount || questionCount)} QUESTÕES)` : ""}
          </Button>
        </div>
      )}
    </div>
  );
};

export { ALL_TOPICS };
export default SimuladoSetup;
