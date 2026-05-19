import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Brain, ThumbsUp, ThumbsDown, RefreshCw, Plus } from "lucide-react";
import type { CockpitMnemonic } from "@/hooks/useCockpitData";

interface Props {
  useful: CockpitMnemonic[];
  bad: CockpitMnemonic[];
}

export default function CockpitMnemonics({ useful, bad }: Props) {
  const navigate = useNavigate();
  const isEmpty = !useful?.length && !bad?.length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">🧠 O que mais está te ajudando a memorizar</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/mnemonico")} className="gap-1">
          <Plus className="h-3 w-3" /> Criar mnemônico
        </Button>
      </div>

      {isEmpty ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Avalie seus mnemônicos com 👍 / 👎 para o sistema entender o que mais te ajuda a memorizar.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-success">
              <ThumbsUp className="h-3.5 w-3.5" /> Mais úteis
            </h3>
            {useful.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <div className="space-y-2">
                {useful.map((m) => (
                  <div key={m.result_id} className="rounded-md border border-success/20 bg-success/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium truncate flex-1">{m.tema}</p>
                      <Badge className="bg-success/20 text-success border-success/30">
                        {Number(m.avg_utility).toFixed(1)}/5
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs mt-1 px-2"
                      onClick={() => navigate(`/dashboard/mnemonico?result=${m.result_id}`)}
                    >
                      Revisar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-destructive">
              <ThumbsDown className="h-3.5 w-3.5" /> Precisam ser regenerados
            </h3>
            {bad.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum mnemônico ruim detectado 🎉</p>
            ) : (
              <div className="space-y-2">
                {bad.map((m) => (
                  <div key={m.result_id} className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium truncate flex-1">{m.tema}</p>
                      <Badge variant="destructive">
                        {Number(m.avg_utility).toFixed(1)}/5
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs mt-1 gap-1"
                      onClick={() =>
                        navigate(`/dashboard/mnemonico?regenerate=${m.result_id}&tema=${encodeURIComponent(m.tema)}`)
                      }
                    >
                      <RefreshCw className="h-3 w-3" /> Gerar nova versão
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
