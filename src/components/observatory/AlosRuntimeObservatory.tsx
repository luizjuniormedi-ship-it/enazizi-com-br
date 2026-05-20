import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { 
  Activity, 
  Workflow, 
  Terminal, 
  ShieldCheck,
  BrainCircuit,
  History,
  AlertTriangle
} from "lucide-react";
import EventTimeline from "./EventTimeline";
import CognitivePropagationGraph from "./CognitivePropagationGraph";
import RuntimeHealthDashboard from "./RuntimeHealthDashboard";

export default function AlosRuntimeObservatory() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">ALOS Runtime Observatory</h2>
            <p className="text-sm text-muted-foreground">
              Monitoramento longitudinal da propagação cognitiva e saúde do runtime.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-background border border-white/10 w-full justify-start p-1 h-auto flex-wrap">
          <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary py-2 px-4">
            <Activity className="h-4 w-4" />
            Health Status
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary py-2 px-4">
            <History className="h-4 w-4" />
            Event Timeline
          </TabsTrigger>
          <TabsTrigger value="propagation" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary py-2 px-4">
            <Workflow className="h-4 w-4" />
            Propagation Graph
          </TabsTrigger>
          <TabsTrigger value="integrity" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary py-2 px-4">
            <ShieldCheck className="h-4 w-4" />
            Pedagogical Integrity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <RuntimeHealthDashboard />
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="p-6 bg-card/50 border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                Pedagogical Event Stream
              </h3>
            </div>
            <EventTimeline />
          </Card>
        </TabsContent>

        <TabsContent value="propagation">
          <Card className="p-6 bg-card/50 border-white/10">
            <CognitivePropagationGraph />
          </Card>
        </TabsContent>

        <TabsContent value="integrity">
          <Card className="p-8 bg-card/50 border-white/10 flex flex-col items-center justify-center text-center">
            <ShieldCheck className="h-12 w-12 text-success mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">Pedagogical Integrity Engine</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              O motor de auditoria está validando a consistência longitudinal dos estados cognitivos em tempo real.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left">
              {[
                { label: "Duplicate Revisions", status: "Zero Detected", icon: CheckCircle },
                { label: "Orphan FSRS Cards", status: "None", icon: CheckCircle },
                { label: "Planner Sync", status: "Consistent", icon: CheckCircle },
                { label: "Cognitive Loops", status: "Monitoring", icon: Activity }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-white/5">
                  <item.icon className={`h-4 w-4 ${item.status === 'Consistent' || item.status === 'None' || item.status === 'Zero Detected' ? 'text-success' : 'text-primary'}`} />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}