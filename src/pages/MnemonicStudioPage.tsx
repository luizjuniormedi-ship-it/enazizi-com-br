import { useState, useCallback } from "react";
import {
  Brain, Sparkles, AlertTriangle, Loader2,
  Copy, Heart, MessageSquare, RefreshCw,
  ChevronDown, ChevronUp, Wand2, BookOpen, Eye, CheckCircle, XCircle, MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useGenerateMnemonic } from "@/hooks/useGenerateMnemonic";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import { useRegenerateMnemonic } from "@/hooks/useRegenerateMnemonic";
import { MnemonicFeedbackModal } from "@/components/mnemonics/MnemonicFeedbackModal";
import { validateMnemonicForm } from "@/utils/mnemonicValidation";
import { getScoreColor, getScoreBg, formatScore } from "@/utils/mnemonicStatus";
import type { MnemonicResultData, RegenerateStyle } from "@/types/mnemonics";
import { ESTILOS, PUBLICOS, REGENERATE_OPTIONS } from "@/types/mnemonics";

const safeArray = <T,>(arr: T[] | undefined | null): T[] => Array.isArray(arr) ? arr : [];

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
  if (flag === "high") return (
    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
      <CheckCircle className="h-3 w-3" /> Alta qualidade
    </Badge>
  );
  if (flag === "low") return (
    <Badge className="bg-red-500/15 text-red-600 border-red-500/30 gap-1">
      <XCircle className="h-3 w-3" /> Baixa qualidade
    </Badge>
  );
  return (
    <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 gap-1">
      <MinusCircle className="h-3 w-3" /> Qualidade média
    </Badge>
  );
}

