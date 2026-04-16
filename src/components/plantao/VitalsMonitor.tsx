import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Heart, Wind, Thermometer, Droplets } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface VitalsSnapshot {
  time: number;
  PA_sys: number;
  PA_dia: number;
  FC: number;
  FR: number;
  SpO2: number;
  Temp: number;
}

interface VitalsMonitorProps {
  snapshots: VitalsSnapshot[];
  patientStatus?: string;
  statusAlert?: boolean;
}

const VITAL_CONFIG = [
  { key: "PA", label: "PA", icon: Activity, unit: "mmHg", color: "#818cf8", getSys: true },
  { key: "FC", label: "FC", icon: Heart, unit: "bpm", normal: [60, 100], color: "#ef4444" },
  { key: "FR", label: "FR", icon: Wind, unit: "irpm", normal: [12, 20], color: "#3b82f6" },
  { key: "SpO2", label: "SpO₂", icon: Droplets, unit: "%", normal: [95, 100], color: "#22c55e" },
  { key: "Temp", label: "Temp", icon: Thermometer, unit: "°C", normal: [36, 37.8], color: "#f59e0b" },
];

function getVitalStatus(value: number, normal?: number[]): "normal" | "warning" | "critical" {
  if (!normal) return "normal";
  if (value < normal[0] * 0.85 || value > normal[1] * 1.15) return "critical";
  if (value < normal[0] || value > normal[1]) return "warning";
  return "normal";
}

const statusColors = {
  normal: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

const statusBorders = {
  normal: "border-emerald-500/20",
  warning: "border-amber-500/30",
  critical: "border-red-500/40 animate-pulse",
};

const statusBg = {
  normal: "bg-emerald-500/5",
  warning: "bg-amber-500/5",
  critical: "bg-red-500/8",
};

export default function VitalsMonitor({ snapshots, patientStatus, statusAlert }: VitalsMonitorProps) {
  if (snapshots.length < 1) return null;

  const latest = snapshots[snapshots.length - 1];

  const vitals = [
    { ...VITAL_CONFIG[0], value: `${latest.PA_sys}/${latest.PA_dia}`, status: getVitalStatus(latest.PA_sys, [90, 140]) },
    { ...VITAL_CONFIG[1], value: latest.FC, status: getVitalStatus(latest.FC, [60, 100]) },
    { ...VITAL_CONFIG[2], value: latest.FR, status: getVitalStatus(latest.FR, [12, 20]) },
    { ...VITAL_CONFIG[3], value: latest.SpO2, status: getVitalStatus(latest.SpO2, [95, 100]) },
    { ...VITAL_CONFIG[4], value: latest.Temp.toFixed(1), status: getVitalStatus(latest.Temp, [36, 37.8]) },
  ];

  return (
    <div className="space-y-3">
      {/* Hospital monitor header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Monitor</span>
        </div>
        {patientStatus && (
          <Badge
            variant="outline"
            className={`text-[10px] capitalize ${
              patientStatus === "estável" ? "border-emerald-500/30 text-emerald-400" :
              patientStatus === "instável" ? "border-amber-500/30 text-amber-400" :
              patientStatus === "grave" ? "border-orange-500/30 text-orange-400" :
              "border-red-500/30 text-red-400"
            } ${statusAlert ? "animate-pulse" : ""}`}
          >
            {patientStatus}
          </Badge>
        )}
      </div>

      {/* Vital signs grid - hospital monitor style */}
      <div className="grid grid-cols-1 gap-1.5">
        {vitals.map((v) => (
          <div
            key={v.key}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border ${statusBorders[v.status]} ${statusBg[v.status]} transition-all`}
          >
            <div className="flex items-center gap-2">
              <v.icon className={`h-3.5 w-3.5 ${statusColors[v.status]}`} />
              <span className="text-[11px] text-muted-foreground font-medium w-10">{v.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-black font-mono tabular-nums ${statusColors[v.status]}`}>
                {v.value}
              </span>
              <span className="text-[9px] text-muted-foreground/60">{v.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      {snapshots.length >= 2 && (
        <div className="rounded-xl border border-border/30 bg-muted/10 p-2">
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1 px-1">Tendência</p>
          <div className="h-[100px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshots} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}'`} />
                <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 10,
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                  labelFormatter={(v) => `${v} min`}
                />
                <Line type="monotone" dataKey="FC" stroke="#ef4444" strokeWidth={2} dot={false} name="FC" />
                <Line type="monotone" dataKey="PA_sys" stroke="#818cf8" strokeWidth={2} dot={false} name="PAS" />
                <Line type="monotone" dataKey="SpO2" stroke="#22c55e" strokeWidth={2} dot={false} name="SpO₂" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-3 justify-center mt-1">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="w-3 h-[2px] bg-red-500 rounded inline-block" /> FC</span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="w-3 h-[2px] bg-indigo-400 rounded inline-block" /> PAS</span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="w-3 h-[2px] bg-emerald-500 rounded inline-block" /> SpO₂</span>
          </div>
        </div>
      )}
    </div>
  );
}
