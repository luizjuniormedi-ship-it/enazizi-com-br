import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useRadarSnapshotHistory } from "@/hooks/useRadarSnapshotHistory";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function RadarSnapshotHistory() {
  const { data, isLoading } = useRadarSnapshotHistory(5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico recente
          <Badge variant="outline" className="ml-auto text-xs">
            {data?.length ?? 0}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Sem snapshots anteriores. Gere uma nova análise para começar a comparar.
          </p>
        )}

        {!isLoading &&
          data &&
          data.map((item, idx) => {
            const previous = data[idx + 1];
            const delta = previous ? item.overallScore - previous.overallScore : 0;
            const Icon = delta > 0.5 ? ArrowUp : delta < -0.5 ? ArrowDown : Minus;
            const tone =
              delta > 0.5
                ? "text-primary"
                : delta < -0.5
                  ? "text-destructive"
                  : "text-muted-foreground";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    Score {Math.round(item.overallScore)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-xs ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {previous ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` : "—"}
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
