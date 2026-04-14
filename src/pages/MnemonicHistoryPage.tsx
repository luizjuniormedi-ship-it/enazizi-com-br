import { useState } from "react";
import { History, Search, Heart, Copy, RefreshCw, Star, Eye, Loader2, Brain, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMnemonicHistory } from "@/hooks/useMnemonicHistory";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import { MnemonicFeedbackModal } from "@/components/mnemonics/MnemonicFeedbackModal";
import { getScoreColor, getScoreBg, formatScore } from "@/utils/mnemonicStatus";
import type { MnemonicHistoryItem } from "@/types/mnemonics";

function HistoryCard({ item, onFavorite, onView, onCopy }: {
  item: MnemonicHistoryItem;
  onFavorite: () => void;
  onView: () => void;
  onCopy: () => void;
}) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{item.tema}</p>
            <p className="text-2xl font-bold tracking-widest text-primary">{item.sigla}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.frase_mnemonica}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={item.aprovado ? "default" : "destructive"} className="text-xs">
              {item.aprovado ? "Aprovado" : "Reprovado"}
            </Badge>
            {item.is_favorite && <Heart className="h-4 w-4 fill-red-500 text-red-500" />}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className={`flex-1 text-center p-1.5 rounded text-xs ${getScoreBg(item.score_medico)}`}>
            <span className={`font-bold ${getScoreColor(item.score_medico)}`}>{item.score_medico}</span>
            <span className="text-muted-foreground ml-1">Médico</span>
          </div>
          <div className={`flex-1 text-center p-1.5 rounded text-xs ${getScoreBg(item.score_pedagogico)}`}>
            <span className={`font-bold ${getScoreColor(item.score_pedagogico)}`}>{item.score_pedagogico}</span>
            <span className="text-muted-foreground ml-1">Pedagógico</span>
          </div>
          {item.score_linguistico != null && (
            <div className={`flex-1 text-center p-1.5 rounded text-xs ${getScoreBg(item.score_linguistico)}`}>
              <span className={`font-bold ${getScoreColor(item.score_linguistico)}`}>{item.score_linguistico}</span>
              <span className="text-muted-foreground ml-1">Ling.</span>
            </div>
          )}
          <div className={`flex-1 text-center p-1.5 rounded text-xs ${getScoreBg(item.score_final)}`}>
            <span className={`font-bold ${getScoreColor(item.score_final)}`}>{item.score_final}</span>
            <span className="text-muted-foreground ml-1">Final</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString("pt-BR")} · v{item.versao}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}><Eye className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFavorite}>
              <Heart className={`h-3.5 w-3.5 ${item.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MnemonicHistoryPage() {
  const [temaFilter, setTemaFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<MnemonicHistoryItem | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackResultId, setFeedbackResultId] = useState("");

  const { data, isLoading } = useMnemonicHistory({
    tema: temaFilter || undefined,
    favoritesOnly,
    page,
    pageSize: 12,
  });

  const favoriteMutation = useToggleFavorite();

  const handleCopy = (item: MnemonicHistoryItem) => {
    navigator.clipboard.writeText(`${item.sigla}\n${item.frase_mnemonica}`);
    toast.success("Copiado!");
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Histórico de Mnemônicos</h1>
          <p className="text-muted-foreground text-sm">Seus mnemônicos gerados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={temaFilter}
            onChange={(e) => { setTemaFilter(e.target.value); setPage(1); }}
            placeholder="Filtrar por tema..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={favoritesOnly} onCheckedChange={(v) => { setFavoritesOnly(v); setPage(1); }} id="fav-toggle" />
          <Label htmlFor="fav-toggle" className="text-sm">Favoritos</Label>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Brain className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum mnemônico encontrado.</p>
          <p className="text-sm text-muted-foreground/70">Gere seu primeiro mnemônico para vê-lo aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onView={() => setSelectedItem(item)}
                onCopy={() => handleCopy(item)}
                onFavorite={() => favoriteMutation.mutate(item.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {data.totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedItem.tema}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-bold tracking-widest text-primary">{selectedItem.sigla}</p>
                  <p className="text-lg font-medium mt-2">{selectedItem.frase_mnemonica}</p>
                </div>
                {selectedItem.image_url && (
                  <img
                    src={selectedItem.image_url}
                    alt={`Mnemônico: ${selectedItem.sigla}`}
                    className="rounded-lg max-h-64 w-full object-contain border"
                  />
                )}
                {selectedItem.explicacao_tecnica && (
                  <div><p className="text-sm font-medium">Explicação técnica</p><p className="text-sm text-muted-foreground">{selectedItem.explicacao_tecnica}</p></div>
                )}
                {selectedItem.explicacao_didatica && (
                  <div><p className="text-sm font-medium">Explicação didática</p><p className="text-sm text-muted-foreground">{selectedItem.explicacao_didatica}</p></div>
                )}
                {selectedItem.cena_visual && (
                  <div><p className="text-sm font-medium">Cena visual</p><p className="text-sm text-muted-foreground">{selectedItem.cena_visual}</p></div>
                )}
                {(selectedItem.alertas_json ?? []).length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Alertas</p>
                    <ul className="text-sm text-muted-foreground">
                      {(selectedItem.alertas_json ?? []).map((a, i) => <li key={i}>• {a}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(selectedItem)}><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
                  <Button variant="outline" size="sm" onClick={() => { setFeedbackResultId(selectedItem.id); setFeedbackOpen(true); }}>
                    <Star className="h-4 w-4 mr-1" /> Avaliar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MnemonicFeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        resultId={feedbackResultId}
      />
    </div>
  );
}
