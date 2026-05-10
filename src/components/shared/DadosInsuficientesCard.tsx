import { Database } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  title: string;
  hint?: string;
}

/**
 * Fallback honesto — usar quando uma métrica/widget não tem dado real.
 * NUNCA mostrar 0 falso, gráfico vazio ou score inventado.
 */
export default function DadosInsuficientesCard({ title, hint }: Props) {
  return (
    <Card className="p-5 flex flex-col items-center justify-center text-center gap-2 border-dashed">
      <Database className="h-6 w-6 text-muted-foreground" />
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-xs">
        {hint ?? "Sem dado suficiente ainda. Continue praticando — esta métrica aparece automaticamente quando houver base."}
      </p>
    </Card>
  );
}
