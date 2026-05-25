import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Activity, 
  Zap, 
  Cpu, 
  Database, 
  Clock, 
  AlertTriangle,
  RefreshCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LoadMonitor = () => {
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    requestsPerSec: 0,
    realtimeEvents: 0,
    edgeLatency: 0,
    iaLatency: 0,
    retries: 0,
    memoryUsage: 0,
    errors: 0,
    circuitBreaker: "CLOSED"
  });

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    console.log("[LOAD_START] Initializing Load Monitor");
    
    const fetchMetrics = async () => {
      // Simulate real-time metric fetching for the dashboard
      // In a real scenario, this would poll an aggregation table or use Realtime
      const mockMetrics = {
        activeUsers: Math.floor(Math.random() * 50) + 10,
        requestsPerSec: (Math.random() * 15).toFixed(1),
        realtimeEvents: Math.floor(Math.random() * 100),
        edgeLatency: Math.floor(Math.random() * 200) + 50,
        iaLatency: Math.floor(Math.random() * 2000) + 800,
        retries: Math.floor(Math.random() * 5),
        memoryUsage: Math.floor(Math.random() * 40) + 20,
        errors: Math.floor(Math.random() * 2),
        circuitBreaker: Math.random() > 0.95 ? "OPEN" : "CLOSED"
      };

      setMetrics(prev => ({ ...prev, ...mockMetrics }));
      setHistory(prev => [...prev.slice(-20), mockMetrics]);
      
      console.log("[LOAD_MEMORY] Memory usage:", mockMetrics.memoryUsage, "MB");
    };

    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-[#050508] min-h-screen text-white">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Enterprise Load Monitor</h1>
          <p className="text-white/40 text-sm">ENAZIZI STRESS VALIDATION v17</p>
        </div>
        <Badge variant={metrics.circuitBreaker === "OPEN" ? "destructive" : "outline"} className="px-4 py-1">
          CIRCUIT BREAKER: {metrics.circuitBreaker}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Active Users" 
          value={metrics.activeUsers} 
          icon={<Users className="h-4 w-4" />} 
          trend="+5%"
        />
        <MetricCard 
          title="Requests/s" 
          value={metrics.requestsPerSec} 
          icon={<Activity className="h-4 w-4" />} 
          trend="Stable"
        />
        <MetricCard 
          title="Edge Latency" 
          value={`${metrics.edgeLatency}ms`} 
          icon={<Zap className="h-4 w-4" />} 
          status={metrics.edgeLatency > 300 ? "warn" : "ok"}
        />
        <MetricCard 
          title="IA Latency" 
          value={`${metrics.iaLatency}ms`} 
          icon={<Clock className="h-4 w-4" />} 
          status={metrics.iaLatency > 3000 ? "warn" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Resource Saturation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <SaturationBar label="Memory Usage" value={metrics.memoryUsage} max={100} unit="MB" />
            <SaturationBar label="Realtime Throughput" value={metrics.realtimeEvents} max={500} unit="evt/s" />
            <SaturationBar label="Database CPU" value={35} max={100} unit="%" />
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Incident Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <IncidentItem type="info" msg="[LOAD_START] Test session initialized" time="now" />
              <IncidentItem type="warn" msg="[LOAD_TIMEOUT] Edge function cold start delay" time="2m ago" />
              <IncidentItem type="error" msg="[LOAD_EDGE_FAIL] generate-mnemonic 503 retry" time="5m ago" />
              <IncidentItem type="ok" msg="[LOAD_RECOVERED] Circuit breaker reset" time="8m ago" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Real-time Stability Trace</CardTitle>
          <RefreshCcw className="h-4 w-4 text-white/20 animate-spin" />
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end gap-1">
            {history.map((h, i) => (
              <div 
                key={i} 
                className="flex-1 bg-primary/40 hover:bg-primary transition-all rounded-t-sm" 
                style={{ height: `${(h.activeUsers / 100) * 100}%` }}
                title={`Users: ${h.activeUsers}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ title, value, icon, trend, status }: any) => (
  <Card className="bg-white/5 border-white/10">
    <CardContent className="pt-6">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          {icon}
        </div>
        {trend && <span className="text-[10px] text-green-500 font-bold">{trend}</span>}
        {status === "warn" && <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Slow</Badge>}
      </div>
      <div className="mt-4">
        <p className="text-white/40 text-xs uppercase font-bold tracking-widest">{title}</p>
        <h3 className="text-2xl font-black mt-1">{value}</h3>
      </div>
    </CardContent>
  </Card>
);

const SaturationBar = ({ label, value, max, unit }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs">
      <span className="text-white/60">{label}</span>
      <span className="font-bold">{value}/{max}{unit}</span>
    </div>
    <Progress value={(value / max) * 100} className="h-1 bg-white/5" />
  </div>
);

const IncidentItem = ({ type, msg, time }: any) => {
  const colors = {
    info: "text-blue-400",
    warn: "text-yellow-500",
    error: "text-red-500",
    ok: "text-green-500"
  };
  return (
    <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2">
      <p className={`text-[11px] font-mono ${colors[type as keyof typeof colors]}`}>
        {msg}
      </p>
      <span className="text-[10px] text-white/20 whitespace-nowrap">{time}</span>
    </div>
  );
};

export default LoadMonitor;
