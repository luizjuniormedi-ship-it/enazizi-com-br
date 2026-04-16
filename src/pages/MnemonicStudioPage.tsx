import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Sparkles, AlertTriangle, Loader2,
  Copy, Heart, MessageSquare, RefreshCw,
  ChevronDown, ChevronUp, Wand2, BookOpen, Eye, CheckCircle, XCircle, MinusCircle,
  Target, HelpCircle, Lightbulb, Clapperboard, Volume2, Users, Zap, Crosshair,
  Play, Bookmark, Clock, FlipHorizontal, ThumbsUp, ThumbsDown, Minus,
  BarChart3, TrendingUp, TrendingDown, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useGenerateMnemonic } from "@/hooks/useGenerateMnemonic";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import { useRegenerateMnemonic } from "@/hooks/useRegenerateMnemonic";
import { MnemonicFeedbackModal } from "@/components/mnemonics/MnemonicFeedbackModal";
import { validateMnemonicForm } from "@/utils/mnemonicValidation";
import { getScoreColor, getScoreBg } from "@/utils/mnemonicStatus";
import { supabase } from "@/integrations/supabase/client";
import type { MnemonicResultData, RegenerateStyle } from "@/types/mnemonics";
import { ESTILOS, PUBLICOS, REGENERATE_OPTIONS } from "@/types/mnemonics";

const safeArray = <T,>(arr: T[] | undefined | null): T[] => Array.isArray(arr) ? arr : [];

// ═══ UTILITY SCORE MAP ═══
const UTILITY_MAP: Record<string, number> = { muito: 2, pouco: 0, nada: -2 };

