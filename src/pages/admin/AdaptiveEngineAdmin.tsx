import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BrainCircuit, 
  Activity, 
  Zap, 
  Settings2, 
  ShieldCheck, 
  LineChart,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const AdaptiveEngineAdmin = () => {
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["adaptive-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_student_profiles")
        .select("*")
        .limit(10);
      if (error) throw error;
      return data;
    }
  });

  const { data: interventions } = useQuery({
    queryKey: ["adaptive-interventions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_interventions")
        .select("*, node:context_node_id(name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Adaptive Curriculum Engine</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <BrainCircuit className="h-4 w-4" /> Personalização de Jornada em Tempo Real via Cognitive Profile
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Settings2 className="h-4 w-4" /> Regras do Motor
          </Button>
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary h-10 px-4 font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Modo Shadow: ON
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Eficácia IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92.4%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Recuperação de retenção após intervenção</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" /> Atrito Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2</div>
            <p className="text-[10px] text-muted-foreground mt-1">Média de carga cognitiva (0-10)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" /> Intervenções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interventions?.length || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Decisões adaptativas nas últimas 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Alunos em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-[10px] text-muted-foreground mt-1">Detecções de fadiga cognitiva</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="interventions" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="interventions" className="font-bold">Log de Decisões do Motor</TabsTrigger>
          <TabsTrigger value="profiles" className="font-bold">Student Cognitive States</TabsTrigger>
        </TabsList>

        <TabsContent value="interventions" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <LineChart className="h-5 w-5 text-primary" /> Shadow Decisions Feed
              </CardTitle>
              <CardDescription>Ações que o motor teria tomado em tempo real.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {interventions?.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className={`p-2 rounded-lg ${
                      item.trigger_type === 'high_friction' ? 'bg-red-500/10' : 'bg-blue-500/10'
                    }`}>
                      <Zap className={`h-5 w-5 ${
                        item.trigger_type === 'high_friction' ? 'text-red-500' : 'text-blue-500'
                      }`} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-sm uppercase tracking-tighter text-primary">
                          {item.action_taken.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(item.created_at), "HH:mm:ss")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Trigger: <span className="font-medium text-foreground">{item.trigger_type}</span> em 
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">
                          {item.node?.name || "Conceito Médico"}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[9px] font-bold">AUTO-DIAGNOSE</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] italic">Reduzindo dificuldade para normalizar retenção...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles?.map((profile: any) => (
              <Card key={profile.id} className="border-primary/10 hover:border-primary/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">Estudante ID {profile.user_id.slice(0, 8)}</CardTitle>
                      <CardDescription className="text-[10px]">Atualizado há {format(new Date(profile.updated_at), "mm")} min</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>Friction Score</span>
                      <span className={profile.overall_friction_score > 7 ? "text-red-500" : "text-green-500"}>
                        {profile.overall_friction_score.toFixed(1)}
                      </span>
                    </div>
                    <Progress value={profile.overall_friction_score * 10} className="h-1.5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>Carga Cognitiva</span>
                      <span>{profile.cognitive_load_estimate.toFixed(1)}</span>
                    </div>
                    <Progress value={profile.cognitive_load_estimate * 10} className="h-1.5 bg-amber-100" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="secondary" className="text-[9px] uppercase">{profile.preferred_modality}</Badge>
                    <Badge variant="outline" className="text-[9px] uppercase border-primary/20">Multimodal Active</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdaptiveEngineAdmin;
