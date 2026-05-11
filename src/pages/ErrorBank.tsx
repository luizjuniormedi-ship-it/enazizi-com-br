import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { AlertTriangle, BookOpen, RefreshCw, Brain, HelpCircle, Stethoscope, ListChecks, FlipVertical, Loader2, CheckCircle2, TrendingUp, ChevronRight, Sparkles, Target, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EnaflixRow } from "@/components/enaflix/EnaflixRow";
import { EnaflixSection } from "@/components/enaflix/EnaflixSection";
import { ErrorThemeCard } from "@/components/enaflix/ErrorThemeCard";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { EnaflixSectionTitle } from "@/components/enaflix/EnaflixSectionTitle";
import { cn } from "@/lib/utils";
import { type StudyMode } from "@/components/tutor/StudyStyleSelector";


const ErrorBankWeeklyChart = lazy(() => import("@/components/error-bank/ErrorBankWeeklyChart"));

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

interface ThemeStats {
  tema: string;
  total: number;
  trend: "improving" | "worsening" | "stable";
  subtemas: { subtema: string; count: number }[];
  categorias: { cat: string; count: number }[];
}

const REVIEW_MODES = [
  { id: "revisar", label: "Revisar conceitos", icon: BookOpen, description: "Explicação técnica + leiga + conduta + active recall", color: "text-primary" },
  { id: "questoes", label: "Questões dos erros", icon: HelpCircle, description: "Questões objetivas dos temas com mais erros", color: "text-amber-400" },
  { id: "casos", label: "Casos clínicos", icon: Stethoscope, description: "Mini casos para treinar raciocínio", color: "text-emerald-400" },
  { id: "completa", label: "Revisão completa", icon: ListChecks, description: "Revisa todos os temas fracos sequencialmente", color: "text-accent" },
  { id: "mnemonico", label: "Gerar Mnemônico", icon: Sparkles, description: "Mnemônico visual para fixar os pontos fracos", color: "text-violet-400" },
  { id: "tutor", label: "Tutor IA Especialista", icon: Brain, description: "Conversar com o tutor sobre seus erros", color: "text-primary" },
];