export default function MnemonicGeneratorPage() {
  const [tema, setTema] = useState("");
  const [termosText, setTermosText] = useState("");
  const [estilo, setEstilo] = useState("frase + imagem mental");
  const [publico, setPublico] = useState("graduacao");
  const [result, setResult] = useState<MnemonicResultData | null>(null);
  const [showAgents, setShowAgents] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const generateMutation = useGenerateMnemonic();
  const favoriteMutation = useToggleFavorite();
  const regenerateMutation = useRegenerateMnemonic();

  const termos = termosText.split("\n").map(t => t.trim()).filter(Boolean);

  const handleGenerate = useCallback(() => {
    const validation = validateMnemonicForm({ tema, termos, estilo, publico });
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});
    setResult(null);

    generateMutation.mutate(
      { tema: tema.trim(), termos, estilo, publico },
      {
        onSuccess: (res) => {
          if (res.success && res.data) {
            setResult(res.data);
            toast.success("Mnemônico gerado com sucesso!");
          } else {
            toast.error(res.error || "Erro ao gerar mnemônico.");
          }
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }, [tema, termos, estilo, publico, generateMutation]);

  const handleCopyPhrase = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.frase_mnemonica);
    toast.success("Frase copiada!");
  }, [result]);

  const handleCopyAll = useCallback(() => {
    if (!result) return;
    const parts = [
      `📝 ${result.sigla}`,
      `💡 ${result.frase_mnemonica}`,
      "",
      `🔬 ${result.explicacao_tecnica}`,
      "",
      `📚 ${result.explicacao_didatica}`,
    ];
    if (result.cena_visual) parts.push("", `🎨 ${result.cena_visual}`);
    navigator.clipboard.writeText(parts.join("\n"));
    toast.success("Tudo copiado!");
  }, [result]);

  const handleFavorite = useCallback(() => {
    if (!result) return;
    favoriteMutation.mutate(result.result_id, {
      onSuccess: (isFav) => toast.success(isFav ? "Favoritado!" : "Removido dos favoritos."),
      onError: (err) => toast.error(err.message),
    });
  }, [result, favoriteMutation]);

  const handleRegenerate = useCallback((style: RegenerateStyle) => {
    if (!result) return;
    regenerateMutation.mutate(
      {
        tema, termos, estilo, publico,
        style_hint: style,
        original_result_id: result.result_id,
      },
      {
        onSuccess: (res) => {
          if (res.success && res.data) {
            setResult(res.data);
            toast.success("Nova versão gerada!");
          } else {
            toast.error(res.error || "Erro ao regenerar.");
          }
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }, [result, tema, termos, estilo, publico, regenerateMutation]);

  const isLoading = generateMutation.isPending || regenerateMutation.isPending;

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gerador de Mnemônicos Médicos</h1>
          <p className="text-muted-foreground text-sm">Pipeline multi-agente com auditoria médica e pedagógica</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tema</label>
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex: Critérios de Light para derrame pleural"
            />
            {formErrors.tema && <p className="text-xs text-destructive">{formErrors.tema}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Termos (um por linha, 3–7)</label>
            <Textarea
              value={termosText}
              onChange={(e) => setTermosText(e.target.value)}
              placeholder={"Proteína > 3g/dL\nLDH > 200 UI/L\nRelação proteína líquido/sérica > 0,5"}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">{termos.length} termo(s)</p>
            {formErrors.termos && <p className="text-xs text-destructive">{formErrors.termos}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Estilo</label>
              <Select value={estilo} onValueChange={setEstilo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTILOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {formErrors.estilo && <p className="text-xs text-destructive">{formErrors.estilo}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Público-alvo</label>
              <Select value={publico} onValueChange={setPublico}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PUBLICOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {formErrors.publico && <p className="text-xs text-destructive">{formErrors.publico}</p>}
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {isLoading ? "Gerando mnemônico..." : "Gerar mnemônico"}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (() => {
        const alertas = safeArray(result.alertas);
        const itemsMap = safeArray(result.items_map);
        const agentLogs = safeArray(result.agent_logs);

        return (
        <div className="space-y-4">
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

          {/* Sigla */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" /> Sigla
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-widest text-primary">{result.sigla}</p>
            </CardContent>
          </Card>

          {/* Frase — destaque visual */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> Frase mnemônica
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCopyPhrase} className="h-8 px-2">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar frase
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold leading-relaxed">{result.frase_mnemonica}</p>
            </CardContent>
          </Card>

          {/* Explicações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Explicação técnica</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{result.explicacao_tecnica}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Explicação didática</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{result.explicacao_didatica}</p></CardContent>
            </Card>
          </div>

          {/* Cena visual + Imagem */}
          {(result.cena_visual || result.image_url) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" /> Cena visual
                  </span>
                  <Badge variant={result.image_url ? "default" : "secondary"} className="text-xs">
                    {result.image_url ? "Imagem gerada" : "Imagem indisponível"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.image_url ? (
                  <img
                    src={result.image_url}
                    alt={`Mnemônico visual: ${result.sigla}`}
                    className="rounded-lg max-h-96 w-full object-contain mx-auto border"
                    loading="lazy"
                  />
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    A imagem não ficou disponível nesta geração. Use a cena visual como fallback de estudo.
                  </div>
                )}
                {result.cena_visual && (
                  <p className="text-sm text-muted-foreground">{result.cena_visual}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alertas */}
          {alertas.length > 0 && (
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" /> Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {alertas.map((a, i) => <li key={i} className="text-muted-foreground">• {a}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Associações */}
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

          {/* Agent logs */}
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
                      <Badge variant={log.status === "ok" || log.status === "approved" ? "default" : "destructive"} className="text-xs">
                        {log.agent}
                      </Badge>
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
            <Button variant="outline" size="sm" onClick={handleFavorite} disabled={favoriteMutation.isPending}>
              <Heart className="h-4 w-4 mr-1" /> Favoritar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-1" /> Feedback
            </Button>
          </div>

          {/* Regeneration options */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center mr-1">Regenerar:</span>
            {REGENERATE_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant="outline"
                size="sm"
                onClick={() => handleRegenerate(opt.value)}
                disabled={isLoading}
                title={opt.description}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> {opt.label}
              </Button>
            ))}
          </div>

          <MnemonicFeedbackModal
            open={feedbackOpen}
            onOpenChange={setFeedbackOpen}
            resultId={result.result_id}
            requestId={result.request_id}
          />
        </div>
        );
      })()}
    </div>
  );
}
