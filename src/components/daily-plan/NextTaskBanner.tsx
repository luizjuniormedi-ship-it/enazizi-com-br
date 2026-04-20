import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Compass } from "lucide-react";

interface Props {
  /** Título curto da próxima ação sugerida. */
  nextLabel: string;
  /** Tipo opcional para um ícone/contexto. */
  hint?: string;
  onContinue: () => void;
  onOpenRadar?: () => void;
  onDismiss?: () => void;
}

/**
 * Banner exibido logo após o usuário concluir uma task do Plano de Hoje.
 * Reduz fricção mostrando a próxima ação em 1 clique + atalho para o Radar.
 * Não cria nova lógica de planejamento: apenas reaproveita a próxima recomendação já em memória.
 */
export default function NextTaskBanner({
  nextLabel,
  hint,
  onContinue,
  onOpenRadar,
  onDismiss,
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-3 sm:p-4 animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Boa! Tarefa concluída.</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            Próxima: <span className="font-medium text-foreground">{nextLabel}</span>
            {hint && <> · {hint}</>}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={onContinue}>
              Continuar estudando
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            {onOpenRadar && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenRadar}>
                <Compass className="h-3.5 w-3.5" />
                Ver projeção
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
