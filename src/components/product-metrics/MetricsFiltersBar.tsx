import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface MetricsFiltersBarProps {
  days: number;
  onDaysChange: (d: number) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const periods = [
  { label: "7 dias", value: 7 },
  { label: "14 dias", value: 14 },
  { label: "30 dias", value: 30 },
];

export function MetricsFiltersBar({ days, onDaysChange, onRefresh, isRefreshing }: MetricsFiltersBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => onDaysChange(p.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              days === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isRefreshing}>
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
