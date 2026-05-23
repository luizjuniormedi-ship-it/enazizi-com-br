import { useState, useCallback, useEffect, useRef } from "react";
import { pedagogicalEventBus } from "@/lib/pedagogicalEventBus";
import { useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Sparkles, AlertTriangle, Loader2,
  Copy, Heart, MessageSquare, RefreshCw,
  Lightbulb, BookOpen, Eye, Image as ImageIcon,
  Target, Play, Bookmark, Clock,
  ThumbsUp, ThumbsDown, Minus, Wand2,
  ChevronDown, ChevronUp, Wand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import { useRegenerateMnemonic } from "@/hooks/useRegenerateMnemonic";
import { generateWithAutoRetry, isValidMnemonicResult } from "@/lib/mnemonicAutoRetry";
import { MnemonicFeedbackModal } from "@/components/mnemonics/MnemonicFeedbackModal";
import { validateMnemonicForm } from "@/utils/mnemonicValidation";
import { supabase } from "@/integrations/supabase/client";
import type { MnemonicResultData, RegenerateStyle } from "@/types/mnemonics";
import { ESTILOS, PUBLICOS, REGENERATE_OPTIONS } from "@/types/mnemonics";
import { telemetry } from "@/lib/pedagogicalTelemetry";

const safeArray = <T,>(arr: T[] | undefined | null): T[] => Array.isArray(arr) ? arr : [];

// ═══ UTILITY SCORE MAP ═══
const UTILITY_MAP: Record<string, number> = { muito: 2, pouco: 0, nada: -2 };

// ═══ SUGESTÕES DO BANCO DE ERROS ═══
function useErrorSuggestions() {
  return useQuery({
    queryKey: ["mnemonic-error-suggestions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("error_bank")
        .select("tema, subtema, vezes_errado, categoria_erro, updated_at, dificuldade")
        .eq("user_id", user.id)
        .eq("dominado", false)
        .order("vezes_errado", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(5);
      if (!data || data.length === 0) return [];
      return data.map(e => ({
        tema: e.tema,
        subtema: e.subtema,
        vezes_errado: e.vezes_errado,
        categoria: e.categoria_erro,
      }));
    },
    staleTime: 60_000,
  });
}

export default function MnemonicGeneratorPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [tema, setTema] = useState("");
  const [termosText, setTermosText] = useState("");
  const [estilo, setEstilo] = useState("frase + imagem mental");
  const [publico, setPublico] = useState("graduacao");
  const [result, setResult] = useState<MnemonicResultData | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [savingFlashcard, setSavingFlashcard] = useState(false);
  const [savingFsrs, setSavingFsrs] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Telemetry: module opened (Fase A baseline)
  useEffect(() => { telemetry.track('mnemonic_opened'); }, []);

  // ── Deep-link from study-next / cockpit ──
  // Suporta: ?tema=... &topic=... &termos=a,b,c &estilo=... &publico=... &auto=1
  // autoTriggeredRef moved to auto-trigger effect section


  useEffect(() => {
    const state = location.state as { prefillTopic?: string; fromErrorBank?: boolean } | null;
    const temaParam = searchParams.get("tema") || searchParams.get("topic") || state?.prefillTopic;
    const termosParam = searchParams.get("termos");
    const estiloParam = searchParams.get("estilo");
    const publicoParam = searchParams.get("publico");

    if (temaParam) setTema(temaParam);
    
    if (termosParam) {
      const list = termosParam
        .split(/[,;|\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (list.length > 0) setTermosText(list.join("\n"));
    }
    
    if (estiloParam) setEstilo(estiloParam);
    if (publicoParam) setPublico(publicoParam);
  }, [searchParams, location.state]);

  const { data: errorSuggestions } = useErrorSuggestions();

  // ── Auto-suggest topics/subthemes from curriculum_matrix ──
  const [suggestedTopics, setSuggestedTopics] = useState<Array<{ tema: string; subtema: string | null }>>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!tema || tema.trim().length < 2 || tema.includes(" — ")) { 
      setSuggestedTopics([]); 
      return; 
    }
    
    setLoadingTopics(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const searchTerm = tema.trim();
        const { data } = await supabase
          .from("curriculum_matrix")
          .select("tema, subtema")
          .eq("ativo", true)
          .or(`tema.ilike.%${searchTerm}%,subtema.ilike.%${searchTerm}%`)
          .limit(6);

        if (data && data.length > 0) {
          const unique = new Map<string, { tema: string; subtema: string | null }>();
          data.forEach(item => {
            const key = item.subtema ? `${item.tema} — ${item.subtema}` : item.tema;
            if (!unique.has(key)) {
              unique.set(key, { tema: item.tema, subtema: item.subtema });
            }
          });
          setSuggestedTopics(Array.from(unique.values()));
        } else {
          setSuggestedTopics([]);
        }
      } catch { 
        setSuggestedTopics([]); 
      } finally { 
        setLoadingTopics(false); 
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [tema]);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestedTopics.length > 0 && !document.getElementById('mnemonic-topic-input')?.contains(e.target as Node)) {
        setSuggestedTopics([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [suggestedTopics]);

  const favoriteMutation = useToggleFavorite();
  const regenerateMutation = useRegenerateMnemonic();
  const termos = termosText.split("\n").map(t => t.trim()).filter(Boolean);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState<string>("Gerando mnemônico...");
  const isLoading = isGenerating || regenerateMutation.isPending;

  const handleGenerate = useCallback(async (overrideTopic?: string | React.MouseEvent) => {
    // If it's a click event, overrideTopic will be an object. We want a string.
    const finalTema = (typeof overrideTopic === 'string' ? overrideTopic : tema || "").trim();
    console.log("[MNEMONIC_01_AUTO_TRIGGER] Starting generation for:", finalTema);
    
    // We use the current state values for style and public
    const validation = validateMnemonicForm({ tema: finalTema, termos, estilo, publico });
    if (!validation.valid) { 
      console.warn("[MNEMONIC_VALIDATION_FAILED]", validation.errors);
      setFormErrors(validation.errors); 
      return; 
    }
    
    setFormErrors({});
    setResult(null);
    setResultError(null);
    setQuickFeedback(null);
    setIsGenerating(true);
    
    const isAutoMode = termos.length === 0;
    const payload = { tema: finalTema, termos, estilo, publico };
    console.log("[MNEMONIC_02_PAYLOAD]", payload);
    
    setGeneratingStatus(isAutoMode
      ? "🧠 Extraindo termos do tema com IA..."
      : "Gerando mnemônico...");
      
    try {
      console.log("[MNEMONIC_03_INVOKE_START]");
      const res = await generateWithAutoRetry(
        payload,
        (msg) => {
          console.log("[MNEMONIC_STATUS_UPDATE]", msg);
          setGeneratingStatus(msg);
        }
      );
      
      console.log("[MNEMONIC_04_RESPONSE]", res);
      
      if (res.success && res.data && isValidMnemonicResult(res.data, { inputTerms: termos, requireScene: true })) {
        console.log("[MNEMONIC_05_PARSED] Success:", res.data.result_id);
        
        // SET RESULT FIRST - CRITICAL: Rendering must not depend on telemetry success
        setResult(res.data);
        console.log("[MNEMONIC_SET_STATE] State updated with result.");
        setResultError(null);
        
        // NON-BLOCKING TELEMETRY
        // We do NOT await this. We let it run in background.
        (async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && res.data) {
              console.log("[MNEMONIC_07_DB_SAVE] Emitting event (non-blocking)...");
              const stableIdempotencyKey = `mnem_${user.id}_${res.data.result_id}`;
              
              pedagogicalEventBus.emit({
                event_type: 'mnemonic_generated',
                module: 'content',
                source: 'frontend',
                entity_type: 'mnemonic',
                entity_id: res.data.result_id,
                idempotency_key: stableIdempotencyKey,
                study_context: {
                  topic: finalTema
                },
                metadata: {
                  score: res.data.score_final,
                  is_auto: isAutoMode,
                  event_hash: stableIdempotencyKey
                }
              }, user.id).catch(err => {
                console.error("[MNEMONIC_TELEMETRY_FAILED_NON_BLOCKING]", err);
              });
            }
          } catch (err) {
            console.error("[MNEMONIC_TELEMETRY_SESSION_FAILED]", err);
          }
        })();

        toast.success(isAutoMode ? "Mnemônico gerado automaticamente!" : "Mnemônico gerado!");
      } else {
        const msg = res.error || "Não foi possível gerar um mnemônico válido. Tente novamente.";
        console.error("[MNEMONIC_FAILED_VALIDATION]", msg);
        setResult(null);
        setResultError(msg);
        telemetry.track('mnemonic_rejected', { tema: finalTema, reason: res.error || 'validation_failed' });
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err?.message || "Erro ao gerar mnemônico.";
      console.error("[MNEMONIC_ERROR_CAUGHT]", err);
      setResult(null);
      setResultError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [tema, termos, estilo, publico]);

  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    const auto = searchParams.get("auto");
    const isAuto = auto === "1" || auto === "true";
    const temaFromUrl = searchParams.get("tema") || searchParams.get("topic");
    
    if (!isAuto || !temaFromUrl || autoTriggeredRef.current) return;

    autoTriggeredRef.current = true;
    setTema(temaFromUrl);

    console.log("[MnemonicStudio] Auto-trigger confirmed for topic:", temaFromUrl);
    
    // We use a small delay to allow the state to settle and ensure handleGenerate is called
    const t = setTimeout(() => { 
      // Direct call to avoid stale closure issues if possible
      handleGenerate(temaFromUrl); 
    }, 1000);
    
    return () => clearTimeout(t);
  }, [searchParams, handleGenerate]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    const parts = [
      result.sigla ? `📝 ${result.sigla}` : "",
      `💡 ${result.frase_mnemonica}`,
      "",
      `📚 ${(result as any).explicacao_associacao || result.explicacao_didatica}`,
      "",
      result.cena_visual ? `🎬 ${result.cena_visual}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join("\n"));
    toast.success("Copiado!");
  }, [result]);

  const handleFavorite = useCallback(() => {
    if (!result) return;
    favoriteMutation.mutate(result.result_id, {
      onSuccess: (isFav) => {
        telemetry.track('mnemonic_saved', { tema: result.tema, result_id: result.result_id, favorite: isFav });
        toast.success(isFav ? "Favoritado!" : "Removido.");
      },
      onError: (err) => toast.error(err.message),
    });
  }, [result, favoriteMutation]);

  const handleRegenerate = useCallback((style: RegenerateStyle) => {
    if (!result) return;
    setQuickFeedback(null);
    regenerateMutation.mutate({ tema, termos, estilo, publico, style_hint: style, original_result_id: result.result_id }, {
      onSuccess: (res) => { if (res.success && res.data) { setResult(res.data); toast.success("Nova versão!"); } else { toast.error(res.error || "Erro."); } },
      onError: (err) => toast.error(err.message),
    });
  }, [result, tema, termos, estilo, publico, regenerateMutation]);

  const handleRegenerateImageOnly = useCallback(async () => {
    if (!result) return;
    setRegeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-mnemonic", {
        body: {
          tema, termos, estilo, publico,
          regenerate_image_only: true,
          original_result_id: result.result_id,
        },
      });
      if (error) throw new Error("Erro ao regenerar imagem.");
      if (data?.success && data?.data?.image_url) {
        setResult(prev => prev ? { ...prev, image_url: data.data.image_url, image_failed: false } : prev);
        toast.success("Imagem regenerada!");
      } else {
        toast.error("Falha ao gerar imagem. Tente novamente.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao regenerar imagem.");
    } finally {
      setRegeneratingImage(false);
    }
  }, [result, tema, termos, estilo, publico]);

  const handleSaveFlashcard = useCallback(async () => {
    if (!result) return;
    setSavingFlashcard(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login."); return; }
      const question = `${result.frase_mnemonica}\n\nQual conceito médico?`;
      const answer = `${result.tema}\n\n${(result as any).explicacao_associacao || result.explicacao_didatica}`;
      const { error } = await supabase.from("flashcards").insert({ user_id: user.id, question, answer, topic: result.tema, is_global: false });
      if (error) throw error;
      telemetry.track('mnemonic_used_in_flashcard', { tema: result.tema, result_id: result.result_id });
      toast.success("Flashcard criado!");
    } catch (err: any) { toast.error(err.message || "Erro."); }
    finally { setSavingFlashcard(false); }
  }, [result]);

  const handleSendToReview = useCallback(async () => {
    if (!result) return;
    setSavingFsrs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login."); return; }
      const { data: existing } = await supabase.from("fsrs_cards").select("id").eq("user_id", user.id).eq("card_ref_id", result.result_id).eq("card_type", "mnemonic").maybeSingle();
      if (existing) { toast.info("Já está na revisão!"); return; }
      const { error } = await supabase.from("fsrs_cards").insert({ user_id: user.id, card_ref_id: result.result_id, card_type: "mnemonic", due: new Date().toISOString(), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: 0 });
      if (error) throw error;
      telemetry.track('mnemonic_reviewed', { tema: result.tema, result_id: result.result_id });
      toast.success("Adicionado à revisão espaçada!");
    } catch (err: any) { toast.error(err.message || "Erro."); }
    finally { setSavingFsrs(false); }
  }, [result]);

  const handleQuickFeedback = useCallback(async (level: "muito" | "pouco" | "nada") => {
    if (!result) return;
    setQuickFeedback(level);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ratings: Record<string, number> = { muito: 5, pouco: 3, nada: 1 };
      await supabase.from("mnemonic_feedback").insert({
        user_id: user.id, result_id: result.result_id,
        request_id: result.request_id || null,
        rating_general: ratings[level], rating_medical: ratings[level],
        rating_pedagogical: ratings[level], utility_score: UTILITY_MAP[level],
        comentario: `Quick: ${level === "muito" ? "Ajudou muito" : level === "pouco" ? "Ajudou pouco" : "Não ajudou"}`,
      });
      toast.success("Feedback salvo!");
    } catch {}
  }, [result]);

  const handleUseSuggestion = useCallback((s: { tema: string; subtema: string | null }) => {
    setTema(s.subtema ? `${s.tema} — ${s.subtema}` : s.tema);
    setTermosText("");
    setSuggestedTopics([]); // Fecha o dropdown ao selecionar
    toast.info("Tema selecionado — IA extrairá os termos automaticamente.");
  }, []);

  const handleApplySuggestedTerms = useCallback((terms: string[]) => {
    const current = termosText.split("\n").map(t => t.trim()).filter(Boolean);
    const merged = [...new Set([...current, ...terms])];
    setTermosText(merged.join("\n"));
    toast.success(`${terms.length} termo(s) adicionado(s)`);
  }, [termosText]);

  // Get the association explanation (new field or fallback)
  const explicacaoAssociacao = result ? ((result as any).explicacao_associacao || result.explicacao_didatica || "") : "";

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gerador de Mnemônicos</h1>
          <p className="text-muted-foreground text-sm">Crie mnemônicos visuais e memoráveis em português</p>
        </div>
      </div>

      {/* Error suggestions */}
      {errorSuggestions && errorSuggestions.length > 0 && !result && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-red-500/5">
          <CardContent className="py-3">
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Temas com mais erros — crie um mnemônico:
            </p>
            <div className="flex flex-wrap gap-2">
              {errorSuggestions.map((s, i) => (
                <Button key={i} variant="outline" size="sm" onClick={() => handleUseSuggestion(s)} className="border-amber-500/30 hover:bg-amber-500/10 text-xs">
                  {s.subtema || s.tema}
                  <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">{s.vezes_errado}×</Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ FORM ═══ */}
      {!result && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Banner Modo Automático */}
            <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-3 flex items-start gap-3">
              <Wand className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-primary">Modo Automático Ativado</p>
                <p className="text-xs text-muted-foreground">
                  Apenas digite o tema — a IA extrai automaticamente os termos mais cobrados em prova e cria o mnemônico completo.
                </p>
              </div>
            </div>

            <div className="space-y-1 relative" id="mnemonic-topic-input">
              <label className="text-sm font-medium">Tema médico</label>
              <div className="relative group">
                <Input
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  onFocus={() => {
                    if (tema.length >= 2 && !tema.includes(" — ")) {
                      // Trigger suggestion search on focus if input already has enough length
                      setTema(tema); 
                    }
                  }}
                  placeholder="Ex: Critérios de Light para derrame pleural"
                  className="pr-10"
                />
                {loadingTopics && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {suggestedTopics.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-1.5 border-b bg-muted/30">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2">Subtemas sugeridos (Matriz Curricular)</p>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    {suggestedTopics.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex flex-col gap-0.5 border-b last:border-0 border-border/40"
                        onClick={() => handleUseSuggestion(s)}
                      >
                        <span className="font-semibold text-primary/90">{s.subtema || s.tema}</span>
                        {s.subtema && <span className="text-[10px] text-muted-foreground italic">{s.tema}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formErrors.tema && <p className="text-xs text-destructive">{formErrors.tema}</p>}
              <p className="text-[11px] text-muted-foreground">
                Quanto mais específico, melhor o mnemônico (ex: "Tríade de Charcot na colangite", "Critérios de Ranson na pancreatite").
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Estilo</label>
                <Select value={estilo} onValueChange={setEstilo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTILOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Público</label>
                <Select value={publico} onValueChange={setPublico}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PUBLICOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Opções avançadas — termos manuais */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Opções avançadas: definir termos manualmente
                    {termos.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">{termos.length}</Badge>
                    )}
                  </span>
                  {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <p className="text-[11px] text-muted-foreground">
                  Deixe em branco para a IA extrair automaticamente. Se preferir, informe entre 3 e 7 termos (um por linha).
                </p>
                <Textarea
                  value={termosText}
                  onChange={(e) => setTermosText(e.target.value)}
                  placeholder={"Proteína\nLDH\nGlicose"}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">{termos.length} termo(s)</p>
                {formErrors.termos && <p className="text-xs text-destructive">{formErrors.termos}</p>}
                {/* Termos sugeridos removidos para focar em temas e extração automática */}
              </CollapsibleContent>
            </Collapsible>

            <Button onClick={handleGenerate} disabled={isLoading} className="w-full" size="lg">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {isLoading
                ? "Gerando..."
                : termos.length === 0
                  ? "Gerar Mnemônico Automaticamente"
                  : "Gerar Mnemônico"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && !result && (
        <Card className="border-primary/20">
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">{generatingStatus}</p>
            <p className="text-xs text-muted-foreground">
              O sistema valida automaticamente e regenera se a qualidade não for suficiente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Erro — quando todas as tentativas falharam */}
      {!isLoading && !result && resultError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm font-medium text-destructive">{resultError}</p>
            <p className="text-xs text-muted-foreground">
              Nenhum resultado foi exibido para evitar conteúdo incoerente.
            </p>
            <Button onClick={handleGenerate} size="sm">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══ RESULT ═══ */}
      {result && (
        <div className="space-y-4" id="mnemonic-result-container">
          {(() => { console.log("[MNEMONIC_06_RENDER] Rendering result:", result.result_id); return null; })()}
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => { setResult(null); setQuickFeedback(null); }}>
            ← Novo mnemônico
          </Button>

          {/* ─── BLOCO 1: MNEMÔNICO PRINCIPAL ─── */}
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6 pb-4 text-center space-y-3">
              {(result.sigla || (result as any).acronym || (result as any).title) && (
                <p className="text-4xl font-black tracking-[0.2em] text-primary" data-testid="mnemonic-sigla">
                  {result.sigla || (result as any).acronym || (result as any).title}
                </p>
              )}
              <p className="text-2xl font-bold leading-relaxed" data-testid="mnemonic-phrase">
                {result.frase_mnemonica || (result as any).phrase || (result as any).mnemonic || (result as any).frase || "Mnemônico gerado"}
              </p>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="mx-auto" data-testid="mnemonic-copy-btn">
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </CardContent>
          </Card>

          {/* ─── BLOCO 2: ASSOCIAÇÃO ─── */}
          {explicacaoAssociacao && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Como funciona a associação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{explicacaoAssociacao}</p>
              </CardContent>
            </Card>
          )}

          {/* ─── BLOCO 3: CENA VISUAL ─── */}
          {result.cena_visual && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> 🎬 Cena visual para memorização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{result.cena_visual}</p>
              </CardContent>
            </Card>
          )}

          {/* ─── BLOCO 4: IMAGEM ─── */}
          <Card className="overflow-hidden">
            {result.image_url ? (
              <>
                <div className="relative">
                  <img
                    src={result.image_url}
                    alt={`Mnemônico visual: ${result.tema}`}
                    className="w-full max-h-[400px] object-contain bg-gradient-to-b from-background to-muted/30"
                    loading="lazy"
                  />
                </div>
                <CardContent className="py-3 flex justify-center">
                  <Button variant="outline" size="sm" onClick={handleRegenerateImageOnly} disabled={regeneratingImage}>
                    {regeneratingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
                    Regenerar imagem
                  </Button>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-8 text-center space-y-3">
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Imagem não foi gerada</p>
                <Button variant="outline" size="sm" onClick={handleRegenerateImageOnly} disabled={regeneratingImage}>
                  {regeneratingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImageIcon className="h-3.5 w-3.5 mr-1" />}
                  Gerar imagem
                </Button>
              </CardContent>
            )}
          </Card>

          {/* ─── BLOCO 5: PONTOS DE PROVA (opcional) ─── */}
          {safeArray((result as any).pontos_de_prova).length > 0 && (
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                  <Target className="h-4 w-4" /> Pontos de prova
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {safeArray((result as any).pontos_de_prova).map((pp: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <p className="text-sm font-semibold">❓ {pp.pergunta_gatilho}</p>
                    <p className="text-sm text-emerald-600">✅ {pp.resposta_esperada}</p>
                    {pp.armadilha_comum && <p className="text-xs text-destructive">⚠️ {pp.armadilha_comum}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ─── AÇÕES RÁPIDAS ─── */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={handleSaveFlashcard} disabled={savingFlashcard}>
              {savingFlashcard ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Bookmark className="h-3.5 w-3.5 mr-1" />} Flashcard
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendToReview} disabled={savingFsrs}>
              {savingFsrs ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Clock className="h-3.5 w-3.5 mr-1" />} Revisar
            </Button>
            <Button variant="outline" size="sm" onClick={handleFavorite} disabled={favoriteMutation.isPending}>
              <Heart className="h-3.5 w-3.5 mr-1" /> Favoritar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Feedback
            </Button>
          </div>

          {/* ─── QUICK FEEDBACK ─── */}
          <Card className="border-muted">
            <CardContent className="py-3">
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <span className="text-sm text-muted-foreground">Ajudou a memorizar?</span>
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
            </CardContent>
          </Card>

          {/* ─── REGENERAR MNEMÔNICO ─── */}
          <Card className="border-muted">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground text-center mb-2">Regenerar mnemônico em outro estilo:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {REGENERATE_OPTIONS.map(opt => (
                  <Button key={opt.value} variant="outline" size="sm" onClick={() => handleRegenerate(opt.value)} disabled={isLoading} title={opt.description}>
                    <Wand2 className="h-3 w-3 mr-1" /> {opt.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <MnemonicFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} resultId={result.result_id} requestId={result.request_id} />
        </div>
      )}
    </div>
  );
}
