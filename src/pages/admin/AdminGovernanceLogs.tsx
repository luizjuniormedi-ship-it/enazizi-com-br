import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ShieldCheck, History, Download, 
  Search, Filter, AlertTriangle, UserCheck, Settings2 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminGovernanceLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  async function loadLogs() {
    setLoading(true);
    try {
      let query = supabase
        .from('governance_logs')
        .select(`
          *,
          admin:profiles(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`action_type.ilike.%${search}%,target_table.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error loading governance logs:", error);
      toast.error("Erro ao carregar logs de governança");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [search]);

  async function exportLogs() {
    const stamp = new Date().toISOString().slice(0, 10);
    const headers = ["ID", "Data", "Admin", "Ação", "Tabela", "Severidade", "Detalhes"];
    const rows = logs.map(l => [
      l.id,
      l.created_at,
      l.admin?.full_name || l.admin?.email || "System",
      l.action_type,
      l.target_table || "N/A",
      l.severity,
      JSON.stringify(l.details)
    ]);

    const csvContent = [headers.join(",")].concat(rows.map(r => r.join(","))).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `governance_logs_${stamp}.csv`;
    a.click();
    
    // Log the export action itself
    await supabase.from('governance_logs').insert({
      action_type: 'csv_export',
      target_table: 'governance_logs',
      severity: 'info',
      details: { format: 'csv', count: logs.length }
    });
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
            Governança & Auditoria
          </h1>
          <p className="text-muted-foreground mt-2">Logs imutáveis de operações críticas e mudanças de infraestrutura.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button onClick={loadLogs}>
            <History className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </header>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filtrar por ação ou tabela..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Ações Críticas" 
          value={logs.filter(l => l.severity === 'critical').length} 
          icon={<ShieldCheck className="text-red-500" />}
          description="Últimas 100 operações"
        />
        <StatCard 
          title="Exportações" 
          value={logs.filter(l => l.action_type === 'csv_export').length} 
          icon={<Download className="text-blue-500" />}
          description="Acesso a dados sensíveis"
        />
        <StatCard 
          title="Admins Ativos" 
          value={new Set(logs.map(l => l.admin_id)).size} 
          icon={<UserCheck className="text-emerald-500" />}
          description="Operadores autenticados"
        />
      </div>

      <Card className="border-primary/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b text-left">
                <tr>
                  <th className="px-6 py-4 font-medium">Data/Hora</th>
                  <th className="px-6 py-4 font-medium">Operador</th>
                  <th className="px-6 py-4 font-medium">Ação</th>
                  <th className="px-6 py-4 font-medium">Contexto</th>
                  <th className="px-6 py-4 font-medium">Severidade</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{log.admin?.full_name || "Sistema"}</span>
                          <span className="text-[10px] text-muted-foreground">{log.admin?.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {log.action_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-3 w-3 text-muted-foreground" />
                          <span>{log.target_table || "Infraestrutura"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <SeverityBadge severity={log.severity} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, description }: any) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
          <div className="p-2 rounded-full bg-muted">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[severity] || styles.info}`}>
      {severity.toUpperCase()}
    </Badge>
  );
}
