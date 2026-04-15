import { forwardRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

interface Props {
  data: { specialty: string; score: number }[];
}

const SpecialtyRadarChart = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  if (data.length < 3) {
    return (
      <div ref={ref} className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Radar de especialidades</h2>
        <p className="text-sm text-muted-foreground text-center py-8">Responda questões de pelo menos 3 especialidades.</p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    label: d.specialty.length > 12 ? d.specialty.slice(0, 11) + "…" : d.specialty,
  }));

  return (
    <div ref={ref} className="glass-card p-6">
      <h2 className="text-lg font-semibold mb-4">Radar de especialidades</h2>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData} outerRadius="75%">
          <PolarGrid className="stroke-border" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
          <Radar name="Acerto" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
});

SpecialtyRadarChart.displayName = "SpecialtyRadarChart";

export default SpecialtyRadarChart;
