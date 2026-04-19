import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import type { NextStepsBlock as NextStepsBlockType, TutorAction } from "@/types/tutor";

interface Props {
  block: NextStepsBlockType;
  /** Callback opcional — Sprint 6 conectará handoffs reais. */
  onActionClick?: (action: TutorAction) => void;
}

export function NextStepsBlock({ block, onActionClick }: Props) {
  const { actions } = block.payload;
  if (!actions || actions.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Próximos Passos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => onActionClick?.(action)}
          >
            {action.label}
            <ArrowRight className="h-3 w-3" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
