import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { MetricsFiltersBar } from "@/components/product-metrics/MetricsFiltersBar";
import { MetricsKpiCards } from "@/components/product-metrics/MetricsKpiCards";
import { LoopFunnelSection } from "@/components/product-metrics/LoopFunnelSection";
import { EngagementTrendChart } from "@/components/product-metrics/EngagementTrendChart";
import { RetentionTable } from "@/components/product-metrics/RetentionTable";
import {
  useLoopFunnelMetrics,
  useDailyEngagementTrend,
  useUserRetention,
} from "@/hooks/useProductMetrics";

export default function ProductMetricsPage() {
  const { isEnabled } = useFeatureFlags();
  const [days, setDays] = useState(30);
  const qc = useQueryClient();

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const funnel = useLoopFunnelMetrics(startDate, endDate);
  const trend = useDailyEngagementTrend(days);
  const retention = useUserRetention(days);

  const isLoading = funnel.isLoading || trend.isLoading || retention.isLoading;
  const hasError = funnel.isError || trend.isError || retention.isError;

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["loop-funnel"] });
    qc.invalidateQueries({ queryKey: ["engagement-trend"] });
    qc.invalidateQueries({ queryKey: ["user-retention"] });
  }, [qc]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Métricas do Produto</h1>
        </div>
        <MetricsFiltersBar
          days={days}
          onDaysChange={setDays}
          onRefresh={refresh}
          isRefreshing={funnel.isFetching}
        />
      </div>

      {/* Error */}
      {hasError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Erro ao carregar métricas. Verifique a conexão.</span>
          <Button variant="outline" size="sm" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* KPI cards */}
      {isLoading && !funnel.data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : funnel.data ? (
        <MetricsKpiCards data={funnel.data} />
      ) : null}

      {/* Funnel + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {isLoading && !funnel.data ? (
          <>
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          </>
        ) : (
          <>
            {funnel.data && <LoopFunnelSection data={funnel.data} />}
            {trend.data && <EngagementTrendChart data={trend.data} />}
          </>
        )}
      </div>

      {/* Retention */}
      {isLoading && !retention.data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : retention.data ? (
        <RetentionTable data={retention.data} />
      ) : null}
    </div>
  );
}
