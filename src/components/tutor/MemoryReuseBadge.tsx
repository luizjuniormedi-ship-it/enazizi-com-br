import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  reuseCount?: number;
  onRegenerate?: () => void;
  className?: string;
}

/**
 * Badge discreto exibido quando a resposta do Tutor IA foi
 * recuperada da memória pedagógica em vez de gerada por IA.
 *
 * Inclui ação opcional para forçar regeneração via IA.
 */
export function MemoryReuseBadge({ reuseCount, onRegenerate, className }: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <Badge
        variant="secondary"
        className="gap-1 bg-primary/10 text-primary hover:bg-primary/15"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        Memória pedagógica
      </Badge>
      <span className="text-[11px]">
        Resposta recuperada da base
        {typeof reuseCount === "number" && reuseCount > 0
          ? ` · reutilizada ${reuseCount}×`
          : ""}
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
