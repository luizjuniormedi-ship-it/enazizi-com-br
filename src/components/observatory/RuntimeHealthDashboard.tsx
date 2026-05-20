import React from "react";
import { useRuntimeHealth } from "@/hooks/useObservatoryData";
import { Card } from "@/components/ui/card";
import { 
  Activity, 
  Server, 
  CloudLightning, 
  AlertCircle,
  Clock,
  Zap,
  ShieldCheck,
  Cpu
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function RuntimeHealthDashboard() {
  const { data: health, isLoading } = useRuntimeHealth();

  if (isLoading) return <div className="h-64 flex items-center justify-center">Monitorando health...</div>;

  const chartData = health?.edgeLogs?.slice(0, 20).reverse().map(log => ({
    name: new Date(log.created_at).toLocaleTimeString(),
    latency: log.latency_ms,
    status: log.status_code
  }));

  const stats = [
    { label: "Edge Latency", value: `${Math.round(health?.avgLatency || 0)}ms`, icon: Clock, color: "text-blue-500" },
    { label: "Failure Rate", value: `${Math.round(health?.errorRate || 0)}%`, icon: AlertCircle, color: health?.errorRate > 10 ? "text-destructive" : "text-success" },
    { label: "Total Runtime Calls", value: health?.totalCalls || 0, icon: Server, color: "text-primary" },
    { label: "Active Incidents", value: health?.incidents?.length || 0, icon: ShieldCheck, color: health?.incidents?.length > 0 ? "text-warning" : "text-success" }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-4 bg-card/50">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-background/50 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">{stat.label}</p>
                <p className="text-xl font-bold tracking-tight">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card/50 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CloudLightning className="h-4 w-4 text-primary" />
              Edge Execution Latency (ms)
            </h4>
            <Badge className="bg-primary/10 text-primary">Live</Badge>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="latency" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-card/50">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-6">
            <ShieldCheck className="h-4 w-4 text-success" />
            Recent Incidents
          </h4>
          <div className="space-y-3">
            {health?.incidents?.slice(0, 4).map((incident, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded bg-background/50 border border-white/5">
                <div className={`mt-1 h-2 w-2 rounded-full ${
                  incident.severity === 'critical' ? 'bg-destructive' : 'bg-warning'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate">{incident.incident_type}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{incident.message}</p>
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">
                  {new Date(incident.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {health?.incidents?.length === 0 && (
              <div className="h-20 flex items-center justify-center text-[10px] text-muted-foreground">
                No incidents detected. System stable.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Badge({ children, className }: any) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${className}`}>
      {children}
    </span>
  );
}