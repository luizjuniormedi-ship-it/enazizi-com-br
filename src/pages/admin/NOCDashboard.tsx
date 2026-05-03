import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, ShieldAlert, Users, Zap, 
  AlertCircle, CheckCircle2, Globe, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from "recharts";
import { toast } from "sonner";

export default function NOCDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [activeIncidents, setActiveIncidents] = useState<any[]>([]);

  async function loadNOCData() {
    setLoading(true);
    try {
      const { data: nocView, error: viewError } = await supabase.from('noc_metrics').select('*').single();
      if (viewError) throw viewError;
      setMetrics(nocView);

      const { data: incidents, error: incError } = await supabase
        .from('admin_incidents')
        .select('*')
        .eq('status', 'open')
        .order('priority', { ascending: true })
        .limit(5);
      
      if (incError) throw incError;
      setActiveIncidents(incidents || []);

    } catch (error) {
      console.error("Error loading NOC data:", error);
      toast.error("Erro ao carregar dashboard NOC");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNOCData();
    const interval = setInterval(loadNOCData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-8 bg-black/95 text-white min-h-screen">
      <header className="flex justify-between items-center border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <Globe className="text-primary animate-pulse" /> NOC <span className="text-white/40">//</span> OPERATIONS
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
            Global Health Status • Real-time Monitoring • Enterprise Guard
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] text-emerald-500 font-bold uppercase">System Operational</span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] text-white/50 border-white/10">
            {new Date().toLocaleTimeString()}
          </Badge>
          <button onClick={loadNOCData} className="hover:rotate-180 transition-transform duration-500">
            <RefreshCw className="h-4 w-4 text-white/30" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile 
          label="Throughput (5m)" 
          value={metrics?.active_users || 0} 
          sub="Active Sessions" 
          icon={<Users className="text-blue-500" />}
          trend={+12}
        />
        <MetricTile 
          label="Avg Latency" 
          value={`${Math.round(metrics?.avg_latency || 0)}ms`} 
          sub="Global Response" 
          icon={<Zap className="text-yellow-500" />}
          trend={-5}
          warning={metrics?.avg_latency > 200}
        />
        <MetricTile 
          label="Abandono (1h)" 
          value={metrics?.hourly_abandonment || 0} 
          sub="Session Dropouts" 
          icon={<AlertCircle className="text-orange-500" />}
          trend={+2}
          warning={metrics?.hourly_abandonment > 5}
        />
        <MetricTile 
          label="P0 Incidents" 
          value={metrics?.critical_incidents || 0} 
          sub="Active Failures" 
          icon={<ShieldAlert className="text-red-500" />}
          trend={0}
          critical={metrics?.critical_incidents > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/5 border-white/10 text-white">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> TRAFFIC & LOAD SNAPSHOT
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { time: '12:00', load: 45, latency: 120 },
                { time: '12:05', load: 52, latency: 135 },
                { time: '12:10', load: 48, latency: 128 },
                { time: '12:15', load: 61, latency: 145 },
                { time: '12:20', load: 55, latency: 132 },
                { time: '12:25', load: 68, latency: 158 },
                { time: '12:30', load: 72, latency: 165 },
              ]}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#ffffff40" fontSize={10} />
                <YAxis stroke="#ffffff40" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="load" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorLoad)" />
                <Line type="monotone" dataKey="latency" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" /> ACTIVE INCIDENT TRIAGE
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {activeIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-xs font-mono uppercase tracking-widest">No active incidents</p>
                </div>
              ) : (
                activeIncidents.map((incident) => (
                  <div key={incident.id} className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={
                        incident.priority === 'P0' ? 'bg-red-500 text-white' : 
                        incident.priority === 'P1' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                      }>
                        {incident.priority}
                      </Badge>
                      <span className="text-[10px] font-mono text-white/30">{new Date(incident.created_at).toLocaleTimeString()}</span>
                    </div>
                    <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{incident.title}</h4>
                    <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{incident.description}</p>
                    <div className="flex gap-2 mt-3">
                      <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (incident.impact_score || 0) * 10)}%` }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-white/40 uppercase">Filas Críticas</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <QueueMetric label="Telemetry Buffer" current={145} max={1000} />
                <QueueMetric label="Email Queue" current={12} max={100} />
                <QueueMetric label="RCA Worker" current={0} max={10} />
             </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-white/40 uppercase">Saúde Cloud (Edge)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <CloudStatus label="auth-email-hook" status="healthy" />
                <CloudStatus label="tutor-ai-engine" status="healthy" />
                <CloudStatus label="process-telemetry" status="degraded" />
             </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-white/40 uppercase">Auto-Mitigation Active</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center justify-between text-[10px] font-mono p-2 rounded bg-primary/10 border border-primary/20 text-primary animate-pulse">
                <span>FALLBACK_AI_MODEL_ACTIVE</span>
                <span>SINCE 12:45</span>
             </div>
             <p className="text-[9px] text-white/30 mt-2 italic">Reason: Latency high in primary provider.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricTile({ label, value, sub, icon, trend, warning, critical }: any) {
  return (
    <div className={`p-4 rounded-xl border transition-all duration-500 ${
      critical ? 'bg-red-500/20 border-red-500/40 animate-pulse' : 
      warning ? 'bg-orange-500/10 border-orange-500/20' : 
      'bg-white/5 border-white/10'
    }`}>
      <div className="flex justify-between items-start">
        <div className="p-2 rounded-lg bg-white/5">{icon}</div>
        <div className={`flex items-center gap-1 text-[10px] font-mono ${trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-500' : 'text-white/30'}`}>
          {trend > 0 ? <ArrowUpRight size={12} /> : trend < 0 ? <ArrowDownRight size={12} /> : null}
          {trend !== 0 && `${Math.abs(trend)}%`}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-mono text-white/40 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-black mt-1 tracking-tighter">{value}</p>
        <p className="text-[10px] font-mono text-white/20 mt-1">{sub}</p>
      </div>
    </div>
  );
}

function QueueMetric({ label, current, max }: any) {
  const pct = (current / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-white/40 uppercase">{label}</span>
        <span>{current}/{max}</span>
      </div>
      <Progress value={pct} className="h-1 bg-white/5" />
    </div>
  );
}

function CloudStatus({ label, status }: any) {
  return (
    <div className="flex justify-between items-center text-[10px] font-mono">
      <span className="text-white/40">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`h-1.5 w-1.5 rounded-full ${status === 'healthy' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
        <span className={status === 'healthy' ? 'text-emerald-500' : 'text-orange-500'}>{status.toUpperCase()}</span>
      </div>
    </div>
  );
}
