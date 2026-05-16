import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Activity, ShieldAlert, Zap, BarChart3, TrendingUp, DollarSign, HeartPulse } from "lucide-react";

export function ExecutiveCognitiveDashboard() {
    const { data: report, isLoading } = useQuery({
        queryKey: ["executive-cognitive-report"],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke("cognitive-executive-report");
            if (error) throw error;
            return data;
        },
        refetchInterval: 60000 // Update every minute
    });

    if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando Observatório Cognitivo Enterprise...</div>;

    return (
        <div className="p-6 space-y-6 bg-[#050508] min-h-screen text-white">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black tracking-tighter uppercase flex items-center gap-3">
                    <Brain className="text-primary h-8 w-8" />
                    Cognitive Observatory <span className="text-white/20 ml-2">v2026</span>
                </h1>
                <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">
                    Live Telemetry Active
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-3 w-3" /> Retenção Média
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary">
                            {(report?.cognitive?.average_retention * 100 || 0).toFixed(1)}%
                        </div>
                        <Progress value={report?.cognitive?.average_retention * 100 || 0} className="h-1 mt-3" />
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" /> Sucesso Recovery
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400">
                            {(report?.cognitive?.average_recovery_success * 100 || 0).toFixed(1)}%
                        </div>
                        <Progress value={report?.cognitive?.average_recovery_success * 100 || 0} className="h-1 mt-3 bg-white/5" />
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <ShieldAlert className="h-3 w-3" /> Risco de Churn
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-rose-500">
                            {report?.cognitive?.high_risk_churn_count || 0}
                        </div>
                        <div className="text-[10px] text-white/20 mt-2 font-bold">ALUNOS EM SOBRECARGA</div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <Zap className="h-3 w-3" /> Impacto Tutor IA
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-amber-400">
                            {(report?.ai_governance?.average_tutor_impact || 0).toFixed(1)}
                        </div>
                        <div className="text-[10px] text-white/20 mt-2 font-bold">SCORE PEDAGÓGICO MÉDIO</div>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <ShieldAlert className="h-3 w-3" /> Governance Score
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-400">
                            {Math.max(0, 100 - (report?.ai_governance?.total_incidents_30d * 2 || 0)).toFixed(0)}
                        </div>
                        <div className="text-[10px] text-white/20 mt-2 font-bold uppercase">SISTEMA RESILIENTE</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" /> IA Governance & Cost
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-xs text-white/60">Custo Total IA</span>
                            <span className="font-bold text-emerald-400 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {report?.finances?.total_ai_cost_usd?.toFixed(2) || "0.00"}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                            <span className="text-xs text-white/60">Custo Médio / Aluno</span>
                            <span className="font-bold text-white">${report?.finances?.cost_per_user?.toFixed(3) || "0.00"}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                            <span className="text-xs text-white/60">Incidentes de Alucinação</span>
                            <span className="font-bold text-rose-400">{report?.ai_governance?.hallucination_incidents || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                            <span className="text-xs text-white/60">Tokens Processados</span>
                            <span className="font-bold text-primary">{(report?.finances?.total_tokens / 1000 || 0).toFixed(1)}k</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                            <HeartPulse className="h-4 w-4 text-rose-500" /> Self-Healing Monitor
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {report?.ai_governance?.self_healing_incidents?.length > 0 ? (
                            report.ai_governance.self_healing_incidents.map((incident: any) => (
                                <div key={incident.id} className="p-3 rounded-xl bg-white/5 border-l-2 border-rose-500 text-[10px]">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold uppercase">{incident.incident_type}</span>
                                        <span className="text-white/40">{new Date(incident.detected_at).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-white/60 line-clamp-1">{incident.feature_name}: {incident.mitigation_details}</p>
                                </div>
                            ))
                        ) : (
                            <div className="h-32 flex items-center justify-center border border-dashed border-white/10 rounded-2xl text-[10px] text-emerald-500/40 font-bold uppercase tracking-widest">
                                System Status: Healthy
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-black tracking-tight flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" /> Autonomous Interventions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48 flex items-center justify-center border border-dashed border-white/10 rounded-2xl text-[10px] text-white/20 font-bold uppercase tracking-widest text-center px-4">
                            Autonomous Recovery Agent Active<br/>
                            <span className="text-emerald-500">Monitoring fatigue & retention signals...</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
