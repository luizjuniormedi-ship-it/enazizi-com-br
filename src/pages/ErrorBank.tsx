import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { AlertTriangle, BookOpen, BarChart3, RefreshCw, ArrowRight, Brain, HelpCircle, Stethoscope, ListChecks, FlipVertical, Loader2, CheckCircle2, TrendingDown, TrendingUp, Filter, X, SortAsc, SortDesc, ChevronDown, ChevronRight, Trash2, Target, MoreVertical, Sparkles } from "lucide-react";

const ErrorBankWeeklyChart = lazy(() => import("@/components/error-bank/ErrorBankWeeklyChart"));
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ErrorEntry {
  id: string;
  tema: string;
  subtema: string | null;
  tipo_questao: string;
  conteudo: string | null;
  motivo_erro: string | null;
  categoria_erro: string | null;
  dificuldade: number | null;
  vezes_errado: number;
  created_at: string;
  dominado: boolean;
  dominado_em: string | null;
}

import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixSection } from "@/components/enaflix/EnaflixSection";
import { ErrorThemeCard } from "@/components/enaflix/ErrorThemeCard";
import { cn } from "@/lib/utils";

interface ErrorEntry {

const CATEGORIA_LABELS: Record<string, string> = {
  conceito: "Conceito",
  fisiopatologia: "Fisiopatologia",
  diagnostico: "Diagnóstico",
  conduta: "Conduta",
  interpretacao: "Interpretação",
  pegadinha: "Pegadinha",
};

const TIPO_ICONS: Record<string, string> = {
  objetiva: "📝",
  flashcard: "🃏",
  "active-recall": "🧠",
  discursiva: "✍️",
  simulado: "📋",
  diagnostico: "🔍",
};

const REVIEW_MODES = [
  { id: "revisar", label: "Revisar conceitos", icon: BookOpen, description: "Explicação técnica + leiga + conduta + active recall", color: "text-primary" },
  { id: "questoes", label: "Questões dos erros", icon: HelpCircle, description: "Questões objetivas dos temas com mais erros", color: "text-amber-400" },
  { id: "casos", label: "Casos clínicos", icon: Stethoscope, description: "Mini casos para treinar raciocínio", color: "text-emerald-400" },
  { id: "completa", label: "Revisão completa", icon: ListChecks, description: "Revisa todos os temas fracos sequencialmente", color: "text-accent" },
  { id: "mnemonico", label: "Gerar Mnemônico", icon: Sparkles, description: "Mnemônico visual para fixar os pontos fracos", color: "text-violet-400" },
];

function getSeverityColor(count: number) {
  if (count >= 10) return "bg-destructive/20 border-destructive/40";
  if (count >= 5) return "bg-orange-500/15 border-orange-500/30";
  return "bg-amber-500/10 border-amber-500/20";
}

function getSeverityBarWidth(count: number) {
  return Math.min(count * 10, 100);
}

function getSeverityBarColor(count: number) {
  if (count >= 10) return "bg-destructive";
  if (count >= 5) return "bg-orange-500";
  return "bg-amber-500";
}

const ErrorBank = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [masteredErrors, setMasteredErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTema, setSelectedTema] = useState<string | null>(null);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"vezes" | "recente">("vezes");
  const [showMastered, setShowMastered] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadErrors();
  }, [user]);

  const loadErrors = async () => {
    if (!user) return;
    setLoading(true);
    const [activeRes, masteredRes] = await Promise.all([
      supabase.from("error_bank").select("*").eq("user_id", user.id).or("dominado.is.null,dominado.eq.false").order("vezes_errado", { ascending: false }),
      supabase.from("error_bank").select("*").eq("user_id", user.id).eq("dominado", true).order("dominado_em", { ascending: false }),
    ]);
    if (activeRes.error) {
      console.error(activeRes.error);
      toast({ title: "Erro", description: "Falha ao carregar banco de erros.", variant: "destructive" });
    }
    setErrors((activeRes.data as ErrorEntry[]) || []);
    setMasteredErrors((masteredRes.data as ErrorEntry[]) || []);
    setLoading(false);
  };

  const markAsMastered = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from("error_bank").update({ dominado: true, dominado_em: now }).eq("id", id);
    const item = errors.find((e) => e.id === id);
    if (item) {
      setErrors((prev) => prev.filter((e) => e.id !== id));
      setMasteredErrors((prev) => [{ ...item, dominado: true, dominado_em: now }, ...prev]);
    }
    toast({ title: "✓ Dominado!", description: "Erro marcado como superado." });
  };

  const unmarkMastered = async (id: string) => {
    await supabase.from("error_bank").update({ dominado: false, dominado_em: null }).eq("id", id);
    const item = masteredErrors.find((e) => e.id === id);
    if (item) {
      setMasteredErrors((prev) => prev.filter((e) => e.id !== id));
      setErrors((prev) => [{ ...item, dominado: false, dominado_em: null }, ...prev]);
    }
    toast({ title: "Reativado", description: "Erro voltou para a lista ativa." });
  };

  const deleteError = async (id: string) => {
    await supabase.from("error_bank").delete().eq("id", id);
    setMasteredErrors((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Removido", description: "Erro removido permanentemente." });
  };

  // Weekly evolution chart data
  const weeklyData = useMemo(() => {
    const allErrors = [...errors, ...masteredErrors];
    const now = new Date();
    const weeks: { week: string; erros: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const count = allErrors.filter((e) => {
        const d = new Date(e.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        week: `S${8 - i}`,
        erros: count,
      });
    }
    return weeks;
  }, [errors, masteredErrors]);

  // Trend calculation per theme
  const calcTrend = (tema: string): "improving" | "worsening" | "stable" => {
    const now = new Date();
    const d7 = new Date(now); d7.setDate(now.getDate() - 7);
    const d14 = new Date(now); d14.setDate(now.getDate() - 14);
    const temaErrors = errors.filter((e) => e.tema === tema);
    const recent = temaErrors.filter((e) => new Date(e.created_at) >= d7).length;
    const previous = temaErrors.filter((e) => { const d = new Date(e.created_at); return d >= d14 && d < d7; }).length;
    if (recent < previous) return "improving";
    if (recent > previous) return "worsening";
    return "stable";
  };

  // Build error summary for AI context
  const buildErrorContext = (mode: string, tema?: string) => {
    const relevantErrors = tema ? errors.filter((e) => e.tema === tema) : errors;
    const summary = relevantErrors.slice(0, 20).map((e) =>
      `- ${e.tema}${e.subtema ? ` > ${e.subtema}` : ""}: ${e.vezes_errado}x errado${e.categoria_erro ? ` (${CATEGORIA_LABELS[e.categoria_erro] || e.categoria_erro})` : ""}${e.motivo_erro ? ` — ${e.motivo_erro}` : ""}`
    ).join("\n");

    const prompts: Record<string, string> = {
      revisar: tema
        ? `[BANCO DE ERROS - REVISÃO DE TEMA]\n\nO aluno quer revisar o tema "${tema}" onde apresentou os seguintes erros:\n${summary}\n\nInicie a revisão seguindo: 1) Explicação técnica 2) Tradução leiga 3) Aplicação clínica 4) Conduta baseada em protocolos 5) Active recall. Foque nos pontos onde o aluno errou.`
        : `[BANCO DE ERROS - REVISÃO]\n\nMostrar os temas com mais erros e perguntar qual o aluno quer revisar:\n${summary}`,
      questoes: `[BANCO DE ERROS - QUESTÕES BASEADAS NOS ERROS]\n\nGere questões objetivas (A-E) baseadas nos temas onde o aluno mais errou${tema ? ` (foco em ${tema})` : ""}. Apresente UMA questão por vez. Após resposta, explique: alternativa correta, explicação leiga, explicação técnica, motivo do erro/acerto, ponto clássico de prova.\n\nErros do aluno:\n${summary}`,
      casos: `[BANCO DE ERROS - MINI CASOS CLÍNICOS]\n\nGere mini casos clínicos baseados nos temas onde o aluno errou${tema ? ` (foco em ${tema})` : ""}. Estrutura: paciente com sintomas do tema → pergunta (diagnóstico provável ou conduta inicial). Após resposta: explicar raciocínio clínico, conduta correta, revisar conceito do erro.\n\nErros do aluno:\n${summary}`,
      completa: `[BANCO DE ERROS - REVISÃO COMPLETA]\n\nInicie uma revisão completa sequencial dos temas com mais erros. Para cada tema: 1) revisar rapidamente o conteúdo 2) apresentar uma questão 3) corrigir 4) passar para o próximo tema.\n\nErros do aluno (em ordem de prioridade):\n${summary}`,
    };
    return prompts[mode] || prompts.revisar;
  };

  const startReviewMode = (mode: string, tema?: string) => {
    if (mode === "mnemonico") {
      // Navigate to mnemonic generator with error bank context
      const relevantErrors = tema ? errors.filter((e) => e.tema === tema) : errors.slice(0, 5);
      const topTema = tema || relevantErrors[0]?.tema || "";
      const items = relevantErrors
        .filter((e) => e.tema === topTema)
        .map((e) => e.subtema || e.categoria_erro || e.motivo_erro || e.tema)
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .slice(0, 7);
      navigate("/dashboard/mnemonico", { state: { prefillTopic: topTema, prefillItems: items, fromErrorBank: true } });
      return;
    }
    const context = buildErrorContext(mode, tema);
    navigate("/dashboard/chatgpt", { state: { initialMessage: context, fromErrorBank: true } });
  };

  // Aggregate stats by theme
  const themeStats: ThemeStats[] = useMemo(() => {
    const map = new Map<string, { total: number; subtemas: Map<string, number>; categorias: Map<string, number> }>();
    for (const e of errors) {
      if (!map.has(e.tema)) map.set(e.tema, { total: 0, subtemas: new Map(), categorias: new Map() });
      const s = map.get(e.tema)!;
      s.total += e.vezes_errado;
      if (e.subtema) s.subtemas.set(e.subtema, (s.subtemas.get(e.subtema) || 0) + e.vezes_errado);
      if (e.categoria_erro) s.categorias.set(e.categoria_erro, (s.categorias.get(e.categoria_erro) || 0) + e.vezes_errado);
    }
    return Array.from(map.entries())
      .map(([tema, v]) => ({
        tema,
        total: v.total,
        trend: calcTrend(tema),
        subtemas: Array.from(v.subtemas.entries()).map(([subtema, count]) => ({ subtema, count })).sort((a, b) => b.count - a.count),
        categorias: Array.from(v.categorias.entries()).map(([cat, count]) => ({ cat, count })).sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);
  }, [errors]);

  const generateFlashcardsFromErrors = async () => {
    if (!user || errors.length === 0) return;
    setGeneratingFlashcards(true);
    try {
      const topErrors = errors.slice(0, 15);
      const errorSummary = topErrors.map(e =>
        `Tema: ${e.tema}${e.subtema ? ` > ${e.subtema}` : ""}${e.motivo_erro ? ` | Motivo: ${e.motivo_erro}` : ""}${e.conteudo ? ` | Conteúdo: ${e.conteudo.slice(0, 100)}` : ""}`
      ).join("\n");
      const response = await supabase.functions.invoke("generate-flashcards", {
        body: {
          topic: "Revisão dos Erros Mais Frequentes",
          content: `Gere flashcards de revisão para os seguintes temas onde o aluno errou:\n${errorSummary}\n\nCrie flashcards focados nos conceitos-chave que o aluno precisa revisar para não errar novamente.`,
          count: Math.min(topErrors.length, 10),
        },
      });
      if (response.error) throw response.error;
      const flashcards = response.data?.flashcards || response.data || [];
      if (Array.isArray(flashcards) && flashcards.length > 0) {
        const inserts = flashcards.map((fc: any) => ({
          user_id: user.id,
          question: fc.question || fc.front || fc.pergunta,
          answer: fc.answer || fc.back || fc.resposta,
          topic: fc.topic || "Banco de Erros",
        })).filter((fc: any) => fc.question && fc.answer);
        if (inserts.length > 0) {
          await supabase.from("flashcards").insert(inserts);
          toast({ title: "Flashcards gerados!", description: `${inserts.length} flashcards criados a partir dos seus erros.` });
        }
      } else {
        toast({ title: "Nenhum flashcard gerado", description: "Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar flashcards", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  // Unique filter values
  const tiposUnicos = useMemo(() => [...new Set(errors.map((e) => e.tipo_questao))], [errors]);
  const categoriasUnicas = useMemo(() => [...new Set(errors.map((e) => e.categoria_erro).filter(Boolean) as string[])], [errors]);

  // Filtered + sorted errors
  const filteredErrors = useMemo(() => {
    let result = selectedTema ? errors.filter((e) => e.tema === selectedTema) : errors;
    if (filterTipo !== "all") result = result.filter((e) => e.tipo_questao === filterTipo);
    if (filterCategoria !== "all") result = result.filter((e) => e.categoria_erro === filterCategoria);
    if (sortBy === "recente") {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      result = [...result].sort((a, b) => b.vezes_errado - a.vezes_errado);
    }
    return result;
  }, [errors, selectedTema, filterTipo, filterCategoria, sortBy]);

  const totalErrors = errors.reduce((s, e) => s + e.vezes_errado, 0);
  const hasActiveFilters = filterTipo !== "all" || filterCategoria !== "all";

  return (
    <div className="pb-24 pt-8 space-y-12">
      {/* Header */}
      <div className="px-4 sm:px-8 lg:px-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              Meus Erros
            </h1>
            <p className="text-sm text-white/50 mt-1 font-medium">IA de estudos analisou seus pontos de fragilidade para recuperação ativa.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-white/5 border-white/5 text-white/60 hover:text-white rounded-xl gap-2 h-11"
              onClick={generateFlashcardsFromErrors}
              disabled={generatingFlashcards}
            >
              {generatingFlashcards ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlipVertical className="h-4 w-4" />}
              Gerar Flashcards de Erros
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-white/5 border-white/5 text-white/60 hover:text-white rounded-xl h-11 w-11"
              onClick={loadErrors}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <EnaflixRow title="Status da Recuperação">
        <div className="flex gap-4">
          <MetricBadge 
            label="Erros Ativos" 
            value={totalErrors} 
            icon={AlertTriangle} 
            color="text-destructive" 
          />
          <MetricBadge 
            label="Temas em Risco" 
            value={themeStats.length} 
            icon={BookOpen} 
            color="text-amber-500" 
          />
          <MetricBadge 
            label="Superados" 
            value={masteredErrors.length} 
            icon={CheckCircle2} 
            color="text-emerald-500" 
          />
          <MetricBadge 
            label="Recuperação IA" 
            value={`${Math.round((masteredErrors.length / (errors.length + masteredErrors.length || 1)) * 100)}%`} 
            icon={TrendingUp} 
            color="text-primary" 
          />
        </div>
      </EnaflixRow>

      {/* Main Content */}
      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <EnaflixSection title="Ranking de Temas Críticos" subtitle="Onde você mais precisa focar agora." className="px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themeStats.map((stat, i) => (
                <ErrorThemeCard
                  key={stat.tema}
                  {...stat}
                  onClick={() => setSelectedTema(stat.tema)}
                  onTrain={() => startReviewMode("revisar", stat.tema)}
                />
              ))}
            </div>
          </EnaflixSection>

          {/* Evolution Chart */}
          <EnaflixSection title="Evolução Semanal" className="px-0">
            <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-64">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-white/20">Carregando telemetria...</div>}>
                <ErrorBankWeeklyChart data={weeklyData} />
              </Suspense>
            </div>
          </EnaflixSection>
        </div>

        <div className="space-y-8">
          <EnaflixSection title="Ações Recomendadas" className="px-0">
            <div className="space-y-3">
              {REVIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => startReviewMode(mode.id)}
                  className="w-full p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4 hover:bg-white/10 transition-all text-left group"
                >
                  <div className={cn("p-2 rounded-lg bg-white/5", mode.color)}>
                    <mode.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{mode.label}</h4>
                    <p className="text-[10px] text-white/40 font-medium leading-tight">{mode.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white transition-colors" />
                </button>
              ))}
            </div>
          </EnaflixSection>
        </div>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 min-w-[160px] flex items-center gap-4">
      <div className={cn("p-2 rounded-xl bg-white/5", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className={cn("text-2xl font-black leading-none mb-1", color)}>{value}</div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-white/30">{label}</div>
      </div>
    </div>
  );
}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart */}
      {errors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Evolução Semanal de Novos Erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-[160px] animate-pulse rounded-md bg-muted/30" />}>
              <ErrorBankWeeklyChart data={weeklyData} />
            </Suspense>
          </CardContent>
        </Card>
      )}

      {/* Review Mode Selection */}
      {errors.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              O que deseja fazer com seus erros?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {REVIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => startReviewMode(mode.id, selectedTema || undefined)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-center group"
                >
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <mode.icon className={`h-4 w-4 ${mode.color}`} />
                  </div>
                  <p className="text-xs font-medium text-foreground leading-tight">{mode.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando erros...
        </div>
      ) : errors.length === 0 && masteredErrors.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Nenhum erro registrado</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Seus erros são coletados automaticamente quando você responde questões, simulados, flashcards e treinos com o Tutor IA.
              </p>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/chatgpt")} className="gap-1.5">
                <Brain className="h-4 w-4" /> Tutor IA
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/simulados")} className="gap-1.5">
                <ListChecks className="h-4 w-4" /> Simulados
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/flashcards")} className="gap-1.5">
                <FlipVertical className="h-4 w-4" /> Flashcards
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Theme List */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Temas com mais erros</h2>
            <button
              onClick={() => setSelectedTema(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedTema ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary"
              }`}
            >
              Todos os temas ({errors.length})
            </button>
            {themeStats.map((s) => (
              <button
                key={s.tema}
                onClick={() => setSelectedTema(s.tema)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedTema === s.tema ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate flex-1">{s.tema}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.trend === "improving" && <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />}
                    {s.trend === "worsening" && <TrendingUp className="h-3.5 w-3.5 text-destructive" />}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      s.total >= 10 ? "bg-destructive/10 text-destructive" : s.total >= 5 ? "bg-orange-500/10 text-orange-600" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {s.total}x
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Quick review buttons per theme */}
            {selectedTema && (
              <Card className="mt-3">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs truncate">📌 {selectedTema}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 px-3 pb-3">
                  <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8" onClick={() => startReviewMode("revisar", selectedTema)}>
                    Revisar <ArrowRight className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8" onClick={() => startReviewMode("questoes", selectedTema)}>
                    Questões <ArrowRight className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8" onClick={() => startReviewMode("casos", selectedTema)}>
                    Casos <ArrowRight className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8 text-violet-500 border-violet-500/30 hover:bg-violet-500/10" onClick={() => startReviewMode("mnemonico", selectedTema)}>
                    <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Mnemônico</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Error Details */}
          <div className="lg:col-span-2 space-y-3">
            {/* Filters bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-auto">
                {selectedTema ? `Erros em ${selectedTema}` : "Todos os erros"} ({filteredErrors.length})
              </h2>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {tiposUnicos.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_ICONS[t] || "📝"} {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categoriasUnicas.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => setSortBy(sortBy === "vezes" ? "recente" : "vezes")}>
                {sortBy === "vezes" ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />}
                {sortBy === "vezes" ? "Mais errado" : "Mais recente"}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => { setFilterTipo("all"); setFilterCategoria("all"); }}>
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>

            {/* Error cards */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {filteredErrors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum erro encontrado com esses filtros.</div>
              ) : (
                filteredErrors.map((e) => (
                  <Card
                    key={e.id}
                    className={`group hover:border-primary/40 transition-all ${getSeverityColor(e.vezes_errado)}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Severity bar */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className="text-lg">{TIPO_ICONS[e.tipo_questao] || "📝"}</span>
                          <span className={`text-[10px] font-bold ${e.vezes_errado >= 10 ? "text-destructive" : e.vezes_errado >= 5 ? "text-orange-600" : "text-amber-600"}`}>
                            {e.vezes_errado}x
                          </span>
                        </div>

                        {/* Content */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            const prompt = `[BANCO DE ERROS - REVISÃO DIRECIONADA]\n\nO aluno errou ${e.vezes_errado}x no tema "${e.tema}"${e.subtema ? ` (subtema: ${e.subtema})` : ""}.${e.conteudo ? `\n\nConteúdo da questão: ${e.conteudo}` : ""}${e.motivo_erro ? `\nMotivo do erro: ${e.motivo_erro}` : ""}${e.categoria_erro ? `\nCategoria: ${CATEGORIA_LABELS[e.categoria_erro] || e.categoria_erro}` : ""}\n\nFaça uma revisão completa deste ponto: 1) Explicação técnica 2) Tradução leiga 3) Aplicação clínica 4) Conduta correta baseada em protocolos 5) Pergunta de active recall para fixação.`;
                            navigate("/dashboard/chatgpt", { state: { initialMessage: prompt, fromErrorBank: true } });
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{e.tema}</span>
                            {e.subtema && <span className="text-xs text-muted-foreground">› {e.subtema}</span>}
                          </div>

                          {/* Severity bar visual */}
                          <div className="w-full h-1 rounded-full bg-muted mb-2">
                            <div className={`h-full rounded-full transition-all ${getSeverityBarColor(e.vezes_errado)}`} style={{ width: `${getSeverityBarWidth(e.vezes_errado)}%` }} />
                          </div>

                          {e.conteudo && (
                            <p className="text-xs text-foreground/80 line-clamp-2 mb-1.5">{e.conteudo}</p>
                          )}

                          {e.motivo_erro && (
                            <p className="text-xs text-muted-foreground mb-1.5">💡 {e.motivo_erro}</p>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            {e.categoria_erro && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                {CATEGORIA_LABELS[e.categoria_erro] || e.categoria_erro}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            <span className="text-[10px] text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                              Revisar <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>

                        {/* Mastered button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          onClick={(ev) => { ev.stopPropagation(); markAsMastered(e.id); }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Dominei
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Mastered section */}
            {masteredErrors.length > 0 && (
              <Collapsible open={showMastered} onOpenChange={setShowMastered}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-sm h-10 mt-2">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Erros Dominados ({masteredErrors.length})
                    </span>
                    {showMastered ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {masteredErrors.map((e) => (
                    <Card key={e.id} className="bg-emerald-500/5 border-emerald-500/20 group">
                      <CardContent className="p-3 flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-through text-muted-foreground">{e.tema}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Dominado em {e.dominado_em ? new Date(e.dominado_em).toLocaleDateString("pt-BR") : "—"}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unmarkMastered(e.id)} title="Reativar">
                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteError(e.id)} title="Excluir permanentemente">
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorBank;
