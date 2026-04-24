import { Sparkles, RefreshCw, Globe, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  reuseCount?: number;
  qualityScore?: number;
  scope?: "global" | "user";
  onRegenerate?: () => void;
  className?: string;
}

/**
 * Badge discreto exibido quando a resposta do Tutor IA foi
 * recuperada da memória pedagógica em vez de gerada por IA.
 *
 * Ex.: "Memória pedagógica · global · qualidade 86 · reutilizada 12×"
 *
 * Inclui ação opcional para forçar regeneração via IA.
 */
export function MemoryReuseBadge({
  reuseCount,
  qualityScore,
  scope,
  onRegenerate,
  className,
}: Props) {
  const isUser = scope === "user";
  const ScopeIcon = isUser ? User : Globe;
  const scopeLabel = isUser ? "Memória pessoal" : "Memória pedagógica";
  const scopeTone = isUser ? "global" : "global"; // mantemos visual unificado

  const meta: string[] = [];
  if (!isUser && scope === "global") meta.push("global");
  if (typeof qualityScore === "number") meta.push(`qualidade ${Math.round(qualityScore)}`);
  if (typeof reuseCount === "number" && reuseCount > 0) meta.push(`reutilizada ${reuseCount}×`);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground ${className ?? ""}`}
      data-scope={scopeTone}
    >
      <Badge
        variant="secondary"
        className="gap-1 bg-primary/10 text-primary hover:bg-primary/15"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        {scopeLabel}
      </Badge>
      <span className="flex items-center gap-1 text-[11px]">
        <ScopeIcon className="h-3 w-3" aria-hidden />
        {meta.length > 0 ? meta.join(" · ") : "Resposta recuperada da base"}
      </span>
      {onRegenerate && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-6 gap-1 px-2 text-[11px]"
          onClick={onRegenerate}
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Atualizar com IA
        </Button>
      )}
    </div>
  );
}
