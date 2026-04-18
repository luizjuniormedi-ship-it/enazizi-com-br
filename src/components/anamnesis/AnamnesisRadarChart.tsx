import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

interface Props {
  data: { category: string; score: number }[];
}

const AnamnesisRadarChart = ({ data }: Props) => (
  <ResponsiveContainer width="100%" height={280}>
    <RadarChart data={data} outerRadius="70%">
      <PolarGrid className="stroke-border" />
      <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
      <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9 }} className="fill-muted-foreground" />
      <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
    </RadarChart>
  </ResponsiveContainer>
);

export default AnamnesisRadarChart;
