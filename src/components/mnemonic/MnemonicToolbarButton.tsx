import { useState, useRef, useEffect, useCallback } from "react";
import { Brain, Sparkles, Lightbulb, Loader2, ChevronDown, Flame, Zap, Pin, ShieldAlert, RotateCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { generateOrReuseMnemonicForUser, type MnemonicResult, type MnemonicResponse } from "@/lib/mnemonicUnifiedService";
import { validateMnemonicInputBeforeGeneration } from "@/lib/mnemonicPreValidation";
import { autoCompleteMnemonicItems } from "@/lib/mnemonicAutoComplete";
import { optimizeMnemonicItems } from "@/lib/mnemonicOptimizer";
import { autoRepairMnemonic } from "@/lib/mnemonicAutoRepair";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CONTENT_TYPES = [
  { value: "criterios", label: "Critérios diagnósticos" },
  { value: "causas", label: "Causas / Etiologias" },
  { value: "sinais_classicos", label: "Sinais clássicos" },
  { value: "classificacao", label: "Classificação" },
  { value: "efeitos_adversos", label: "Efeitos adversos" },
  { value: "fatores_de_risco", label: "Fatores de risco" },
  { value: "lista", label: "Lista geral" },
  { value: "componentes", label: "Componentes / Elementos" },
];

interface SubtopicItem {
  name: string;
  priority: "high" | "medium" | "low";
}

const PRIORITY_CONFIG = {
  high: { icon: Flame, label: "Alta prioridade", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", badge: "🔥" },
  medium: { icon: Zap, label: "Média", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", badge: "⚡" },
  low: { icon: Pin, label: "Baixa", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", badge: "📌" },
};

export const MnemonicToolbarButton = () => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [subtopicSuggestions, setSubtopicSuggestions] = useState<SubtopicItem[]>([]);
  const [subtopicSource, setSubtopicSource] = useState("");
  const [loadingSubtopics, setLoadingSubtopics] = useState(false);
  const [showSubtopicDropdown, setShowSubtopicDropdown] = useState(false);
  const [contentType, setContentType] = useState("criterios");
  const [itemsText, setItemsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("loading");

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ explanation: string } | null>(null);
  const [result, setResult] = useState<MnemonicResult | null>(null);
  const generatingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSubtopics = useCallback(async (themeTopic: string) => {
    if (themeTopic.trim().length < 3) {
      setSubtopicSuggestions([]);
      setSubtopicSource("");
      return;
    }
    setLoadingSubtopics(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-mnemonic-subtopics", {
        body: { topic: themeTopic.trim() },
      });
      if (!error && data?.subtopics?.length > 0) {
        setSubtopicSuggestions(data.subtopics);
        setSubtopicSource(data.source || "");
        setShowSubtopicDropdown(true);
      } else {
        setSubtopicSuggestions([]);
        setSubtopicSource("");
      }
    } catch {
      setSubtopicSuggestions([]);
    }
    setLoadingSubtopics(false);
  }, []);

  const handleTopicChange = (value: string) => {
    setTopic(value);
    setSuggestion(null);
    setSubtopic("");
    setShowSubtopicDropdown(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => fetchSubtopics(value), 400);
    } else {
      setSubtopicSuggestions([]);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSubtopicDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectSubtopic = (sub: SubtopicItem) => {
    setSubtopic(sub.name);
    setShowSubtopicDropdown(false);
    // Telemetry
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("ai_usage_logs" as any).insert({
        user_id: user.id,
        function_name: "mnemonic_subtopic_selected",
        actor_type: "user",
        success: true,
        model_tier: `${subtopicSource}_${sub.priority}`,
      }).then(() => {});
    });
  };

  const items = itemsText.split("\n").map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").trim()).filter(Boolean);

  const handleSuggest = async () => {
    if (!topic.trim() || topic.trim().length < 2) { toast.error("Digite um tema válido primeiro."); return; }
    setSuggesting(true);
    setSuggestion(null);
    try {
      const effectiveTopic = subtopic ? `${topic.trim()} - ${subtopic}` : topic.trim();
      const { data, error } = await supabase.functions.invoke("suggest-mnemonic-items", {
        body: { topic: effectiveTopic, contentType },
      });
      if (error || !data) { toast.error("Erro ao buscar sugestões."); setSuggesting(false); return; }
      if (data.items?.length > 0) {
        setItemsText(data.items.join("\n"));
        setSuggestion({ explanation: data.explanation || "" });
        toast.success(`${data.items.length} itens sugeridos! ✨`);
      } else {
        toast.warning(data.explanation || "Não foi possível sugerir itens para este tema.");
      }
    } catch { toast.error("Falha na comunicação com o servidor."); }
    setSuggesting(false);
  };

  const [rejection, setRejection] = useState<{ error: string; audit?: { medical_score: number; pedagogical_score: number } } | null>(null);

  const handleGenerate = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setRejection(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login para gerar mnemônicos."); return; }
      setLoading(true);
      setResult(null);
      const startTime = Date.now();
      const effectiveTopic = subtopic ? `${topic.trim()} - ${subtopic}` : topic.trim();

      // Pre-validation
      const preCheck = validateMnemonicInputBeforeGeneration({ topic: effectiveTopic, items, contentType });
      if (!preCheck.valid) {
        toast.error(preCheck.error || "Lista inválida.", { description: preCheck.suggestion });
        setLoading(false);
        return;
      }

      // Auto-complete — fill missing critical items before generation
      const autoComplete = await autoCompleteMnemonicItems({ topic: effectiveTopic, subtopic, items, contentType });
      if (!autoComplete.valid) {
        toast.error(autoComplete.suggestion || autoComplete.reason || "Não foi possível completar a lista com segurança.");
        setLoading(false);
        return;
      }
      const finalItems = autoComplete.finalItems;
      if (autoComplete.autoCompleted) {
        toast.info("Itens importantes adicionados automaticamente.", { description: `Adicionados: ${autoComplete.addedItems.join(", ")}` });
      }

      // Optimize — shorten, deduplicate, reorder for stronger mnemonics
      const optimized = optimizeMnemonicItems({ topic: effectiveTopic, subtopic, items: finalItems });
      if (optimized.changes.length > 0) {
        toast.info("Otimizamos os itens para melhorar o mnemônico.");
      }

      const response = await generateOrReuseMnemonicForUser({
        userId: user.id, topic: effectiveTopic, contentType, items: optimized.optimizedItems, source: "manual",
        onStatus: (status) => setLoadingStatus(status)
      });

      const elapsed = Date.now() - startTime;
      supabase.from("ai_usage_logs" as any).insert({
        user_id: user.id, function_name: "generate-mnemonic", actor_type: "user",
        success: response.success, response_time_ms: elapsed,
        cache_hit: response.result?.cached ?? false, error_message: response.error || null,
        model_tier: response.rejected ? "mnemonic_rejected" : subtopic ? "mnemonic_manual_subtopic" : "mnemonic_manual",
      }).then(() => {});
      if (!response.success) {
        if (response.rejected) {
          // AUTO-REPAIR: try to fix and regenerate
          const repair = await autoRepairMnemonic({
            topic: effectiveTopic,
            items: optimized.optimizedItems,
            contentType,
            auditError: response.error || "Rejeitado pelos auditores.",
            audit: response.audit,
            userId: user.id,
            source: "manual",
          });
          if (repair.repaired && repair.response.success) {
            toast.info("Ajustamos automaticamente após validação clínica.");
            if (repair.response.result) {
              setResult(repair.response.result);
              toast.success("Mnemônico gerado com sucesso! 🧠");
            }
            return;
          }
          setRejection({ error: response.error || "Rejeitado pelos auditores.", audit: response.audit });
        } else {
          toast.error(response.error || "Erro ao gerar mnemônico.");
        }
        return;
      }
      if (response.result) {
        setResult(response.result);
        if (response.result.cached) {
          toast.success("Mnemônico recuperado do cache inteligente! 🧠", { icon: "💎" });
        } else if (response.isFallback) {
          toast.success("Mnemônico gerado via rota de redundância! ⚡", { icon: "🛡️" });
        } else {
          toast.success("Mnemônico gerado com sucesso! 🧠");
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar mnemônico.");
    } finally {
      setLoading(false);
      generatingRef.current = false;
    }
  };

  const handleClose = () => {
    setOpen(false); setResult(null); setRejection(null); setTopic(""); setSubtopic("");
    setSubtopicSuggestions([]); setItemsText(""); setSuggestion(null); setShowSubtopicDropdown(false);
  };

  const canSuggest = !suggesting && !loading && topic.trim().length >= 2;
  const canGenerate = !loading && items.length >= 3 && items.length <= 7 && topic.trim().length > 0;

  // Group subtopics by priority
  const groupedSubtopics = {
    high: subtopicSuggestions.filter(s => s.priority === "high"),
    medium: subtopicSuggestions.filter(s => s.priority === "medium"),
    low: subtopicSuggestions.filter(s => s.priority === "low"),
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Brain className="h-4 w-4" />
          <span className="hidden sm:inline">Mnemônico</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Gerar Mnemônico Visual
          </DialogTitle>
        </DialogHeader>

        {rejection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <p className="font-semibold text-sm">Mnemônico reprovado pela auditoria</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {rejection.error.length > 250 ? rejection.error.slice(0, 250) + "…" : rejection.error}
            </p>
            {rejection.audit && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-secondary/50"><p className="font-medium">🩺 Médico: {rejection.audit.medical_score}/100</p></div>
                <div className="p-2 rounded bg-secondary/50"><p className="font-medium">📚 Pedagógico: {rejection.audit.pedagogical_score}/100</p></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" size="sm" onClick={() => setRejection(null)}>
                <Pencil className="h-3.5 w-3.5" /> Ajustar itens
              </Button>
              <Button className="flex-1 gap-1.5" size="sm" onClick={() => { setRejection(null); handleGenerate(); }}>
                <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : !result ? (
          <div className="space-y-4">
            {/* TEMA */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tema</label>
              <Input
                placeholder="Ex: ECG, Sepse, Insuficiência cardíaca..."
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                disabled={loading || suggesting}
              />
            </div>

            {/* SUBTEMA with priority-based suggestions */}
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-sm font-medium flex items-center gap-2">
                Subtema
                {loadingSubtopics && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {subtopicSuggestions.length > 0 && !loadingSubtopics && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {subtopicSuggestions.length} sugestões
                  </Badge>
                )}
              </label>
              <div className="relative">
                <Input
                  placeholder={subtopicSuggestions.length > 0 ? "Clique para ver sugestões ou digite..." : "Opcional — digite ou aguarde sugestões"}
                  value={subtopic}
                  onChange={(e) => setSubtopic(e.target.value)}
                  onFocus={() => { if (subtopicSuggestions.length > 0) setShowSubtopicDropdown(true); }}
                  disabled={loading || suggesting}
                />
                {subtopicSuggestions.length > 0 && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSubtopicDropdown(!showSubtopicDropdown)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>

              {showSubtopicDropdown && subtopicSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {(["high", "medium", "low"] as const).map(priority => {
                    const group = groupedSubtopics[priority];
                    if (group.length === 0) return null;
                    const config = PRIORITY_CONFIG[priority];
                    return (
                      <div key={priority}>
                        <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${config.color} border-b border-border/50 bg-muted/30`}>
                          {config.badge} {config.label}
                        </div>
                        {group.map((sub, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 border-l-2 ${
                              priority === "high" ? "border-l-red-500" :
                              priority === "medium" ? "border-l-amber-500" :
                              "border-l-blue-400"
                            }`}
                            onClick={() => handleSelectSubtopic(sub)}
                          >
                            <span className="flex-1">{sub.name}</span>
                            <span className="text-[10px] opacity-60">{config.badge}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t flex items-center justify-between">
                    <span>Fonte: {subtopicSource === "curriculum" || subtopicSource === "matrix" ? "currículo estruturado" : "IA"}</span>
                    <span>Prioridade = frequência em prova</span>
                  </div>
                </div>
              )}
            </div>

            {/* TIPO */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de conteúdo</label>
              <Select value={contentType} onValueChange={(v) => { setContentType(v); setSuggestion(null); }} disabled={loading || suggesting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ITENS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Itens (um por linha, 3-7)</label>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary hover:text-primary" onClick={handleSuggest} disabled={!canSuggest}>
                  {suggesting ? (<><Loader2 className="h-3 w-3 animate-spin" />Sugerindo...</>) : (<><Lightbulb className="h-3 w-3" />Sugerir itens</>)}
                </Button>
              </div>
              <Textarea placeholder={`Ex:\nFebre\nArtrite\nCardite\nCoreia\nNódulos subcutâneos`} value={itemsText} onChange={(e) => setItemsText(e.target.value)} rows={5} disabled={loading || suggesting} />
              <p className="text-xs text-muted-foreground">
                {items.length} item(ns)
                {items.length > 0 && items.length < 3 && " — mínimo 3"}
                {items.length > 7 && " — máximo 7"}
              </p>
              {suggestion?.explanation && (
                <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">💡 {suggestion.explanation}</p>
              )}
            </div>

            <Button className="w-full gap-2" onClick={handleGenerate} disabled={!canGenerate}>
              {loading ? (<><Sparkles className="h-4 w-4 animate-spin" />Gerando (auditoria dupla)...</>) : (<><Brain className="h-4 w-4" />Gerar Mnemônico</>)}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-3">
              <p className="text-2xl font-bold text-primary tracking-wider">{result.mnemonic}</p>
              <p className="text-sm text-muted-foreground italic">"{result.phrase}"</p>
              {result.cached && <Badge variant="outline" className="mt-1 text-xs">Cache hit</Badge>}
            </div>
            {result.warning && (<p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{result.warning}</p>)}
            <div className="space-y-1.5">
              {result.items_map.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-secondary/50 text-sm">
                  <span className="font-bold text-primary w-6 text-center shrink-0">{item.letter}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{item.original_item}</span>
                    <span className="text-muted-foreground text-xs"> → {item.word}</span>
                    {item.symbol && <span className="text-muted-foreground text-xs"> | 🎨 {item.symbol}</span>}
                  </div>
                </div>
              ))}
            </div>
            {result.image_url && (
              <div className="rounded-lg overflow-hidden border">
                <img src={result.image_url} alt={`Mnemônico: ${result.topic}`} className="w-full h-auto" loading="lazy" />
              </div>
            )}
            {result.audit && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-secondary/50"><p className="font-medium">🩺 Médico: {result.audit.medical_score}/100</p></div>
                <div className="p-2 rounded bg-secondary/50"><p className="font-medium">📚 Pedagógico: {result.audit.pedagogical_score}/100</p></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>Gerar outro</Button>
              <Button className="flex-1" onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
