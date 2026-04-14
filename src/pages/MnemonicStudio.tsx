import { useState, useCallback } from "react";
import {
  Brain, Sparkles, AlertTriangle, CheckCircle2, Loader2,
  Eye, ShieldCheck, GraduationCap, Image, FileText, Lightbulb, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { generateMnemonicStudio } from "@/lib/mnemonicStudioService";
import type {
  MnemonicStudioData,
  MnemonicStudioStatus,
} from "@/lib/mnemonicStudioTypes";
import { ESTILOS, PUBLICOS } from "@/lib/mnemonicStudioTypes";

// ══════════════════════════════════════════════════
// SCORE BADGE
// ══════════════════════════════════════════════════

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color =
    score >= 90 ? "text-green-400" :
    score >= 70 ? "text-yellow-400" :
    "text-red-400";
  const bg =
    score >= 90 ? "bg-green-500/10 border-green-500/20" :
    score >= 70 ? "bg-yellow-500/10 border-yellow-500/20" :
    "bg-red-500/10 border-red-500/20";

  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${bg}`}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <Progress value={score} className="h-1.5 w-16" />
    </div>
  );
}

// ══════════════════════════════════════════════════
// ITEMS MAP CARD
// ══════════════════════════════════════════════════

function ItemsMapCard({ items_map }: { items_map: MnemonicStudioData["items_map"] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Mapeamento Letra → Termo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items_map.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-2 rounded-md bg-muted/30">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                {item.letter}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.word}</p>
                <p className="text-xs text-muted-foreground">{item.original_item}</p>
                {item.symbol && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    🎨 {item.symbol}{item.symbol_reason ? ` — ${item.symbol_reason}` : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════
// RESULT DISPLAY
// ══════════════════════════════════════════════════

function ResultDisplay({ data }: { data: MnemonicStudioData }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Scores */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <ScoreBadge label="Médico" score={data.score_medico} />
            <ScoreBadge label="Pedagógico" score={data.score_pedagogico} />
            <ScoreBadge label="Final" score={data.score_final} />
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {data.alertas.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {data.alertas.map((alerta, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-yellow-200/80">{alerta}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sigla + Frase */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {data.sigla}
          </CardTitle>
          <CardDescription className="text-base text-foreground/80 font-medium">
            {data.frase_mnemonica}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Items Map */}
      {data.items_map.length > 0 && <ItemsMapCard items_map={data.items_map} />}

      {/* Image */}
      {data.image_url && (
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              Cena Visual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={data.image_url}
              alt={`Mnemônico visual: ${data.sigla}`}
              className="w-full rounded-lg border border-border/30"
            />
          </CardContent>
        </Card>
      )}

      {/* Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              Explicação Técnica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {data.explicacao_tecnica}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-green-400" />
              Explicação Didática
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {data.explicacao_didatica}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Scene */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-400" />
            Cena Visual (Descrição)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.cena_visual}
          </p>
        </CardContent>
      </Card>

      {/* Image Prompt */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Prompt de Imagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md block whitespace-pre-wrap">
            {data.prompt_imagem}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════

const MnemonicStudio = () => {
  const [tema, setTema] = useState("");
  const [termosText, setTermosText] = useState("");
  const [estilo, setEstilo] = useState("acronimo");
  const [publico, setPublico] = useState("residencia");
  const [status, setStatus] = useState<MnemonicStudioStatus>("idle");
  const [result, setResult] = useState<MnemonicStudioData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const termos = termosText
    .split("\n")
    .map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").trim())
    .filter(Boolean);

  const handleGenerate = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setResult(null);

    const response = await generateMnemonicStudio({
      tema: tema.trim(),
      termos,
      estilo,
      publico,
    });

    if (response.success && response.data) {
      setResult(response.data);
      setStatus("success");
      toast.success("Mnemônico gerado com sucesso!");
    } else {
      setError(response.error || "Erro desconhecido.");
      setStatus("error");
      toast.error(response.error || "Falha ao gerar mnemônico.");
    }
  }, [tema, termos, estilo, publico]);

  const canSubmit = tema.trim().length >= 2 && termos.length >= 3 && termos.length <= 7;

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mnemonic Studio</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline multiagente: Gerador → Auditor Médico → Auditor Pedagógico → Visual → Consolidador
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Configurar Mnemônico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tema */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tema médico</label>
            <Input
              placeholder="Ex: Critérios de Jones para Febre Reumática"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              disabled={status === "loading"}
            />
          </div>

          {/* Termos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Termos (um por linha)</label>
              <Badge variant="outline" className="text-xs">
                {termos.length}/7
              </Badge>
            </div>
            <Textarea
              placeholder={"Cardite\nPoliartrite migratória\nCoreia de Sydenham\nEritema marginado\nNódulos subcutâneos"}
              value={termosText}
              onChange={(e) => setTermosText(e.target.value)}
              rows={6}
              disabled={status === "loading"}
              className="font-mono text-sm"
            />
            {termos.length > 0 && termos.length < 3 && (
              <p className="text-xs text-destructive">Mínimo de 3 termos.</p>
            )}
            {termos.length > 7 && (
              <p className="text-xs text-destructive">Máximo de 7 termos.</p>
            )}
          </div>

          {/* Estilo + Público */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Estilo do mnemônico</label>
              <Select value={estilo} onValueChange={setEstilo} disabled={status === "loading"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTILOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Público-alvo</label>
              <Select value={publico} onValueChange={setPublico} disabled={status === "loading"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLICOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Submit */}
          <Button
            onClick={handleGenerate}
            disabled={!canSubmit || status === "loading"}
            className="w-full h-12 text-base"
            size="lg"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Gerando (pipeline multiagente)...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Gerar Mnemônico
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Loading */}
      {status === "loading" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <div className="text-center space-y-1">
                <p className="font-medium">Pipeline multiagente em execução...</p>
                <p className="text-sm text-muted-foreground">
                  Gerador → Auditor Médico → Auditor Pedagógico → Visual → Consolidação
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {status === "error" && error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Falha na geração</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleGenerate}
                  disabled={!canSubmit}
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {status === "success" && result && (
        <>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium text-sm">
              Mnemônico consolidado com sucesso
            </span>
          </div>
          <ResultDisplay data={result} />
        </>
      )}
    </div>
  );
};

export default MnemonicStudio;
