import { useAdaptiveAudit, AuditResult } from "@/hooks/useAdaptiveAudit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdaptiveAuditTab() {
  const { data: audit, isLoading, isError } = useAdaptiveAudit();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Executando auditoria forense do ecossistema...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-destructive">
        <XCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>Falha ao executar auditoria técnica.</p>
      </div>
    );
  }

  const getStatusIcon = (status: AuditResult["status"]) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "warning": return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "error": return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {audit?.map((item, i) => (
        <Card key={i} className="bg-muted/30 border-white/5 overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {item.category}
            </CardTitle>
            {getStatusIcon(item.status)}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <p className="text-sm font-medium leading-relaxed">
              {item.message}
            </p>
            {item.details && (
              <div className="text-[10px] font-mono bg-black/20 p-2 rounded-md overflow-x-auto whitespace-pre">
                {JSON.stringify(item.details, null, 2)}
              </div>
            )}
            <div className="flex justify-end">
              <Badge variant={item.status === "success" ? "secondary" : "outline"} className={cn(
                "text-[9px] uppercase font-bold",
                item.status === "success" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                item.status === "warning" && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                item.status === "error" && "bg-destructive/10 text-destructive border-destructive/20"
              )}>
                {item.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Card className="col-span-full bg-primary/5 border-primary/10">
        <CardHeader>
          <CardTitle className="text-sm">Próximos Passos de Evolução</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1" />
              <span><strong>Cognitive State Engine:</strong> Detecção de fadiga e ansiedade via tempo de resposta.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1" />
              <span><strong>Tutor Adaptativo:</strong> Ajuste automático de profundidade com base na maestria FSRS.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1" />
              <span><strong>Prevenção de Race Conditions:</strong> Implementação de locks pessimistas em atualizações de FSRS.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1" />
              <span><strong>Otimização de Custos:</strong> Roteamento dinâmico para modelos Lite em revisões simples.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
