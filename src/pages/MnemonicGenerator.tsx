import { useState, useCallback, useRef } from "react";
import { Brain, Sparkles, AlertTriangle, CheckCircle2, Lightbulb, Eye, Loader2, ShieldAlert, RotateCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { generateOrReuseMnemonicForUser, type MnemonicResult, type MnemonicResponse } from "@/lib/mnemonicUnifiedService";
import { validateMnemonicInputBeforeGeneration } from "@/lib/mnemonicPreValidation";
import { autoCompleteMnemonicItems } from "@/lib/mnemonicAutoComplete";
import { optimizeMnemonicItems } from "@/lib/mnemonicOptimizer";
import { autoRepairMnemonic } from "@/lib/mnemonicAutoRepair";
import { useSubtopicSuggestions } from "@/hooks/useSubtopicSuggestions";
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

interface RejectionState {
  error: string;
  audit?: { medical_score: number; pedagogical_score: number; combined_score?: number };
}

const MnemonicGenerator = () => {
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [contentType, setContentType] = useState("criterios");
  const [itemsText, setItemsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [result, setResult] = useState<MnemonicResult | null>(null);
  const [rejection, setRejection] = useState<RejectionState | null>(null);
  const [showReview, setShowReview] = useState(false);

  const { suggestions, loading: loadingSuggestions } = useSubtopicSuggestions(topic);

  const fetchItemsForSubtopic = useCallback(async (selectedSubtopic: string) => {
    if (!topic.trim() || !selectedSubtopic.trim()) return;
    setLoadingItems(true);
    try {
      const effectiveTopic = `${topic.trim()} - ${selectedSubtopic.trim()}`;
      const { data, error } = await supabase.functions.invoke("suggest-mnemonic-items", {
        body: { topic: effectiveTopic, contentType },
      });
      if (!error && Array.isArray(data?.items) && data.items.length > 0) {
        const itemNames = data.items.map((it: any) => typeof it === "string" ? it : it.name || it.item || "").filter(Boolean);
        if (itemNames.length >= 3) {
          setItemsText(itemNames.join("\n"));
          toast.success(`${itemNames.length} itens sugeridos automaticamente`);
        }
      }
    } catch {
      // silent - user can fill manually
    } finally {
      setLoadingItems(false);
    }
  }, [topic, contentType]);

  const handleSubtopicSelect = useCallback((name: string) => {
    setSubtopic(name);
    if (!itemsText.trim()) {
      fetchItemsForSubtopic(name);
    }
  }, [fetchItemsForSubtopic, itemsText]);

  const items = itemsText
    .split("\n")
    .map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").trim())
    .filter(Boolean);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return toast.error("Informe o tema.");
    if (items.length < 3) return toast.error("Informe pelo menos 3 itens (um por linha).");
    if (items.length > 7) return toast.error("Máximo de 7 itens para mnemônico visual.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Faça login para gerar mnemônicos.");

    const effectiveTopic = subtopic.trim()
      ? `${topic.trim()} - ${subtopic.trim()}`
      : topic.trim();

    // Pre-validation — catch predictable rejections before calling AI
    const preCheck = validateMnemonicInputBeforeGeneration({ topic: effectiveTopic, items, contentType });
    if (!preCheck.valid) {
      toast.error(preCheck.error || "Lista inválida.", { description: preCheck.suggestion });
      return;
    }

    setLoading(true);
    setResult(null);
    setRejection(null);
    setShowReview(false);

    try {
      // Auto-complete — fill missing critical items before generation
      const autoComplete = await autoCompleteMnemonicItems({ topic: effectiveTopic, subtopic: subtopic.trim() || undefined, items, contentType });
      if (!autoComplete.valid) {
        toast.error(autoComplete.suggestion || autoComplete.reason || "Não foi possível completar a lista com segurança.");
        setLoading(false);
        return;
      }
      const finalItems = autoComplete.finalItems;
      if (autoComplete.autoCompleted) {
        toast.info("Adicionamos itens importantes automaticamente para melhorar a qualidade do seu mnemônico.", { description: `Itens adicionados: ${autoComplete.addedItems.join(", ")}` });
      }

      // Optimize — shorten, deduplicate, reorder for stronger mnemonics
      const optimized = optimizeMnemonicItems({ topic: effectiveTopic, subtopic: subtopic.trim() || undefined, items: finalItems });
      if (optimized.changes.length > 0) {
        toast.info("Otimizamos os itens para melhorar o mnemônico.");
      }

      const response = await generateOrReuseMnemonicForUser({
        userId: user.id,
        topic: effectiveTopic,
        contentType,
        items: optimized.optimizedItems,
        source: "manual",
      });

      if (!response.success) {
        if (response.rejected) {
          // AUTO-REPAIR: try to fix and regenerate before showing error
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
          // Repair failed — show rejection
          setRejection({ error: response.error || "Rejeitado pelos auditores.", audit: response.audit });
        } else {
          toast.error(response.error || "Erro ao gerar mnemônico.");
        }
        return;
      }

      if (response.result) {
        setResult(response.result);
        toast.success(response.result.cached ? "Mnemônico recuperado do cache! 🧠" : "Mnemônico gerado com sucesso! 🧠");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar mnemônico.");
    } finally {
      setLoading(false);
    }
  }, [topic, subtopic, items, contentType]);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto pb-20">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Mnemônico Visual
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Gere mnemônicos com imagem para memorizar listas médicas de prova.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tema</label>
            <Input
              placeholder="Ex: Critérios de Jones, Sinais de Ranson..."
              value={topic}
              onChange={(e) => { setTopic(e.target.value); setSubtopic(""); }}
              disabled={loading}
            />
            {loadingSuggestions && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando subtemas...
              </div>
            )}
            {!loadingSuggestions && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => handleSubtopicSelect(s.name)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      subtopic === s.name
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 text-foreground border-border hover:bg-secondary"
                    }`}
                    disabled={loading}
                  >
                    {s.name}
                    {s.priority === "high" && " 🔥"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subtema (opcional)</label>
            <Input
              placeholder="Ex: Taquiarritmias, Choque séptico..."
              value={subtopic}
              onChange={(e) => setSubtopic(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de conteúdo</label>
            <Select value={contentType} onValueChange={setContentType} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Itens (um por linha, 3-7 itens)</label>
            {loadingItems && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Sugerindo itens...
              </div>
            )}
            <Textarea
              placeholder={`Ex:\nFebre\nArtrite\nCardite\nCoreia\nNódulos subcutâneos`}
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              rows={6}
              disabled={loading || loadingItems}
            />
            <p className="text-xs text-muted-foreground">
              {items.length} item(ns) detectado(s)
              {items.length > 0 && items.length < 3 && " — mínimo 3"}
              {items.length > 7 && " — máximo 7"}
            </p>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={loading || items.length < 3 || items.length > 7 || !topic.trim()}
          >
            {loading ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                Gerando mnemônico (auditoria dupla)...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Gerar Mnemônico Visual
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {rejection && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Mnemônico reprovado pela auditoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {rejection.error.length > 300
                ? rejection.error.slice(0, 300) + "…"
                : rejection.error}
            </p>
            {rejection.audit && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                  <p className="text-xs font-medium">🩺 Auditor Médico</p>
                  <p className="text-lg font-bold">{rejection.audit.medical_score}/100</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                  <p className="text-xs font-medium">📚 Auditor Pedagógico</p>
                  <p className="text-lg font-bold">{rejection.audit.pedagogical_score}/100</p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => { setRejection(null); }}>
                <Pencil className="h-4 w-4" />
                Ajustar itens
              </Button>
              <Button className="flex-1 gap-1.5" onClick={() => { setRejection(null); handleGenerate(); }}>
                <RotateCcw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <MnemonicResultDisplay result={result} items={items} showReview={showReview} setShowReview={setShowReview} />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════
// RESULT DISPLAY (extracted component)
// ══════════════════════════════════════════════════

function MnemonicResultDisplay({
  result, items, showReview, setShowReview,
}: {
  result: MnemonicResult;
  items: string[];
  showReview: boolean;
  setShowReview: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      {result.warning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <span>{result.warning}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              {result.topic}
            </span>
            <div className="flex items-center gap-2">
              {result.cached && <Badge variant="outline" className="text-xs">Cache</Badge>}
              <Badge variant={result.quality_score >= 80 ? "default" : "destructive"} className="text-xs">
                Score: {result.quality_score}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-primary tracking-wider">{result.mnemonic}</p>
            <p className="text-sm text-muted-foreground mt-1 italic">"{result.phrase}"</p>
          </div>

          <div className="space-y-2">
            {(result.items_map ?? []).map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/50">
                <span className="font-bold text-primary text-lg w-6 text-center shrink-0">{item.letter}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.original_item}</p>
                  <p className="text-xs text-muted-foreground">
                    → {item.word}
                    {item.symbol && (
                      <span className="ml-2">| 🎨 {item.symbol}
                        {item.symbol_reason && <span className="italic"> ({item.symbol_reason})</span>}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(result.image_url || result.scene_description) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Cena Visual
              </span>
              <Badge variant={result.image_url ? "default" : "secondary"} className="text-xs">
                {result.image_url ? "Imagem gerada" : "Imagem indisponível"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.scene_description && (
              <p className="text-xs text-muted-foreground">{result.scene_description}</p>
            )}
            {result.image_url ? (
              <div className="rounded-lg overflow-hidden border">
                <img src={result.image_url} alt={`Mnemônico visual: ${result.topic}`} className="w-full h-auto" loading="lazy" />
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                A imagem não ficou disponível nesta geração. Use a descrição visual acima como fallback de estudo.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result.audit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">🔍 Auditoria Dupla</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-xs font-medium">🩺 Auditor Médico</p>
                <p className="text-lg font-bold">{result.audit.medical_score}/100</p>
                <p className="text-xs text-muted-foreground">{result.audit.medical_summary}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-xs font-medium">📚 Auditor Pedagógico</p>
                <p className="text-lg font-bold">{result.audit.pedagogical_score}/100</p>
                <p className="text-xs text-muted-foreground">{result.audit.pedagogical_summary}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant={result.audit.verdict === "approve" ? "default" : "destructive"}>
                {result.audit.verdict === "approve" ? "✅ Aprovado" : "❌ Rejeitado"}
              </Badge>
              <span className="text-muted-foreground">Score combinado: {result.quality_score}/100</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">📋 Lista textual de referência:</p>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Button variant="outline" className="w-full gap-2" onClick={() => setShowReview(!showReview)}>
            <CheckCircle2 className="h-4 w-4" />
            {showReview ? "Ocultar auto-teste" : "Auto-teste: você lembra?"}
          </Button>
          {showReview && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm">
              <p className="font-medium mb-2">❓ {result.review_question}</p>
              <p className="text-xs text-muted-foreground">Tente lembrar todos os itens antes de rolar para cima e conferir!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MnemonicGenerator;
