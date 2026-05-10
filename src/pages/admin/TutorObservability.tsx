import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  Brain, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  ShieldAlert,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TutorObservability() {
  const { data: audits, isLoading } = useQuery({
    queryKey: ["tutor-v2-audits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_v2_audits")
        .select(`
          *,
          session:session_id ( topic ),
          user:user_id ( email )
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const stats = {
    total: audits?.length || 0,
    avgPedagogical: Math.round((audits?.reduce((acc, curr) => acc + (curr.pedagogical_score || 0), 0) || 0) / (audits?.length || 1)),
    avgFeynman: Math.round((audits?.reduce((acc, curr) => acc + (curr.feynman_score || 0), 0) || 0) / (audits?.length || 1)),
    hallucinations: audits?.filter(a => a.hallucination_warning).length || 0,
    avgLatency: Math.round((audits?.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0) || 0) / (audits?.length || 1))
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutor V2 Observability</h1>
          <p className="text-muted-foreground">Hardening Pedagógico & Monitoring Dashboard</p>
        </div>
        <Badge variant="outline" className="h-6 gap-1.5 px-3">
          <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
          Live Telemetry Active
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="glass-premium border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPedagogical}%</div>
            <p className="text-xs text-muted-foreground mt-1">Avg Pedagogical Score</p>
          </CardContent>
        </Card>

        <Card className="glass-premium border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" /> Feynman Depth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgFeynman}%</div>
            <p className="text-xs text-muted-foreground mt-1">Analogy & Recall detected</p>
          </CardContent>
        </Card>

        <Card className="glass-premium border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" /> Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgLatency}ms</div>
            <p className="text-xs text-muted-foreground mt-1">Avg Response Time</p>
          </CardContent>
        </Card>

        <Card className="glass-premium border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" /> Interactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 50 messages</p>
          </CardContent>
        </Card>

        <Card className="glass-premium border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.hallucinations}</div>
            <p className="text-xs text-muted-foreground mt-1">Potential Hallucinations</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Audit Table */}
      <Card className="glass-premium overflow-hidden">
        <CardHeader>
          <CardTitle>Recent Pedagogical Audits</CardTitle>
          <CardDescription>Detailed breakdown of AI response quality and structure.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Session/Topic</TableHead>
                  <TableHead>Phase 0 Context</TableHead>
                  <TableHead>Pedagogy</TableHead>
                  <TableHead>Feynman</TableHead>
                  <TableHead>Structure</TableHead>
                  <TableHead>Safety</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits?.map((audit) => (
                  <TableRow key={audit.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="font-medium">{audit.session?.topic || "No topic"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {audit.user?.email || "Unknown user"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="text-[10px] w-fit">
                          Load: {Math.round((audit.cognitive_load || 0) * 100)}%
                        </Badge>
                        <div className="text-[10px] text-muted-foreground">
                          {audit.detected_gaps?.length || 0} gaps detected
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${audit.pedagogical_score}%` }} 
                          />
                        </div>
                        <span className="text-xs font-bold">{audit.pedagogical_score}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500" 
                            style={{ width: `${audit.feynman_score}%` }} 
                          />
                        </div>
                        <span className="text-xs font-bold">{audit.feynman_score}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[10px] flex flex-col gap-1">
                        <span className="text-emerald-500 font-medium">
                          {audit.blocks_found?.length || 0} blocks OK
                        </span>
                        {audit.blocks_missing?.length > 0 && (
                          <span className="text-destructive font-medium">
                            {audit.blocks_missing?.length} missing
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {audit.hallucination_warning ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Warning
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Secure
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {audit.latency_ms}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Audit Detail Helper */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="glass-premium">
          <CardHeader>
            <CardTitle className="text-lg">Protocolo 15 Blocos</CardTitle>
            <CardDescription>Status de conformidade estrutural.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                "Introdução", "Explicação leiga", "Técnica", "Fisiologia", "Fisiopatologia", 
                "Clínica", "Sintomas", "Exame físico", "Diferencial", "Exames", 
                "Tratamento", "Pegadinhas", "Resumo", "Active recall", "Próxima ação"
              ].map(block => (
                <Badge key={block} variant="outline" className="text-[10px]">
                  {block}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-premium">
          <CardHeader>
            <CardTitle className="text-lg">Medical Safety Check</CardTitle>
            <CardDescription>Anti-alucinação & Validação de Guidelines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Heurística de Segurança</p>
                <p className="text-xs text-muted-foreground">Verificando referências bibliográficas reais.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Feynman Validation</p>
                <p className="text-xs text-muted-foreground">Confirmando presença de analogias explicativas.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}