function ScoreBadge({ label, score }: { label: string; score: number }) {
  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${getScoreBg(score)}`}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
      <Progress value={score} className="h-1.5 w-16" />
    </div>
  );
}

function QualityBadge({ flag }: { flag: string }) {
  if (flag === "high") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1"><CheckCircle className="h-3 w-3" /> Alta qualidade</Badge>;
  if (flag === "low") return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 gap-1"><XCircle className="h-3 w-3" /> Baixa qualidade</Badge>;
  return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 gap-1"><MinusCircle className="h-3 w-3" /> Qualidade média</Badge>;
}

// ═══ QUIZ VISUAL ═══
function VisualQuizMode({ result, onClose }: { result: MnemonicResultData; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const pontosDeProva = safeArray(result.pontos_de_prova);
  const [currentQ, setCurrentQ] = useState(0);
  const current = pontosDeProva[currentQ];
  if (!current) return null;

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Play className="h-5 w-5" /> Quiz Visual — {currentQ + 1}/{pontosDeProva.length}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.image_url && (
          <img src={result.image_url} alt="Mnemônico visual" className="rounded-xl max-h-56 w-full object-contain mx-auto border" />
        )}
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">❓ {current.pergunta_gatilho}</p>
          {current.dica_visual && !revealed && (
            <p className="text-sm text-violet-600 italic mb-3">🎬 Dica: {current.dica_visual}</p>
          )}
        </div>
        {!revealed ? (
          <Button onClick={() => setRevealed(true)} className="w-full" size="lg">
            <FlipHorizontal className="h-4 w-4 mr-2" /> Revelar Resposta
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm font-semibold text-emerald-700">✅ {current.resposta_esperada}</p>
            </div>
            {current.armadilha_comum && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-600">⚠️ Armadilha: {current.armadilha_comum}</p>
              </div>
            )}
            <div className="flex gap-2">
              {currentQ < pontosDeProva.length - 1 ? (
                <Button onClick={() => { setCurrentQ(currentQ + 1); setRevealed(false); }} className="flex-1">
                  Próxima →
                </Button>
              ) : (
                <Button onClick={onClose} className="flex-1" variant="outline">Concluir Quiz</Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══ SUGESTÕES DO BANCO DE ERROS — PRIORIZAÇÃO AVANÇADA ═══
function useErrorSuggestions() {
  return useQuery({
    queryKey: ["mnemonic-error-suggestions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      // Fetch errors sorted by vezes_errado DESC, updated_at DESC (most recent error)
      const { data } = await supabase
        .from("error_bank")
        .select("tema, subtema, vezes_errado, categoria_erro, updated_at, dificuldade")
        .eq("user_id", user.id)
        .eq("dominado", false)
        .order("vezes_errado", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return [];

      // Score-based prioritization
      const now = Date.now();
      const scored = data.map(e => {
        const errScore = (e.vezes_errado || 1) * 3; // weight errors heavily
        const recencyDays = Math.max(1, (now - new Date(e.updated_at).getTime()) / 86400000);
        const recencyScore = Math.max(0, 10 - recencyDays); // recent = higher
        const difficultyBonus = (e.dificuldade || 3) * 0.5; // harder = more exam-relevant
        return { ...e, priority: errScore + recencyScore + difficultyBonus };
      });

      scored.sort((a, b) => b.priority - a.priority);

      return scored.slice(0, 5).map(e => ({
        tema: e.tema,
        subtema: e.subtema,
        vezes_errado: e.vezes_errado,
        categoria: e.categoria_erro,
        priority: Math.round(e.priority),
      }));
    },
    staleTime: 60_000,
  });
}

// ═══ PAINEL DE EFETIVIDADE — HOOK ═══
interface EffectivenessItem {
  tema: string;
  result_id: string;
  avg_utility: number;
  avg_rating: number;
  feedback_count: number;
  positive_count: number;
  negative_count: number;
}

function useEffectivenessData() {
  return useQuery({
    queryKey: ["mnemonic-effectiveness"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { topHelpers: [], needsWork: [], stats: { total: 0, avgUtility: 0, helpRate: 0 } };

      // Query feedback joined with results
      const { data: feedbacks } = await supabase
        .from("mnemonic_feedback")
        .select("result_id, utility_score, rating_general")
        .eq("user_id", user.id);

      if (!feedbacks || feedbacks.length === 0) {
        return { topHelpers: [], needsWork: [], stats: { total: 0, avgUtility: 0, helpRate: 0 } };
      }

      // Get unique result_ids
      const resultIds = [...new Set(feedbacks.map(f => f.result_id))];
      const { data: results } = await supabase
        .from("mnemonic_results")
        .select("id, tema")
        .in("id", resultIds);

      const temaMap = new Map((results || []).map(r => [r.id, r.tema]));

      // Aggregate by result_id
      const aggMap = new Map<string, EffectivenessItem>();
      for (const f of feedbacks) {
        const existing = aggMap.get(f.result_id);
        const tema = temaMap.get(f.result_id) || "Tema desconhecido";
        const utility = f.utility_score ?? 0;
        const rating = f.rating_general ?? 3;
        if (existing) {
          existing.feedback_count++;
          existing.avg_utility = (existing.avg_utility * (existing.feedback_count - 1) + utility) / existing.feedback_count;
          existing.avg_rating = (existing.avg_rating * (existing.feedback_count - 1) + rating) / existing.feedback_count;
          if (utility > 0) existing.positive_count++;
          if (utility < 0) existing.negative_count++;
        } else {
          aggMap.set(f.result_id, {
            tema,
            result_id: f.result_id,
            avg_utility: utility,
            avg_rating: rating,
            feedback_count: 1,
            positive_count: utility > 0 ? 1 : 0,
            negative_count: utility < 0 ? 1 : 0,
          });
        }
      }

      const all = Array.from(aggMap.values());
      const topHelpers = [...all].sort((a, b) => b.avg_utility - a.avg_utility).slice(0, 5);
      const needsWork = [...all].filter(a => a.avg_utility < 0).sort((a, b) => a.avg_utility - b.avg_utility).slice(0, 5);

      const totalFeedback = feedbacks.length;
      const avgUtility = feedbacks.reduce((s, f) => s + (f.utility_score ?? 0), 0) / totalFeedback;
      const helpRate = feedbacks.filter(f => (f.utility_score ?? 0) > 0).length / totalFeedback * 100;

      return {
        topHelpers,
        needsWork,
        stats: { total: totalFeedback, avgUtility: Math.round(avgUtility * 10) / 10, helpRate: Math.round(helpRate) },
      };
    },
    staleTime: 2 * 60_000,
  });
}

// ═══ PAINEL DE EFETIVIDADE — COMPONENTE ═══
function EffectivenessPanel() {
  const { data, isLoading } = useEffectivenessData();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data || data.stats.total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Ainda sem dados de feedback. Avalie seus mnemônicos para ativar o painel.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-primary">{data.stats.total}</p>
            <p className="text-xs text-muted-foreground">Avaliações</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className={`text-2xl font-bold ${data.stats.avgUtility >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {data.stats.avgUtility > 0 ? "+" : ""}{data.stats.avgUtility}
            </p>
            <p className="text-xs text-muted-foreground">Score Médio</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-2xl font-bold text-emerald-600">{data.stats.helpRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Ajuda</p>
          </CardContent>
        </Card>
      </div>

      {/* Top helpers */}
      {data.topHelpers.length > 0 && (
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
              <TrendingUp className="h-4 w-4" /> 🏆 Mnemônicos mais úteis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topHelpers.map((item, i) => (
              <div key={item.result_id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{i + 1}º</Badge>
                  <span className="text-sm font-medium truncate max-w-[200px]">{item.tema}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-xs">
                    +{Math.round(item.avg_utility * 10) / 10}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.feedback_count}×</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Needs work */}
      {data.needsWork.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <TrendingDown className="h-4 w-4" /> ⚠️ Feedback negativo — regenere em outro estilo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.needsWork.map((item) => (
              <div key={item.result_id} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                <span className="text-sm font-medium truncate max-w-[200px]">{item.tema}</span>
                <Badge className="bg-red-500/15 text-red-600 border-0 text-xs">
                  {Math.round(item.avg_utility * 10) / 10}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MnemonicGeneratorPage() {
  const [searchParams] = useSearchParams();
  const [tema, setTema] = useState("");
  const [termosText, setTermosText] = useState("");
  const [estilo, setEstilo] = useState("frase + imagem mental");
  const [publico, setPublico] = useState("graduacao");
  const [result, setResult] = useState<MnemonicResultData | null>(null);
  const [showAgents, setShowAgents] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [quizMode, setQuizMode] = useState(false);
  const [savingFlashcard, setSavingFlashcard] = useState(false);
  const [savingFsrs, setSavingFsrs] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("gerar");
  const [missionBanner, setMissionBanner] = useState<{
    mode: string; style?: string; topic?: string;
  } | null>(null);

  // ── Deep-link from study-next mission ──
  useEffect(() => {
    const origin = searchParams.get("origin");
    const topicParam = searchParams.get("topic");
    const modeParam = searchParams.get("mode");
    const styleParam = searchParams.get("style");

    if (origin === "mission" && topicParam) {
      setTema(topicParam);
      setMissionBanner({ mode: modeParam || "create_new", style: styleParam || undefined, topic: topicParam });

      // If regenerate with style hint, pre-select style
      if (styleParam) {
        const styleMap: Record<string, string> = {
          visual: "visual cinematográfico",
          curto: "frase + imagem mental",
          "engraçado": "humor médico",
          "acadêmico": "frase + imagem mental",
        };
        setEstilo(styleMap[styleParam] || estilo);
      }
    }
  }, [searchParams]);

  const { data: errorSuggestions } = useErrorSuggestions();

  // ── Auto-suggest terms from curriculum_matrix when tema changes ──
  const [suggestedTerms, setSuggestedTerms] = useState<string[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!tema || tema.trim().length < 3) {
      setSuggestedTerms([]);
      return;
    }
    setLoadingTerms(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // Search curriculum_matrix for matching topics
        const searchTerm = tema.split("—")[0].trim(); // handle "Tema — Subtema" format
        const { data } = await supabase
          .from("curriculum_matrix")
          .select("gatilhos_clinicos, palavras_chave, subtema, tema")
          .eq("ativo", true)
          .or(`tema.ilike.%${searchTerm}%,subtema.ilike.%${searchTerm}%`)
          .limit(3);

        if (data && data.length > 0) {
          const allTerms = new Set<string>();
          for (const row of data) {
            if (Array.isArray(row.gatilhos_clinicos)) {
              row.gatilhos_clinicos.forEach((t: string) => allTerms.add(t));
            }
            if (Array.isArray(row.palavras_chave)) {
              row.palavras_chave.forEach((t: string) => allTerms.add(t));
            }
          }
          setSuggestedTerms([...allTerms].slice(0, 10));
        } else {
          setSuggestedTerms([]);
        }
      } catch {
        setSuggestedTerms([]);
      } finally {
        setLoadingTerms(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [tema]);

  const handleApplySuggestedTerms = useCallback((terms: string[]) => {
    const current = termosText.split("\n").map(t => t.trim()).filter(Boolean);
    const merged = [...new Set([...current, ...terms])];
    setTermosText(merged.join("\n"));
    toast.success(`${terms.length} termo(s) adicionado(s)`);
  }, [termosText]);

  const generateMutation = useGenerateMnemonic();
  const favoriteMutation = useToggleFavorite();
  const regenerateMutation = useRegenerateMnemonic();

  const termos = termosText.split("\n").map(t => t.trim()).filter(Boolean);

  const handleGenerate = useCallback(() => {
    const validation = validateMnemonicForm({ tema, termos, estilo, publico });
    if (!validation.valid) { setFormErrors(validation.errors); return; }
    setFormErrors({});
    setResult(null);
    setQuizMode(false);
    setQuickFeedback(null);
    generateMutation.mutate(
      { tema: tema.trim(), termos, estilo, publico },
      {
        onSuccess: (res) => { if (res.success && res.data) { setResult(res.data); toast.success("Mnemônico gerado!"); } else { toast.error(res.error || "Erro ao gerar."); } },
        onError: (err) => toast.error(err.message),
      }
    );
  }, [tema, termos, estilo, publico, generateMutation]);

  const handleCopyPhrase = useCallback(() => { if (!result) return; navigator.clipboard.writeText(result.frase_mnemonica); toast.success("Frase copiada!"); }, [result]);
  const handleCopyAll = useCallback(() => {
    if (!result) return;
    const parts = [`📝 ${result.sigla}`, `💡 ${result.frase_mnemonica}`, "", `🔬 ${result.explicacao_tecnica}`, "", `📚 ${result.explicacao_didatica}`];
    if (result.cena_memoravel) {
      parts.push("", "═══ MEMORIZAÇÃO VISUAL ═══");
      parts.push(`🎬 Cena: ${result.cena_memoravel.cena}`);
      if (result.cena_memoravel.personagens) parts.push(`👥 Personagens: ${result.cena_memoravel.personagens}`);
      if (result.cena_memoravel.acao) parts.push(`⚡ Ação: ${result.cena_memoravel.acao}`);
      if (result.cena_memoravel.associacao_fonetica) parts.push(`🧠 Associação: ${result.cena_memoravel.associacao_fonetica}`);
      if (result.cena_memoravel.emocao) parts.push(`😄 Impacto: ${result.cena_memoravel.emocao}`);
    } else if (result.cena_visual) {
      parts.push("", `🎨 ${result.cena_visual}`);
    }
    if (result.pontos_de_prova?.length) {
      parts.push("", "═══ PONTOS DE PROVA ═══");
      result.pontos_de_prova.forEach((pp, i) => {
        parts.push(`${i + 1}. ❓ ${pp.pergunta_gatilho}`, `   ✅ ${pp.resposta_esperada}`);
        if (pp.armadilha_comum) parts.push(`   ⚠️ ${pp.armadilha_comum}`);
      });
    }
    navigator.clipboard.writeText(parts.join("\n"));
    toast.success("Tudo copiado!");
  }, [result]);

  const handleFavorite = useCallback(() => {
    if (!result) return;
    favoriteMutation.mutate(result.result_id, { onSuccess: (isFav) => toast.success(isFav ? "Favoritado!" : "Removido."), onError: (err) => toast.error(err.message) });
  }, [result, favoriteMutation]);

  const handleRegenerate = useCallback((style: RegenerateStyle) => {
    if (!result) return;
    setQuickFeedback(null);
    regenerateMutation.mutate({ tema, termos, estilo, publico, style_hint: style, original_result_id: result.result_id }, {
      onSuccess: (res) => { if (res.success && res.data) { setResult(res.data); toast.success("Nova versão!"); } else { toast.error(res.error || "Erro."); } },
      onError: (err) => toast.error(err.message),
    });
  }, [result, tema, termos, estilo, publico, regenerateMutation]);

  const handleSaveFlashcard = useCallback(async () => {
    if (!result) return;
    setSavingFlashcard(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login para salvar."); return; }
      const question = result.cena_memoravel
        ? `🎬 ${result.cena_memoravel.cena}\n\n🔊 ${result.cena_memoravel.associacao_fonetica}\n\nQual conceito médico esta cena representa?`
        : `${result.frase_mnemonica}\n\nQual conceito médico?`;
      const answer = `${result.tema}\n\n📚 ${result.explicacao_tecnica}\n\n📖 ${result.explicacao_didatica}`;
      const { error } = await supabase.from("flashcards").insert({ user_id: user.id, question, answer, topic: result.tema, is_global: false });
      if (error) throw error;
      toast.success("Flashcard criado!");
    } catch (err: any) { toast.error(err.message || "Erro ao criar flashcard."); }
    finally { setSavingFlashcard(false); }
  }, [result]);

  const handleSendToReview = useCallback(async () => {
    if (!result) return;
    setSavingFsrs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login."); return; }
      const { data: existing } = await supabase.from("fsrs_cards").select("id").eq("user_id", user.id).eq("card_ref_id", result.result_id).eq("card_type", "mnemonic").maybeSingle();
      if (existing) { toast.info("Já está na sua lista de revisão!"); return; }
      const { error } = await supabase.from("fsrs_cards").insert({ user_id: user.id, card_ref_id: result.result_id, card_type: "mnemonic", due: new Date().toISOString(), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: 0 });
      if (error) throw error;
      toast.success("Adicionado à revisão espaçada!");
    } catch (err: any) { toast.error(err.message || "Erro ao agendar revisão."); }
    finally { setSavingFsrs(false); }
  }, [result]);

  // ═══ QUICK FEEDBACK com utility_score ═══
  const handleQuickFeedback = useCallback(async (level: "muito" | "pouco" | "nada") => {
    if (!result) return;
    setQuickFeedback(level);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ratings: Record<string, number> = { muito: 5, pouco: 3, nada: 1 };
      const r = ratings[level];
      const utilityScore = UTILITY_MAP[level];
      await supabase.from("mnemonic_feedback").insert({
        user_id: user.id,
        result_id: result.result_id,
        request_id: result.request_id || null,
        rating_general: r,
        rating_medical: r,
        rating_pedagogical: r,
        utility_score: utilityScore,
        comentario: `Quick: ${level === "muito" ? "Ajudou muito" : level === "pouco" ? "Ajudou pouco" : "Não ajudou"}`,
      });
      toast.success("Feedback salvo!");
    } catch { /* non-critical */ }
  }, [result]);

  const handleUseSuggestion = useCallback((suggestion: { tema: string; subtema: string | null }) => {
    setTema(suggestion.subtema ? `${suggestion.tema} — ${suggestion.subtema}` : suggestion.tema);
    setTermosText("");
    setActiveTab("gerar");
    toast.info(`Tema "${suggestion.tema}" selecionado.`);
  }, []);

  const isLoading = generateMutation.isPending || regenerateMutation.isPending;

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Memorização Visual Avançada</h1>
          <p className="text-muted-foreground text-sm">Veja → Entenda → Lembre → Aplique → Revise</p>
        </div>
      </div>

      {/* ═══ TABS: Gerar / Efetividade ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gerar" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Gerar
          </TabsTrigger>
          <TabsTrigger value="efetividade" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Efetividade
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: EFETIVIDADE ═══ */}
        <TabsContent value="efetividade">
          <EffectivenessPanel />
        </TabsContent>

        {/* ═══ TAB: GERAR ═══ */}
        <TabsContent value="gerar" className="space-y-6">
          {/* Banner de missão do study-next */}
          {missionBanner && !result && (
            <Card className="border-primary/40 bg-gradient-to-r from-primary/10 to-violet-500/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    {missionBanner.mode === "regenerate" ? <RefreshCw className="h-5 w-5 text-primary" /> :
                     missionBanner.mode === "review_existing" ? <Eye className="h-5 w-5 text-primary" /> :
                     <Sparkles className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {missionBanner.mode === "regenerate"
                        ? `🔄 Regenerar mnemônico: ${missionBanner.topic}`
                        : missionBanner.mode === "review_existing"
                        ? `👁️ Revisar mnemônico: ${missionBanner.topic}`
                        : `✨ Criar mnemônico: ${missionBanner.topic}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {missionBanner.mode === "regenerate"
                        ? `O sistema detectou que o mnemônico atual não está ajudando. Estilo sugerido: ${missionBanner.style || "visual"}.`
                        : missionBanner.mode === "review_existing"
                        ? "Revise o mnemônico para consolidar a memória deste tema."
                        : "O motor adaptativo recomendou criar um mnemônico para este tema fraco."}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setMissionBanner(null)}>✕</Button>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Sugestões baseadas em erros — priorização avançada */}
          {errorSuggestions && errorSuggestions.length > 0 && !result && (
            <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> 🎯 Temas prioritários — erros recentes + alta cobrança
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {errorSuggestions.map((s, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => handleUseSuggestion(s)}
                      className="border-amber-500/30 hover:bg-amber-500/10 text-xs"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />
                      {s.subtema || s.tema}
                      <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">{s.vezes_errado}×</Badge>
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">P{s.priority}</Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Tema</label>
                <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex: Critérios de Light para derrame pleural" />
                {formErrors.tema && <p className="text-xs text-destructive">{formErrors.tema}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Termos (um por linha, 3–7)</label>
                <Textarea value={termosText} onChange={(e) => setTermosText(e.target.value)} placeholder={"Bordas elevadas e nítidas\nDor intensa/queimação\nPlaca eritematosa bem delimitada"} rows={5} />
                <p className="text-xs text-muted-foreground">{termos.length} termo(s)</p>
                {formErrors.termos && <p className="text-xs text-destructive">{formErrors.termos}</p>}
                {/* Suggested terms from curriculum */}
                {suggestedTerms.length > 0 && (
                  <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> Termos sugeridos do currículo
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2 text-primary hover:text-primary"
                        onClick={() => handleApplySuggestedTerms(suggestedTerms)}
                      >
                        Usar todos
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTerms.map((term, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-primary/20 hover:bg-primary/10"
                          onClick={() => handleApplySuggestedTerms([term])}
                        >
                          + {term}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {loadingTerms && tema.trim().length >= 3 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando termos do currículo...
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Estilo</label>
                  <Select value={estilo} onValueChange={setEstilo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ESTILOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Público-alvo</label>
                  <Select value={publico} onValueChange={setPublico}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PUBLICOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {isLoading ? "Gerando mnemônico visual..." : "Gerar Mnemônico Visual"}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (() => {
            const alertas = safeArray(result.alertas);
            const itemsMap = safeArray(result.items_map);
            const agentLogs = safeArray(result.agent_logs);
            const mapaClinico = safeArray(result.mapa_clinico_completo);
            const itensProva = safeArray(result.estrutura_prova?.itens_organizados);
            const difChave = safeArray(result.diferencial_prova?.diferencas_chave);
            const pegadinhas = safeArray(result.diferencial_prova?.pegadinhas);
            const pontosDeProva = safeArray(result.pontos_de_prova);
            const cenaMemoravel = result.cena_memoravel;
            const assocVisuais = safeArray(result.associacoes_visuais);

            if (quizMode && pontosDeProva.length > 0) {
              return <VisualQuizMode result={result} onClose={() => setQuizMode(false)} />;
            }

            return (
            <div className="space-y-4">
              {/* HERO: IMAGEM + CENA */}
              {(result.image_url || cenaMemoravel) && (
                <Card className="border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-amber-500/5 overflow-hidden">
                  <CardContent className="pt-6 space-y-4">
                    {result.image_url && (
                      <div className="relative rounded-2xl overflow-hidden border-2 border-violet-500/20 shadow-lg">
                        <img src={result.image_url} alt={`Mnemônico visual: ${result.tema}`} className="w-full max-h-[400px] object-contain bg-gradient-to-b from-white to-gray-50" loading="lazy" />
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-violet-600/90 text-white border-0 shadow-lg">🎬 Memorização Visual</Badge>
                        </div>
                      </div>
                    )}
                    {cenaMemoravel && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-background/80 border border-violet-500/20">
                          <div className="flex items-center gap-2 text-sm font-bold text-violet-600 mb-2"><Clapperboard className="h-4 w-4" /> 🎬 Imagine esta cena:</div>
                          <p className="text-base leading-relaxed font-medium">{cenaMemoravel.cena}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {cenaMemoravel.personagens && (
                            <div className="p-3 rounded-lg bg-background/80 border border-fuchsia-500/20">
                              <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-600 mb-1"><Users className="h-3.5 w-3.5" /> 👥 Personagens</div>
                              <p className="text-sm text-muted-foreground">{cenaMemoravel.personagens}</p>
                            </div>
                          )}
                          {cenaMemoravel.acao && (
                            <div className="p-3 rounded-lg bg-background/80 border border-amber-500/20">
                              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 mb-1"><Zap className="h-3.5 w-3.5" /> ⚡ Ação</div>
                              <p className="text-sm text-muted-foreground">{cenaMemoravel.acao}</p>
                            </div>
                          )}
                        </div>
                        {cenaMemoravel.associacao_fonetica && (
                          <div className="p-3 rounded-lg bg-background/80 border border-blue-500/20">
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1"><Volume2 className="h-3.5 w-3.5" /> 🔊 Associação Fonética</div>
                            <p className="text-sm text-muted-foreground">{cenaMemoravel.associacao_fonetica}</p>
                          </div>
                        )}
                        {cenaMemoravel.emocao && (
                          <div className="p-3 rounded-lg bg-background/80 border border-emerald-500/20">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 mb-1">😄 Impacto emocional</div>
                            <p className="text-sm text-muted-foreground italic">{cenaMemoravel.emocao}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <Button onClick={() => setQuizMode(true)} disabled={pontosDeProva.length === 0} className="bg-primary hover:bg-primary/90" size="sm">
                        <Play className="h-4 w-4 mr-1" /> Testar
                      </Button>
                      <Button onClick={handleSaveFlashcard} disabled={savingFlashcard} variant="outline" size="sm">
                        {savingFlashcard ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />} Salvar
                      </Button>
                      <Button onClick={handleSendToReview} disabled={savingFsrs} variant="outline" size="sm">
                        {savingFsrs ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Clock className="h-4 w-4 mr-1" />} Revisar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quality + Scores */}
              <div className="flex items-center justify-between">
                <QualityBadge flag={result.quality_flag ?? "medium"} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ScoreBadge label="Linguístico" score={result.score_linguistico ?? 0} />
                <ScoreBadge label="Médico" score={result.score_medico} />
                <ScoreBadge label="Pedagógico" score={result.score_pedagogico} />
                <ScoreBadge label="Final" score={result.score_final} />
              </div>

              {/* Frase mnemônica */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Frase mnemônica</CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleCopyPhrase} className="h-8 px-2"><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {result.sigla && <p className="text-lg font-bold tracking-widest text-primary mb-2">{result.sigla}</p>}
                  <p className="text-xl font-semibold leading-relaxed">{result.frase_mnemonica}</p>
                </CardContent>
              </Card>

              {/* Associações visuais */}
              {assocVisuais.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Mapa visual por termo</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {assocVisuais.map((av, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-xs shrink-0">{av.termo}</Badge>
                            <span className="text-sm">→ {av.elemento_visual}</span>
                          </div>
                          {av.associacao_fonetica && <p className="text-xs text-blue-600">🔊 {av.associacao_fonetica}</p>}
                          {av.acao_na_cena && <p className="text-xs text-amber-600">⚡ {av.acao_na_cena}</p>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pontos de Prova */}
              {pontosDeProva.length > 0 && (
                <Card className="border-red-500/20 bg-red-500/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-red-600"><Crosshair className="h-4 w-4" /> 🎯 Pontos de Prova</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {pontosDeProva.map((pp, i) => (
                      <div key={i} className="p-3 rounded-lg border border-red-500/15 bg-background/80 space-y-2">
                        <p className="text-sm font-semibold">❓ {pp.pergunta_gatilho}</p>
                        <p className="text-sm text-emerald-600">✅ {pp.resposta_esperada}</p>
                        {pp.armadilha_comum && <p className="text-xs text-destructive">⚠️ Armadilha: {pp.armadilha_comum}</p>}
                        {pp.dica_visual && <p className="text-xs text-violet-600">🎬 Dica visual: {pp.dica_visual}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Cena visual fallback */}
              {!cenaMemoravel && !result.image_url && result.cena_visual && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Cena visual</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.cena_visual}</p></CardContent>
                </Card>
              )}

              {/* Explicações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">📚 Explicação técnica</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.explicacao_tecnica}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">📖 Explicação didática</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{result.explicacao_didatica}</p></CardContent>
                </Card>
              </div>

              {/* Memorização Ativa */}
              {result.memorizacao_ativa?.pergunta_rapida && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><Lightbulb className="h-4 w-4" /> Memorização ativa</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div><span className="text-xs font-medium text-muted-foreground">Pergunta rápida:</span><p className="text-sm font-semibold">{result.memorizacao_ativa.pergunta_rapida}</p></div>
                    <div><span className="text-xs font-medium text-muted-foreground">Resposta:</span><p className="text-sm">{result.memorizacao_ativa.resposta_esperada}</p></div>
                    {result.memorizacao_ativa.gatilho_mental && <div><span className="text-xs font-medium text-muted-foreground">Gatilho mental:</span><p className="text-sm italic">{result.memorizacao_ativa.gatilho_mental}</p></div>}
                  </CardContent>
                </Card>
              )}

              {/* Diferencial */}
              {result.diferencial_prova?.diagnostico_comparado && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Diferencial: {result.diferencial_prova.diagnostico_comparado}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {difChave.length > 0 && <div><span className="text-xs font-medium text-muted-foreground">Diferenças-chave:</span><ul className="text-sm space-y-1 mt-1">{difChave.map((d, i) => <li key={i}>• {d}</li>)}</ul></div>}
                    {pegadinhas.length > 0 && <div><span className="text-xs font-medium text-muted-foreground">Pegadinhas de prova:</span><ul className="text-sm space-y-1 mt-1">{pegadinhas.map((p, i) => <li key={i} className="text-destructive">⚠ {p}</li>)}</ul></div>}
                  </CardContent>
                </Card>
              )}

              {/* Collapsibles */}
              {itensProva.length > 0 && (
                <Collapsible open={showExam} onOpenChange={setShowExam}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="text-sm flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Estrutura de prova ({itensProva.length})</span>
                      {showExam ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-3 mt-2">
                      {itensProva.map((it, i) => (
                        <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                          <p className="text-sm font-medium">{it.item}</p>
                          <p className="text-xs text-muted-foreground">📌 {it.ponto_chave_prova}</p>
                          <p className="text-xs text-destructive">⚠ {it.armadilha_comum}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {mapaClinico.length > 0 && (
                <Collapsible open={showMap} onOpenChange={setShowMap}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="text-sm">Mapa clínico ({mapaClinico.length} termos)</span>
                      {showMap ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {mapaClinico.map((m, i) => (
                        <div key={i} className="p-3 rounded-lg border space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{m.representacao_no_mnemonico}</Badge>
                            <span className="text-sm font-medium">→ {m.termo_original}</span>
                          </div>
                          {safeArray(m.qualificadores).length > 0 && <p className="text-xs text-muted-foreground">Qualificadores: {m.qualificadores.join(", ")}</p>}
                          {m.explicacao && <p className="text-xs text-muted-foreground italic">{m.explicacao}</p>}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {itemsMap.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Mapa de associações</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {itemsMap.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <Badge variant="outline" className="font-mono text-lg w-8 h-8 flex items-center justify-center">{item.letter}</Badge>
                          <span className="font-medium">{item.word}</span>
                          <span className="text-muted-foreground">→ {item.original_item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {agentLogs.length > 0 && (
                <Collapsible open={showAgents} onOpenChange={setShowAgents}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="text-sm">Detalhes dos agentes ({agentLogs.length})</span>
                      {showAgents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {agentLogs.map((log, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/50">
                          <Badge variant={log.status === "ok" || log.status === "approved" ? "default" : "destructive"} className="text-xs">{log.agent}</Badge>
                          <span className="text-muted-foreground">{log.details}</span>
                          {log.attempt > 1 && <Badge variant="outline" className="text-xs">Retry #{log.attempt}</Badge>}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyAll}><Copy className="h-4 w-4 mr-1" /> Copiar tudo</Button>
                <Button variant="outline" size="sm" onClick={handleFavorite} disabled={favoriteMutation.isPending}><Heart className="h-4 w-4 mr-1" /> Favoritar</Button>
                <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(true)}><MessageSquare className="h-4 w-4 mr-1" /> Feedback detalhado</Button>
              </div>

              {/* ═══ QUICK FEEDBACK com regeneração inteligente ═══ */}
              <Card className="border-muted">
                <CardContent className="py-3 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground">Este mnemônico ajudou?</span>
                    <div className="flex gap-2">
                      <Button variant={quickFeedback === "muito" ? "default" : "outline"} size="sm" onClick={() => handleQuickFeedback("muito")} className={quickFeedback === "muito" ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                        <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Muito
                      </Button>
                      <Button variant={quickFeedback === "pouco" ? "default" : "outline"} size="sm" onClick={() => handleQuickFeedback("pouco")} className={quickFeedback === "pouco" ? "bg-amber-600 hover:bg-amber-700" : ""}>
                        <Minus className="h-3.5 w-3.5 mr-1" /> Pouco
                      </Button>
                      <Button variant={quickFeedback === "nada" ? "default" : "outline"} size="sm" onClick={() => handleQuickFeedback("nada")} className={quickFeedback === "nada" ? "bg-red-600 hover:bg-red-700" : ""}>
                        <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Não
                      </Button>
                    </div>
                  </div>

                  {/* ═══ REGENERAÇÃO INTELIGENTE — sugestão automática para feedback ruim ═══ */}
                  {quickFeedback === "nada" && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" /> Tente outro estilo — qual combina mais com você?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {REGENERATE_OPTIONS.map(opt => (
                          <Button key={opt.value} variant="outline" size="sm" onClick={() => handleRegenerate(opt.value)} disabled={isLoading} className="border-amber-500/30 hover:bg-amber-500/10">
                            <Wand2 className="h-3 w-3 mr-1" /> {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {quickFeedback === "pouco" && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-blue-700 flex items-center gap-2">
                        <Lightbulb className="h-3.5 w-3.5" /> Dica: experimente regenerar em "Mais visual" ou "Mais engraçado" para fixar melhor.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Regenerar */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center mr-1">Regenerar:</span>
                {REGENERATE_OPTIONS.map(opt => (
                  <Button key={opt.value} variant="outline" size="sm" onClick={() => handleRegenerate(opt.value)} disabled={isLoading} title={opt.description}>
                    <RefreshCw className="h-3 w-3 mr-1" /> {opt.label}
                  </Button>
                ))}
              </div>

              <MnemonicFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} resultId={result.result_id} requestId={result.request_id} />
            </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
