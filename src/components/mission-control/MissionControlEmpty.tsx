import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface Props {
  onGenerate: () => void;
}

export default function MissionControlEmpty({ onGenerate }: Props) {
  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-border/50">
        <CardContent className="p-6 text-center space-y-4">
          <div className="rounded-full bg-primary/10 p-3 w-fit mx-auto">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Tudo tranquilo por aqui!</h2>
          <p className="text-sm text-muted-foreground">
            Não há missões pendentes no momento. Gere uma nova recomendação ou explore seus módulos.
          </p>
          <Button onClick={onGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Gerar missão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
