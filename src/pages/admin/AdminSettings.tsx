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

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("governance_thresholds")
      .select("*")
      .order("category");
    
    if (!error && data) {
      setThresholds(data);
    }
    setLoading(false);
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
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">Governança Operacional</h1>
        <p className="text-muted-foreground mt-2">Configuração de thresholds e limites de alerta enterprise.</p>
      </header>

      <div className="space-y-6">
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
                      className="w-32 h-9" 
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
      </div>
    </div>
  );
}
