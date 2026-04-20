import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * CTA do Radar de Trajetória IA no Dashboard.
 * Renderizado apenas se a flag radar_trajetoria_enabled estiver ativa
 * (controle feito no consumidor — Dashboard.tsx).
 */
export default function RadarTrajetoriaCard() {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-primary/15 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Radar de Trajetória IA</span>
              <Badge variant="outline" className="text-[10px]">Beta</Badge>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              Projete cenários de evolução para 14, 28 e 56 dias com base nos seus dados reais.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => navigate("/dashboard/radar-trajetoria")}>
          Abrir
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
