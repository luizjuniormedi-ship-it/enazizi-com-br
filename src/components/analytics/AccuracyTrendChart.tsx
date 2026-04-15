import { forwardRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface Props {
  data: { week: string; accuracy: number; total: number }[];
}

const AccuracyTrendChart = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  if (data.length < 2) {
    return (
      <div ref={ref} className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Evolução da taxa de acerto</h2>
        <p className="text-sm text-muted-foreground text-center py-8">Responda mais questões para ver a evolução semanal.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="glass-card p-6">
      <h2 className="text-lg font-semibold mb-4">Evolução da taxa de acerto</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" unit="%" />
          <ReferenceLine y={70} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
            formatter={(value: number, name: string) => [`${value}%`, "Taxa de acerto"]}
            labelFormatter={(label) => `Semana ${label}`}
          />
          <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

AccuracyTrendChart.displayName = "AccuracyTrendChart";

export default AccuracyTrendChart;
