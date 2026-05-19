import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Server, RefreshCw, Wifi, WifiOff, XCircle,
  LayoutDashboard, Users, BarChart3, ShieldAlert, Zap, Activity, GitMerge, Film, Brain,
} from "lucide-react";
import { DashboardData, MentorSummary, StudentRow, RiskAlert } from "@/components/monitoring/MonitoringTypes";
import { OverviewTab } from "@/components/monitoring/OverviewTab";
import { StudentsTab } from "@/components/monitoring/StudentsTab";
import { PerformanceTab } from "@/components/monitoring/PerformanceTab";
import { RiskAlertsTab } from "@/components/monitoring/RiskAlertsTab";
import { AIUsageTab } from "@/components/monitoring/AIUsageTab";
import { SystemHealthTab } from "@/components/monitoring/SystemHealthTab";
import { InterventionEfficacyMonitor } from "@/components/admin/InterventionEfficacyMonitor";
import { AdaptivePathwaysLog } from "@/components/admin/AdaptivePathwaysLog";
import { VideoRecommendationAuditTab } from "@/components/monitoring/VideoRecommendationAuditTab";
import { AdaptiveAuditTab } from "@/components/monitoring/AdaptiveAuditTab";
import { ScaleGovernanceTab } from "@/components/monitoring/ScaleGovernanceTab";
import { GovernanceCockpit } from "@/components/governance/GovernanceCockpit";
import { Scale, Database, ShieldCheck } from "lucide-react";

export default function AdminMonitoring() {
  const { session } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: dashboard, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["admin-monitoring-dashboard"],
    queryFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-health-check?mode=dashboard`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${s?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch monitoring data");
      return response.json();
    },
    enabled: !!session,
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 120_000 : false,
    refetchIntervalInBackground: false,
  });

  const { data: mentorData } = useQuery<{
    students: StudentRow[];
    alerts: RiskAlert[];
    summary: MentorSummary;
  }>({
    queryKey: ["admin-mentor-intelligence"],
    queryFn: async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-intelligence`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${s?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch mentor data");
      return response.json();
    },
    enabled: !!session,
    staleTime: 120_000,
    refetchInterval: autoRefresh ? 240_000 : false,
    refetchIntervalInBackground: false,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["admin-monitoring-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_health_reports" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!session,
    staleTime: 60_000,
  });

  const d = dashboard;
  const students = mentorData?.students || d?.students || [];
  const riskCount = mentorData?.summary
    ? mentorData.summary.risk + mentorData.summary.critical
    : 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Painel do Mentor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {d?.timestamp
              ? `Atualizado: ${new Date(d.timestamp).toLocaleTimeString("pt-BR")}`
              : "Carregando..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-1.5 text-xs"
          >
            {autoRefresh ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : d ? (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="overview" className="text-xs gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Alunos
              {students.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                  {students.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Desempenho
            </TabsTrigger>
            <TabsTrigger value="risk" className="text-xs gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Riscos
              {riskCount > 0 && (
                <Badge variant="destructive" className="text-[9px] h-4 px-1 ml-0.5">
                  {riskCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              IA
            </TabsTrigger>
            <TabsTrigger value="adaptive" className="text-xs gap-1.5">
              <GitMerge className="h-3.5 w-3.5" />
              ACE Loop
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Sistema
            </TabsTrigger>
            <TabsTrigger value="video-audit" className="text-xs gap-1.5">
              <Film className="h-3.5 w-3.5" />
              Auditoria Vídeo
            </TabsTrigger>
            <TabsTrigger value="cognitive-audit" className="text-xs gap-1.5">
              <Brain className="h-3.5 w-3.5 text-primary" />
              Auditoria Cognitiva
            </TabsTrigger>
            <TabsTrigger value="scale-governance" className="text-xs gap-1.5">
              <Scale className="h-3.5 w-3.5 text-primary" />
              Governança de Escala
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab d={d} mentorSummary={mentorData?.summary} students={students} />
          </TabsContent>
          <TabsContent value="students">
            <StudentsTab students={students} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceTab d={d} students={students} />
          </TabsContent>
          <TabsContent value="risk">
            <RiskAlertsTab
              alerts={mentorData?.alerts || d.riskAlerts || []}
              systemAlerts={(alertsData as any)?.alerts || []}
            />
          </TabsContent>
          <TabsContent value="ai">
            <AIUsageTab d={d} />
          </TabsContent>
          <TabsContent value="adaptive" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InterventionEfficacyMonitor />
              <AdaptivePathwaysLog />
            </div>
          </TabsContent>
          <TabsContent value="system">
            <SystemHealthTab d={d} />
          </TabsContent>
          <TabsContent value="video-audit">
            <VideoRecommendationAuditTab />
          </TabsContent>
          <TabsContent value="cognitive-audit">
            <AdaptiveAuditTab />
          </TabsContent>
          <TabsContent value="scale-governance">
            <ScaleGovernanceTab />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm">Erro ao carregar dados de monitoramento</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
