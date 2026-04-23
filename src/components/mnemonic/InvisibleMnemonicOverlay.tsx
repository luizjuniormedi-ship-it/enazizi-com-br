/**
 * Non-invasive overlay that shows an invisible mnemonic as a gentle reinforcement.
 * Appears as a collapsible card — does NOT block the user's workflow.
 */
import { useEffect, useState } from "react";
import { Brain, ChevronDown, ChevronUp, X, Lightbulb, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type ServableMnemonic } from "@/lib/mnemonicInvisibleService";

interface Props {
  mnemonic: ServableMnemonic;
  onDismiss: () => void;
  onShown: () => void;
}

const REASON_LABEL: Record<string, string> = {
  post_error: "Reforço rápido",
  pre_session: "Preparação",
  spaced_review: "Revisão espaçada",
};

export const InvisibleMnemonicOverlay = ({ mnemonic, onDismiss, onShown }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    onShown();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed left-4 right-4 z-40 max-w-md mx-auto animate-fade-in bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-4">
      <Card className="border-primary/30 bg-background/95 backdrop-blur-md shadow-lg">
        <CardContent className="p-3 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">
                Vamos revisar isso rapidamente
              </span>
              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-secondary">
                {REASON_LABEL[mnemonic.reason] || mnemonic.reason}
              </span>
            </div>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mnemonic word */}
          <div className="text-center py-1">
            <p className="text-lg font-bold text-primary tracking-wider">
              {mnemonic.mnemonic}
            </p>
            <p className="text-xs text-muted-foreground italic">
              "{mnemonic.phrase}"
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {mnemonic.topic}
            </p>
          </div>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1 text-xs h-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Ocultar detalhes
              </>
            ) : (
              <>
                <Lightbulb className="h-3 w-3" /> Ver mapeamento
              </>
            )}
          </Button>

          {expanded && (
            <div className="space-y-2 animate-fade-in">
              {/* Items map */}
              <div className="space-y-1">
                {mnemonic.itemsMap.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-secondary/50 text-xs">
                    <span className="font-bold text-primary w-5 text-center shrink-0">
                      {item.letter}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.original_item}</span>
                      <span className="text-muted-foreground"> → {item.word}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image */}
              {mnemonic.imageUrl && (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={mnemonic.imageUrl}
                    alt={`Mnemônico: ${mnemonic.topic}`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Self-test */}
              {mnemonic.reviewQuestion && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1 text-xs h-7"
                    onClick={() => setShowReview(!showReview)}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {showReview ? "Ocultar teste" : "Auto-teste rápido"}
                  </Button>
                  {showReview && (
                    <div className="p-2 rounded bg-secondary/50 text-xs">
                      <p className="font-medium">❓ {mnemonic.reviewQuestion}</p>
                      <p className="text-muted-foreground mt-1">Tente lembrar antes de conferir!</p>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Score: {mnemonic.qualityScore}/100</span>
                <span>Exibições: {mnemonic.timesShown}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
