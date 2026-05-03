import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Loader2, Save, ShieldCheck, Cpu, Zap, Timer, 
  AlertTriangle, Blocks, Database, Trash2 
} from "lucide-react";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<any[]>([]);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data: thresholdData } = await supabase
        .from("governance_thresholds")
        .select("*")
        .order("category");
      
      if (thresholdData) {
        setThresholds(thresholdData);
      }

      const { data: retentionData } = await supabase
        .from("data_retention_policies")
        .select("*");
      
      if (retentionData) {
        setRetentionPolicies(retentionData);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave(id: string, key: string, value: any) {
    setSaving(true);
    const { error } = await supabase
      .from("governance_thresholds")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(`Erro ao salvar ${key}`);
    } else {
      toast.success(`${key} atualizado`);
      loadSettings();
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  const categories: Record<string, { label: string; icon: any }> = {
    ai: { label: "Inteligência Artificial", icon: <Cpu className="h-4 w-4" /> },
    performance: { label: "Performance", icon: <Timer className="h-4 w-4" /> },
    engagement: { label: "Engajamento", icon: <Zap className="h-4 w-4" /> },
    errors: { label: "Erros & Estabilidade", icon: <AlertTriangle className="h-4 w-4" /> },
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Governança Operacional</h1>
        <p className="text-muted-foreground mt-2">Configuração de thresholds, limites de alerta e retenção enterprise.</p>
      </header>

      <Tabs defaultValue="thresholds" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="thresholds" className="gap-2"><AlertTriangle className="h-4 w-4" /> Thresholds & Alertas</TabsTrigger>
          <TabsTrigger value="retention" className="gap-2"><Database className="h-4 w-4" /> Retenção de Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="thresholds" className="space-y-6">
          {Object.entries(categories).map(([catKey, catInfo]) => (
            <Card key={catKey} className="border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {catInfo.icon} {catInfo.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {thresholds.filter(t => t.category === catKey).map(t => (
                  <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-bold">{t.key}</Label>
                        <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        className="w-32 h-9 text-center font-mono" 
                        type="number" 
                        defaultValue={Object.values(t.value)[0] as any}
                        onBlur={(e) => {
                          const valKey = Object.keys(t.value)[0];
                          handleSave(t.id, t.key, { [valKey]: Number(e.target.value) });
                        }}
                      />
                      <span className="text-xs font-medium text-muted-foreground min-w-[30px]">
                        {Object.keys(t.value)[0] === 'ms' ? 'ms' : '%'}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="retention">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" /> Políticas de Limpeza Programada
              </CardTitle>
              <CardDescription>
                Define por quanto tempo os logs e eventos de telemetria serão mantidos antes de serem removidos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {retentionPolicies.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground italic">
                    Nenhuma política de retenção configurada.
                  </div>
                ) : (
                  retentionPolicies.map((policy) => (
                    <div key={policy.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                      <div className="space-y-1">
                        <p className="text-sm font-bold uppercase tracking-wider">{policy.table_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Última execução: {policy.last_run_at ? new Date(policy.last_run_at).toLocaleString() : "Nunca"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-center font-mono"
                            defaultValue={policy.retention_days}
                            onBlur={async (e) => {
                              const val = Number(e.target.value);
                              const { error } = await supabase
                                .from('data_retention_policies')
                                .update({ retention_days: val, updated_at: new Date().toISOString() })
                                .eq('id', policy.id);
                              if (!error) {
                                toast.success(`Retenção de ${policy.table_name} atualizada`);
                                loadSettings();
                              }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">dias</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{policy.action.toUpperCase()}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
