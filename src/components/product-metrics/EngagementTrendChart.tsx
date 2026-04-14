import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { DailyEngagementRow } from "@/hooks/useProductMetrics";

interface Props {
  data: DailyEngagementRow[];
}

const chartConfig = {
  loops_started: { label: "Loops iniciados", color: "hsl(var(--primary))" },
  loops_completed: { label: "Concluídos", color: "hsl(142 71% 45%)" },
  questions_answered: { label: "Questões", color: "hsl(38 92% 50%)" },
};

export function EngagementTrendChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    date: d.metric_date.slice(5), // MM-DD
  }));

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Tendência Diária</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="loops_started"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.15)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="loops_completed"
              stroke="hsl(142 71% 45%)"
              fill="hsl(142 71% 45% / 0.1)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="questions_answered"
              stroke="hsl(38 92% 50%)"
              fill="hsl(38 92% 50% / 0.08)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
