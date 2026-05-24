
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { ShieldCheck, AlertTriangle, CheckCircle2, Microscope, Search } from "lucide-react";

interface ForensicLog {
  id: string;
  board: string;
  fidelity_score: number;
  structural_score: number;
  lexical_score: number;
  cognitive_score: number;
  pedagogical_score: number;
  ai_pattern_score: number;
  flags: string[];
  decision: string;
  created_at: string;
}

export const QuestionQualityPanel = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["forensic-quality-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forensic_quality_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ForensicLog[];
    }
  });

  const { data: stats } = useQuery({
    queryKey: ["forensic-stats"],
    queryFn: async () => {
      const boards = [...new Set(logs?.map(l => l.board) || [])];
      return boards.map(board => {
        const boardLogs = logs?.filter(l => l.board === board) || [];
        return {
          board,
          avg_fidelity: boardLogs.reduce((a, b) => a + b.fidelity_score, 0) / boardLogs.length,
          reject_rate: (boardLogs.filter(l => l.decision === 'REJECT').length / boardLogs.length) * 100
        };
      });
    },
    enabled: !!logs && logs.length > 0
  });

  if (isLoading) return <div className="animate-pulse h-96 bg-white/5 rounded-xl" />;

  const totalLogs = logs?.length || 1;
  const acceptanceData = [
    { name: "Aceitas", value: logs?.filter(l => l.decision === 'ACCEPT').length || 0, color: "#10b981" },
    { name: "Rejeitadas", value: logs?.filter(l => l.decision === 'REJECT').length || 0, color: "#ef4444" },
    { name: "Retry", value: logs?.filter(l => l.decision === 'RETRY').length || 0, color: "#f59e0b" },
  ];

  const avgFidelity = logs?.length ? Math.round(logs.reduce((a, b) => a + b.fidelity_score, 0) / logs.length) : 0;
  const rejectRate = logs?.length ? Math.round((logs.filter(l => l.decision === 'REJECT').length / logs.length) * 100) : 0;
  const aiPatternCount = logs?.filter(l => (l.ai_pattern_score || 0) > 30).length || 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white/5 border-white/10 space-y-2">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="h-3 w-3" /> Fidelity Score Médio
          </div>
          <div className="text-3xl font-black text-white">
            {avgFidelity}%
          </div>
        </Card>
        
        <Card className="p-4 bg-white/5 border-white/10 space-y-2">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <Microscope className="h-3 w-3" /> Taxa de Rejeição
          </div>
          <div className="text-3xl font-black text-red-500">
            {rejectRate}%
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10 space-y-2">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" /> Padrões IA Detectados
          </div>
          <div className="text-3xl font-black text-amber-500">
            {aiPatternCount}
          </div>
        </Card>

        <Card className="p-4 bg-white/5 border-white/10 space-y-2">
          <div className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3" /> Total de Auditorias
          </div>
          <div className="text-3xl font-black text-emerald-500">
            {logs?.length || 0}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white/5 border-white/10 h-[400px]">
          <h3 className="text-sm font-bold text-white/60 mb-6 uppercase">Drift de Qualidade por Banca</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={stats || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="board" stroke="#ffffff40" fontSize={10} />
              <YAxis stroke="#ffffff40" fontSize={10} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f1115", border: "1px solid #ffffff10" }}
                itemStyle={{ color: "#fff" }}
              />
              <Bar dataKey="avg_fidelity" name="Fidelity Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-white/5 border-white/10 h-[400px]">
          <h3 className="text-sm font-bold text-white/60 mb-6 uppercase">Decisões do Motor Forense</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={acceptanceData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {acceptanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f1115", border: "1px solid #ffffff10" }}
                itemStyle={{ color: "#fff" }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white/60 uppercase">Logs Forenses Recentes</h3>
          <Search className="h-4 w-4 text-white/30" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-white/40">
              <tr>
                <th className="p-3">Banca</th>
                <th className="p-3">Score</th>
                <th className="p-3">Padrão IA</th>
                <th className="p-3">Status</th>
                <th className="p-3">Data</th>
                <th className="p-3">Flags</th>
              </tr>
            </thead>
            <tbody>
              {logs?.slice(0, 15).map((log) => (
                <tr key={log.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3 font-bold text-white/80">{log.board}</td>
                  <td className="p-3">
                    <span className={`font-mono ${log.fidelity_score >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {log.fidelity_score}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-red-400">{log.ai_pattern_score}%</td>
                  <td className="p-3">
                    {log.decision === 'ACCEPT' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ACEITA</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">REJEITADA</span>
                    )}
                  </td>
                  <td className="p-3 text-white/40">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {log.flags?.map((f: string, idx: number) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/40 border border-white/10">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!logs?.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-white/20 italic">
                    Nenhum log forense disponível. Inicie uma geração para ver dados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