const ErrorBank = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [masteredErrors, setMasteredErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadErrors();
  }, [user]);

  const loadErrors = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [activeRes, masteredRes] = await Promise.all([
        supabase.from("error_bank").select("*").eq("user_id", user.id).or("dominado.is.null,dominado.eq.false").order("vezes_errado", { ascending: false }),
        supabase.from("error_bank").select("*").eq("user_id", user.id).eq("dominado", true).order("dominado_em", { ascending: false }),
      ]);
      setErrors((activeRes.data as ErrorEntry[]) || []);
      setMasteredErrors((masteredRes.data as ErrorEntry[]) || []);
    } catch (err) {
      console.error("Error loading errors:", err);
      toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar seu banco de erros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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
      weeks.push({ week: `S${8 - i}`, erros: count });
    }
    return weeks;
  }, [errors, masteredErrors]);

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

  const startReviewMode = (mode: string, tema?: string) => {
    try {
      const topTema = tema || errors[0]?.tema || "";
      
      // Fallback para quando não há erros e tenta-se iniciar modo geral
      if (!tema && errors.length === 0 && mode !== "mnemonico") {
        toast({ title: "Sem erros ativos", description: "Você não possui erros registrados para este modo de revisão." });
        return;
      }

      if (mode === "mnemonico") {
        navigate("/dashboard/mnemonico", { state: { prefillTopic: topTema || "Geral", fromErrorBank: true } });
        return;
      }
      
      // Mapeamento de modos do Error Bank para o StudySession (Cognitive OS V6)
      const modeMapping: Record<string, string> = {
        "revisar": "aula_completa",
        "questoes": "questao_direta",
        "casos": "revisao_prova",
        "completa": "revisao_prova",
        "treinar": "aula_completa",
        "tutor": "full"
      };

      const targetMode = modeMapping[mode as keyof typeof modeMapping] || "aula_completa";
      const topicParam = topTema ? `&topic=${encodeURIComponent(topTema)}` : "";
      
      // Navegação absoluta para evitar 404s
      const targetUrl = `/dashboard/sessao-estudo?auto=true&focus=${targetMode}${topicParam}`;
      
      navigate(targetUrl, { 
        state: { 
          prefillTopic: topTema,
          source: tema ? 'error_bank_theme' : 'error_bank_full_review',
          studyMode: targetMode,
          fromErrorBank: true
        } 
      });
    } catch (err) {
      console.error("Navigation error in ErrorBank:", err);
      toast({ title: "Erro de navegação", description: "Não foi possível abrir a sessão de estudo.", variant: "destructive" });
    }
  };

  const generateFlashcardsFromErrors = async () => {
    if (!user || errors.length === 0) return;
    setGeneratingFlashcards(true);
    try {
      const { error } = await supabase.functions.invoke("generate-flashcards", {
        body: { topic: "Revisão dos Erros Mais Frequentes", count: 10 },
      });
      if (error) throw error;
      toast({ title: "Flashcards gerados!", description: "Cards criados a partir dos seus erros." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar flashcards", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const totalErrors = errors.reduce((s, e) => s + e.vezes_errado, 0);

  if (loading) return <div className="p-24 text-center text-white/40">Carregando banco de erros...</div>;

  return (
    <div className="pb-24 pt-8 space-y-12 relative min-h-screen">
      <EnaflixBackgroundFX intensity="medium" />
      <div className="px-4 sm:px-8 lg:px-14">
        <EnaflixSectionTitle
          kicker="ANÁLISE DE RECUPERAÇÃO"
          title={
            <>
              Meus <span className="gradient-text">Erros Ativos</span>
            </>
          }
          subtitle="IA de estudos analisou seus pontos de fragilidade para recuperação ativa."
          action={
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="bg-white/5 border-white/5 text-white/60 hover:text-white rounded-xl h-11 w-11">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#0a0a0e]/95 backdrop-blur-xl border-white/10">
                  <DropdownMenuItem onClick={() => window.open("https://docs.enazizi.com", "_blank")}>
                    <HelpCircle className="h-4 w-4 mr-2" /> Como usar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="bg-white/5 border-white/5 text-white/60 hover:text-white rounded-xl gap-2 h-11"
                onClick={generateFlashcardsFromErrors}
                disabled={generatingFlashcards}
              >
                {generatingFlashcards ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlipVertical className="h-4 w-4" />}
                Gerar Flashcards
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
          }
        />
      </div>

      <EnaflixRow title="Status da Recuperação">
        <div className="flex gap-4">
          <MetricBadge label="Erros Ativos" value={totalErrors} icon={AlertTriangle} color="text-destructive" />
          <MetricBadge label="Temas em Risco" value={themeStats.length} icon={BookOpen} color="text-amber-500" />
          <MetricBadge label="Superados" value={masteredErrors.length} icon={CheckCircle2} color="text-emerald-500" />
          <MetricBadge label="IA Recuperação" value={`${Math.round((masteredErrors.length / (errors.length + masteredErrors.length || 1)) * 100)}%`} icon={TrendingUp} color="text-primary" />
        </div>
      </EnaflixRow>

      <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-12">
          <div>
            <EnaflixSectionTitle kicker="RANKING" title="Temas Críticos" subtitle="Onde você mais precisa focar agora." className="mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themeStats.map((stat) => (
                <ErrorThemeCard
                  key={stat.tema}
                  {...stat}
                  onClick={() => {}}
                  onTrain={() => startReviewMode("treinar", stat.tema)}
                />
              ))}
            </div>
          </div>

          <div>
            <EnaflixSectionTitle kicker="TELEMETRIA" title="Evolução Semanal" className="mb-6" />
            <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-64">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-white/20">Carregando telemetria...</div>}>
                <ErrorBankWeeklyChart data={weeklyData} />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <EnaflixSectionTitle kicker="AÇÕES" title="Recomendadas" className="mb-6" />
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
        </div>
      </div>
    </div>
  );
};

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

export default ErrorBank;
