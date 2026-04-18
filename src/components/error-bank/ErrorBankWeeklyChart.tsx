import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  data: { week: string; erros: number }[];
}

const ErrorBankWeeklyChart = ({ data }: Props) => (
  <ResponsiveContainer width="100%" height={160}>
    <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
      <Tooltip
        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
        formatter={(value: number) => [`${value} erros`, "Novos erros"]}
      />
      <Line type="monotone" dataKey="erros" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
    </LineChart>
  </ResponsiveContainer>
);

export default ErrorBankWeeklyChart;
