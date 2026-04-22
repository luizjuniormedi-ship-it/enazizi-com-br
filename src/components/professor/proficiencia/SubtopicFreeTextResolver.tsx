import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Wand2, CheckCircle2, AlertTriangle, XCircle, Plus } from "lucide-react";
import {
  useSubtopicMatcher,
  parseSubtopicsFile,
  type ResolvedRow,
  type RawInputRow,
} from "@/hooks/useSubtopicMatcher";
import { useToast } from "@/hooks/use-toast";

interface Props {
  selectedIds: Set<string>;
  onAddIds: (ids: string[]) => void;
}

/**
 * Modo "Digitar" + "Upload" para subtemas.
 * Cada linha é resolvida (fuzzy match) contra `curriculum_subtopics`.
 * O professor revisa as sugestões e confirma; só os IDs reais entram no plano
 * (preserva FK obrigatória de `professor_plan_subtopics.subtopic_id`).
 */
const SubtopicFreeTextResolver = ({ selectedIds, onAddIds }: Props) => {
  const { toast } = useToast();
  const { resolve, hasCurriculum } = useSubtopicMatcher();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [resolved, setResolved] = useState<ResolvedRow[]>([]);
  // overrides[idx] = subtopic_id escolhido manualmente (substitui o "best")
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});

  const hasResults = resolved.length > 0;

  const buildRows = (text: string): RawInputRow[] => {
    if (!text.trim()) return [];
    return parseSubtopicsFile(text);
  };

  const handleResolve = () => {
    const rows = buildRows(rawText);
    if (rows.length === 0) {
      toast({
        title: "Nada para resolver",
        description: "Digite ou cole pelo menos um subtema.",
      });
      return;
    }
    const out = resolve(rows);
    setResolved(out);
    setOverrides({});
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Limite de 200KB. Reduza a lista.",
        variant: "destructive",
      });
      return;
    }
    const text = await file.text();
    setRawText(text);
    const rows = buildRows(text);
    const out = resolve(rows);
    setResolved(out);
    setOverrides({});
    toast({
      title: "Arquivo carregado",
      description: `${rows.length} linha(s) lidas. Revise as sugestões abaixo.`,
    });
  };

  const acceptable = useMemo(() => {
    return resolved.filter((r, i) => {
      const id = overrides[i] ?? r.best?.candidate.id;
      return id && !selectedIds.has(id);
    });
  }, [resolved, overrides, selectedIds]);

  const handleAddAll = () => {
    const ids = new Set<string>();
    resolved.forEach((r, i) => {
      const id = overrides[i] ?? r.best?.candidate.id;
      if (id && !selectedIds.has(id)) ids.add(id);
    });
    if (ids.size === 0) {
      toast({ title: "Nada para adicionar", description: "Resolva e revise antes." });
      return;
    }
    onAddIds(Array.from(ids));
    toast({
      title: "Subtemas adicionados",
      description: `${ids.size} novo(s) subtema(s) entram no plano.`,
    });
  };

  const handleAddSingle = (idx: number) => {
    const r = resolved[idx];
    const id = overrides[idx] ?? r.best?.candidate.id;
    if (!id || selectedIds.has(id)) return;
    onAddIds([id]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs">
          Cole/digite os subtemas (1 por linha) ou faça upload de TXT/CSV
        </Label>
        <Textarea
          rows={5}
          placeholder={"Ex.:\nIAM com supra\nInsuficiência cardíaca crônica\nFibrilação atrial"}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleResolve}
            disabled={!hasCurriculum || !rawText.trim()}
          >
            <Wand2 className="h-4 w-4 mr-1" />
            Buscar similares
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={!hasCurriculum}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload TXT/CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            Aceita 1 por linha ou CSV com colunas{" "}
            <code className="px-1 bg-muted rounded">especialidade,tema,subtema</code>
          </span>
        </div>
      </div>

      {hasResults && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              Sugestões ({resolved.length} linha{resolved.length === 1 ? "" : "s"})
            </Label>
            <Button
              type="button"
              size="sm"
              onClick={handleAddAll}
              disabled={acceptable.length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar {acceptable.length > 0 ? acceptable.length : "todos"}
            </Button>
          </div>
          <ScrollArea className="h-64 rounded-lg border border-border">
            <div className="divide-y divide-border">
              {resolved.map((row, idx) => {
                const chosenId = overrides[idx] ?? row.best?.candidate.id ?? "";
                const inPlan = chosenId && selectedIds.has(chosenId);
                const allCandidates = [
                  ...(row.best ? [row.best] : []),
                  ...row.alternatives,
                ];
                return (
                  <div key={idx} className="px-3 py-2 text-sm space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{row.raw}</div>
                        {(row.hint?.specialty || row.hint?.topic) && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            dica: {row.hint?.specialty}
                            {row.hint?.topic ? ` › ${row.hint.topic}` : ""}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    {row.status === "none" ? (
                      <p className="text-xs text-destructive">
                        Nenhum subtema parecido encontrado no currículo.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={chosenId}
                          onValueChange={(v) =>
                            setOverrides({ ...overrides, [idx]: v })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[240px]">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {allCandidates.map((c) => (
                              <SelectItem key={c.candidate.id} value={c.candidate.id}>
                                {c.candidate.specialtyNome} › {c.candidate.topicNome} ›{" "}
                                {c.candidate.nome}
                                {"  "}
                                <span className="text-muted-foreground">
                                  ({Math.round(c.score * 100)}%)
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant={inPlan ? "ghost" : "secondary"}
                          disabled={!chosenId || inPlan}
                          onClick={() => handleAddSingle(idx)}
                        >
                          {inPlan ? "no plano" : "adicionar"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: ResolvedRow["status"] }) => {
  if (status === "high")
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" />
        ótima
      </Badge>
    );
  if (status === "medium")
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3" />
        revisar
      </Badge>
    );
  if (status === "low")
    return (
      <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
        <AlertTriangle className="h-3 w-3" />
        baixa
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1 text-[10px]">
      <XCircle className="h-3 w-3" />
      sem match
    </Badge>
  );
};

export default SubtopicFreeTextResolver;
