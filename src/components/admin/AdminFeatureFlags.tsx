import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateFlags } from "@/hooks/useFeatureFlags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleLeft, History, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Flag {
  id: string;
  flag_key: string;
  enabled: boolean;
  description: string | null;
  category: string | null;
  rollout_mode: string;
  updated_at: string;
  updated_by: string | null;
}

interface AuditEntry {
  id: string;
  flag_key: string;
  previous_value: boolean | null;
  new_value: boolean;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

const AdminFeatureFlags = () => {
  const { user } = useAuth();
  const invalidateFlags = useInvalidateFlags();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const loadFlags = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_flags")
      .select("*")
      .order("category", { ascending: true });
    setFlags((data as Flag[]) || []);
    setLoading(false);
  };

  const loadAudit = async () => {
    const { data } = await supabase
      .from("system_flag_audit")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(50);
    setAudit((data as AuditEntry[]) || []);
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleToggle = async (flag: Flag) => {
    if (!user) return;
    setToggling(flag.flag_key);
    const newVal = !flag.enabled;
    const reason = reasons[flag.flag_key] || "";

    // Auditoria
    await supabase.from("system_flag_audit").insert({
      flag_key: flag.flag_key,
      previous_value: flag.enabled,
      new_value: newVal,
      changed_by: user.id,
      reason: reason || null,
    });

    // Atualizar flag
    const { error } = await supabase
      .from("system_flags")
      .update({ enabled: newVal, updated_by: user.id })
      .eq("id", flag.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: newVal ? "✅ Flag ativada" : "⛔ Flag desativada",
        description: `${flag.flag_key} → ${newVal ? "ON" : "OFF"}`,
      });
      setReasons((r) => ({ ...r, [flag.flag_key]: "" }));
      invalidateFlags();
    }

    await loadFlags();
    setToggling(null);
  };

  const categoryColor = (cat: string | null) => {
    const colors: Record<string, string> = {
      planner: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      tutor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      dashboard: "bg-green-500/10 text-green-400 border-green-500/30",
      recovery: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      fsrs: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      approval: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      video: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    };
    return colors[cat || ""] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ToggleLeft className="h-5 w-5" /> Feature Flags
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowAudit(!showAudit); if (!showAudit) loadAudit(); }}>
                <History className="h-4 w-4 mr-1" /> Auditoria
              </Button>
              <Button size="sm" variant="outline" onClick={loadFlags}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {flags.map((flag) => (
                <div key={flag.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => handleToggle(flag)}
                    disabled={toggling === flag.flag_key}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium">{flag.flag_key}</span>
                      <Badge variant="outline" className={categoryColor(flag.category)}>
                        {flag.category || "geral"}
                      </Badge>
                      <Badge variant={flag.enabled ? "default" : "secondary"} className="text-xs">
                        {flag.enabled ? "ON" : "OFF"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{flag.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Atualizado: {format(new Date(flag.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Input
                    placeholder="Motivo (opcional)"
                    className="w-48 h-8 text-xs"
                    value={reasons[flag.flag_key] || ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [flag.flag_key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAudit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Alterações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.flag_key}</TableCell>
                    <TableCell>
                      <Badge variant={a.previous_value ? "default" : "secondary"} className="text-xs">
                        {a.previous_value ? "ON" : "OFF"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.new_value ? "default" : "secondary"} className="text-xs">
                        {a.new_value ? "ON" : "OFF"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-32 truncate">{a.reason || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(a.changed_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
                {audit.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma alteração registrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminFeatureFlags;
