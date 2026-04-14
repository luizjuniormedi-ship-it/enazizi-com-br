import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  error: Error | null;
  onRetry: () => void;
}

export default function MissionControlError({ error, onRetry }: Props) {
  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-destructive/30">
        <CardContent className="p-6 text-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-3 w-fit mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar sua missão</h2>
          <p className="text-sm text-muted-foreground">
            {error?.message || "Ocorreu um erro ao buscar sua recomendação de estudo. Tente novamente."}
          </p>
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
