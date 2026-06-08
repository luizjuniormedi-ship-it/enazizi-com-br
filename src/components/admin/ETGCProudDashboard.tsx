import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ShieldCheck, Play, List, AlertCircle, RefreshCw, CheckCircle2, XCircle, Search } from "lucide-react";

export function ETGCProudDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: summaryData } = await supabase
        .from("etgc_certification_summary")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (summaryData?.[0]) {
        setSummary(summaryData[0]);
      }

      const { data: resultsData } = await supabase
        .from("etgc_certification_results")
        .select("*")
        .order("status", { ascending: false });

      if (resultsData) {
        setResults(resultsData);
      }

      // Fetch inventory
      const { data: invData } = await supabase.functions.invoke("etgc-prod-runner", {
        body: { action: "inventory" }
      });
      if (invData?.success) {
        setInventory(invData.items);
      }
    } catch (error) {
      console.error("Error fetching ETGC data:", error);
      toast.error("Erro ao carregar dados do ETGC");
    } finally {
      setIsLoading(false);
    }
  };

  const startCertification = async () => {
    if (!inventory.length) return;
    setIsRunning(true);
    setProgress(0);
    
    const batchSize = 5;
    const totalBatches = Math.ceil(inventory.length / batchSize);
    
    toast.info(`Iniciando certificação de ${inventory.length} competências em ${totalBatches} lotes...`);

    for (let i = 0; i < totalBatches; i++) {
      const batch = inventory.slice(i * batchSize, (i + 1) * batchSize);
      const competencyIds = batch.map((item: any) => item.competency_id);
      
      try {
        const { data, error } = await supabase.functions.invoke("etgc-prod-runner", {
          body: { action: "run_batch", competency_ids: competencyIds }
        });

        if (error) throw error;
        
        setProgress(Math.round(((i + 1) / totalBatches) * 100));
        await fetchData(); // Refresh results table
      } catch (error) {
        console.error("Error running batch:", error);
        toast.error(`Erro no lote ${i + 1}`);
      }
    }

    // Final summary
    try {
      await supabase.functions.invoke("etgc-prod-runner", {
        body: { action: "summary" }
      });
      await fetchData();
      toast.success("Certificação ETGC concluída com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar sumário final");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="w-full border-2 border-primary/20 bg-black/40 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-white">ETGC-PROD: EXACT TOPIC GENERATION CERTIFICATION</CardTitle>
            <p className="text-sm text-white/60">Certificação Definitiva de Pureza Temática em Produção Real</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData} 
            disabled={isLoading || isRunning}
            className="border-white/10 hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={startCertification} 
            disabled={isRunning || !inventory.length}
            className="bg-primary text-primary-foreground font-bold"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Executar Certificação Full (163 Temas)
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-8">
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-primary">
              <span>PROGRESSO DA AUDITORIA MASSIVA</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-white/50 uppercase">CTS (Coverage Topic Score)</p>
              <p className={`text-2xl font-black ${summary.cts >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.cts}%
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-white/50 uppercase">TPS Médio (Purity Score)</p>
              <p className={`text-2xl font-black ${summary.tps_avg >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.tps_avg}%
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-white/50 uppercase">Topic Leakage</p>
              <p className={`text-2xl font-black ${summary.topic_leakage_avg <= 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                {summary.topic_leakage_avg}%
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-white/50 uppercase">Temas Verdes</p>
              <p className="text-2xl font-black text-emerald-400">
                {summary.green_count} <span className="text-xs text-white/30">/ {summary.total_competencies}</span>
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[10px] font-bold text-white/50 uppercase">Status Global</p>
              <Badge variant={summary.is_certified ? "default" : "destructive"} className="mt-1">
                {summary.is_certified ? "CERTIFICADO GOLD" : "PENDENTE CERTIFICAÇÃO"}
              </Badge>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <List className="h-5 w-5 text-primary" />
              Detalhamento por Competência (163)
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input 
                type="text" 
                placeholder="Filtrar competência..." 
                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50 w-64"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow>
                  <TableHead className="text-white font-bold">Competência</TableHead>
                  <TableHead className="text-white font-bold text-center">10Q</TableHead>
                  <TableHead className="text-white font-bold text-center">20Q</TableHead>
                  <TableHead className="text-white font-bold text-center">50Q</TableHead>
                  <TableHead className="text-white font-bold text-center">TPS</TableHead>
                  <TableHead className="text-white font-bold text-center">Leakage</TableHead>
                  <TableHead className="text-white font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length > 0 ? (
                  results.map((r) => (
                    <TableRow key={r.id} className="hover:bg-white/5 border-white/5">
                      <TableCell className="font-medium text-white">{r.competency_name}</TableCell>
                      <TableCell className="text-center text-white/70">{r.returned_10_count}</TableCell>
                      <TableCell className="text-center text-white/70">{r.returned_20_count}</TableCell>
                      <TableCell className="text-center text-white/70">{r.returned_50_count}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${r.tps >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {r.tps}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-red-400">{r.leakage_count}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={
                            r.status === 'VERDE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' :
                            r.status === 'AMARELO' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                            'bg-red-500/20 text-red-400 border-red-500/20'
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-white/30 italic">
                      Nenhum resultado de auditoria disponível. Execute a certificação.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
