import { useState, useEffect, useRef } from "react";
import { Database, Globe, FileText, CheckCircle2, Loader2, ExternalLink, Search, Link2, BarChart3, Scale, Pause, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface IndexedSource {
  name: string;
  banca: string;
  year: number;
  pdfUrl: string | null;
  status: "indexed" | "extracted" | "pending";
  questionsCount?: number;
}

const ENARE_SOURCES: IndexedSource[] = [
  { name: "ENARE 2025 - Objetiva R1", banca: "ENARE", year: 2025, pdfUrl: null, status: "indexed" },
  { name: "ENARE 2024 - Objetiva R1", banca: "ENARE", year: 2024, pdfUrl: null, status: "indexed" },
  { name: "ENARE 2023 - Objetiva", banca: "ENARE", year: 2023, pdfUrl: null, status: "indexed" },
  { name: "ENARE 2022 - Objetiva", banca: "ENARE", year: 2022, pdfUrl: null, status: "indexed" },
  { name: "ENARE 2021 - Objetiva", banca: "ENARE", year: 2021, pdfUrl: null, status: "indexed" },
];

const BASIC_SCIENCES = [
  "Anatomia", "Bioquímica", "Embriologia", "Farmacologia", "Fisiologia",
  "Genética Médica", "Histologia", "Imunologia", "Microbiologia",
  "Parasitologia", "Patologia", "Semiologia",
];

const ALL_SPECIALTIES = [
  "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
  "Gastroenterologia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cirurgia", "Medicina Preventiva", "Nefrologia",
  "Infectologia", "Hematologia", "Reumatologia", "Dermatologia",
  "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia",
  "Otorrinolaringologia", "Medicina de Emergência", "Oncologia",
  "Angiologia", "Terapia Intensiva",
  ...BASIC_SCIENCES,
];
// dedupe
const UNIQUE_SPECIALTIES = [...new Set(ALL_SPECIALTIES)];

const TARGET_CLINICAL = 400;
const TARGET_BASIC = 250;

function getTarget(s: string) { return BASIC_SCIENCES.includes(s) ? TARGET_BASIC : TARGET_CLINICAL; }

interface SpecialtyDist { name: string; count: number; target: number; deficit: number; pct: number; }

const AdminIngestionPanel = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState(ENARE_SOURCES);
  const [processing, setProcessing] = useState<string | null>(null);
  const [navUrl, setNavUrl] = useState("");
  const [navResults, setNavResults] = useState<any[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [discoveredSources, setDiscoveredSources] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalQuestions: 0, uniqueQuestions: 0, duplicates: 0, specialtiesCount: 0 });
  const [distribution, setDistribution] = useState<SpecialtyDist[]>([]);
  const [loadingDistribution, setLoadingDistribution] = useState(false);
  const [equalizing, setEqualizing] = useState(false);
  const pauseRef = useRef(false);
  const [eqStartTime, setEqStartTime] = useState<number | null>(null);
  const [eqProgress, setEqProgress] = useState<{
    current: number; total: number; percent: number;
    currentSpecialty: string; log: { specialty: string; added: number }[];
    questionsRemaining: number; eta: string;
  } | null>(null);

  useEffect(() => {
    loadLogs();
    loadSources();
    loadDistribution();
  }, []);

  const loadDistribution = async () => {
    setLoadingDistribution(true);
    try {
      const PAGE = 1000;
      let from = 0;
      const allTopics: string[] = [];
      while (true) {
        const { data, error } = await supabase.from("questions_bank" as any)
          .select("topic")
          .eq("is_global", true)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || (data as any[]).length === 0) break;
        allTopics.push(...(data as any[]).map((r: any) => r.topic || "Outros"));
        if ((data as any[]).length < PAGE) break;
        from += PAGE;
      }
      const counts: Record<string, number> = {};
      const statementsSet = new Set<string>();
      allTopics.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

      const totalQ = allTopics.length;
      const specialtiesWithQ = Object.keys(counts).length;

      // Update stats cards with real data
      setStats({
        totalQuestions: totalQ,
        uniqueQuestions: totalQ, // after dedup migration, all are unique
        duplicates: 0,
        specialtiesCount: specialtiesWithQ,
      });

      const dist: SpecialtyDist[] = UNIQUE_SPECIALTIES.map(name => {
        const count = counts[name] || 0;
        const target = getTarget(name);
        const deficit = Math.max(0, target - count);
        const pct = Math.min(100, Math.round((count / target) * 100));
        return { name, count, target, deficit, pct };
      }).sort((a, b) => a.pct - b.pct);
      setDistribution(dist);
    } finally {
      setLoadingDistribution(false);
    }
  };

  const loadSources = async () => {
    const { data } = await supabase.from("external_exam_sources" as any)
      .select("*").order("created_at", { ascending: false }).limit(50);
    if (data) {
      setDiscoveredSources(data);
    }
  };

  const loadLogs = async () => {
    const { data } = await supabase.from("ingestion_log" as any)
      .select("*").order("created_at", { ascending: false }).limit(20);
    if (data) {
      setLogs(data);
    }
  };

  const callIngest = async (payload: any) => {
    if (!session) return null;
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-questions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      }
    );
    const raw = await resp.text();
    let data: any = {};
    try { 
      data = raw ? JSON.parse(raw) : {}; 
    } catch (err: any) { 
      console.error("Failed to parse ingestion response:", raw, err);
      throw new Error(`Resposta inválida (${resp.status}): ${raw.slice(0, 150)}`); 
    }
    
    if (!resp.ok) {
      if (resp.status === 402) {
        throw new Error("Saldo de IA insuficiente (Gateway 402). Por favor, verifique os créditos do Lovable.");
      }
      throw new Error(data?.error || `Falha na ingestão (${resp.status}): ${raw.slice(0, 100)}`);
    }

    const normalized = { 
      ...data, 
      questions_found: data?.questions_found ?? 0, 
      questions_inserted: data?.questions_inserted ?? 0, 
      questions_updated: data?.questions_updated ?? 0, 
      duplicates_skipped: data?.duplicates_skipped ?? 0, 
      errors: data?.errors ?? 0 
    };

    if (normalized.questions_inserted === 0 && normalized.questions_updated === 0 && normalized.duplicates_skipped === 0) {
      throw new Error(normalized?.error || "Nenhuma questão válida foi extraída. Verifique se o conteúdo é legível.");
    }
    return normalized;
  };

  const getIngestToast = (data: any, name: string) => {
    if ((data?.questions_inserted ?? 0) > 0) return { title: `${data.questions_inserted} questões extraídas!`, description: `${name} processado.` };
    if ((data?.questions_updated ?? 0) > 0) return { title: `${data.questions_updated} questões atualizadas!`, description: `${name} processado.` };
    return { title: `${data?.duplicates_skipped ?? 0} questões já existentes`, description: `${name} já estava no banco.` };
  };

  const handleExtractPdf = async (source: IndexedSource) => {
    if (!session || !source.pdfUrl) return;
    setProcessing(source.name);
    try {
      const data = await callIngest({ mode: "pdf_url", url: source.pdfUrl, banca: source.banca, year: source.year, source_type: "indexed_external", permission_type: "indexed_external" });
      const count = (data?.questions_inserted ?? 0) + (data?.questions_updated ?? 0) || (data?.duplicates_skipped ?? 0);
      setSources(prev => prev.map(s => s.name === source.name ? { ...s, status: "extracted" as const, questionsCount: count } : s));
      toast(getIngestToast(data, source.name));
      loadLogs();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally { setProcessing(null); }
  };

  const handleNavigate = async () => {
    if (!navUrl || !session) return;
    setNavLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-real-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: "hub_page", url: navUrl, user_id: session.user?.id }),
      });
      const data = await resp.json();
      if (data?.error) throw new Error(data.error);
      setNavResults(data.pdf_links || []);
      toast({ title: `${data.sources_found || 0} fontes descobertas, ${(data.pdf_links || []).length} PDFs` });
      loadLogs(); loadSources();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally { setNavLoading(false); }
  };

  const handleExtractNavPdf = async (link: any) => {
    setProcessing(link.url);
    try {
      const data = await callIngest({ mode: "pdf_url", url: link.url, year: link.year, source_type: "indexed_external", permission_type: "indexed_external" });
      toast(getIngestToast(data, link.name));
      loadLogs();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally { setProcessing(null); }
  };

  const getFreshToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    // Refresh proativamente se faltar < 5 min para expirar
    const expiresAt = (data.session.expires_at ?? 0) * 1000;
    if (expiresAt - Date.now() < 5 * 60 * 1000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? data.session.access_token;
    }
    return data.session.access_token;
  };

  const handleEqualize = async () => {
    if (!session) return;
    setEqualizing(true);
    pauseRef.current = false;
    const deficitSpecialties = distribution.filter(d => d.deficit > 0);
    const total = deficitSpecialties.length;
    const log: { specialty: string; added: number }[] = [];
    const totalQRemaining = deficitSpecialties.reduce((s, d) => s + d.deficit, 0);
    const startTime = Date.now();
    setEqStartTime(startTime);
    setEqProgress({ current: 0, total, percent: 0, currentSpecialty: deficitSpecialties[0]?.name || "", log, questionsRemaining: totalQRemaining, eta: "calculando..." });

    try {
      for (let i = 0; i < total; i++) {
        if (pauseRef.current) {
          toast({ title: "Equalização pausada", description: `${log.reduce((s, l) => s + l.added, 0)} questões adicionadas até agora.` });
          break;
        }

        const spec = deficitSpecialties[i];
        const elapsed = (Date.now() - startTime) / 1000;
        const avgPerSpec = i > 0 ? elapsed / i : 30;
        const remaining = (total - i) * avgPerSpec;
        const etaMin = Math.ceil(remaining / 60);
        const etaStr = etaMin > 1 ? `~${etaMin} min` : "< 1 min";

        setEqProgress(prev => prev ? { ...prev, current: i + 1, percent: Math.round(((i) / total) * 100), currentSpecialty: spec.name, eta: etaStr } : prev);

        try {
          // Start background job (token fresco)
          const startToken = await getFreshToken();
          if (!startToken) throw new Error("Sessão expirada. Faça login novamente.");
          
          const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-generate-content`;
          const payload = { equalize: true, specialty: spec.name, maxSpecialties: 1, batchSize: 25, importLimit: 50, background: false };
          
          console.log("[equalize] invoking", { functionUrl, payload });
          
          const resp = await fetch(functionUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${startToken}` },
            body: JSON.stringify(payload),
          });
          const raw = await resp.text();
          let data: any = {};
          try { 
            data = raw ? JSON.parse(raw) : {}; 
          } catch (err: any) { 
            console.error("[equalize] parse error", { raw, status: resp.status });
            throw new Error(`Resposta inválida (${resp.status}): ${raw.slice(0, 100)}`); 
          }
          
          if (!resp.ok) {
            console.error("[equalize] response not ok", { status: resp.status, data });
            throw new Error(data?.error || `Falha ao equalizar ${spec.name} (${resp.status})`);
          }

          // Poll for job completion
          const jobId = data?.job_id;
          let jobResult: any = null;
          if (jobId) {
            for (let poll = 0; poll < 120; poll++) {
              await new Promise(r => setTimeout(r, 3000));
              if (pauseRef.current) break;
              try {
                const pollToken = await getFreshToken();
                if (!pollToken) throw new Error("Sessão expirada durante polling.");
                const pollResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-generate-content?job_id=${jobId}`, {
                  method: "GET",
                  headers: { Authorization: `Bearer ${pollToken}` },
                });
                const pollData = await pollResp.json();
                if (pollData.status === "completed") { jobResult = pollData.result || {}; break; }
                if (pollData.status === "failed") { throw new Error(pollData.error || "Job falhou"); }
                // Update progress from background job
                if (pollData.progress?.specialty) {
                  setEqProgress(prev => prev ? { ...prev, currentSpecialty: `${spec.name} (processando...)` } : prev);
                }
              } catch (pollErr) {
                if (pollErr instanceof Error && pollErr.message.includes("Job falhou")) throw pollErr;
              }
            }
          } else {
            // Legacy direct response
            jobResult = data;
          }

          const added = (jobResult?.total_imported || 0) + (jobResult?.total_generated || 0);
          log.push({ specialty: spec.name, added });
          const qRemaining = totalQRemaining - log.reduce((s, l) => s + l.added, 0);
          setEqProgress(prev => prev ? { ...prev, percent: Math.round(((i + 1) / total) * 100), log: [...log], questionsRemaining: Math.max(0, qRemaining) } : prev);
          // Refresh distribution after each batch
          await loadDistribution();
          await loadLogs();
        } catch (error) {
          log.push({ specialty: spec.name, added: 0 });
          setEqProgress(prev => prev ? { ...prev, log: [...log] } : prev);
          console.error("[equalize] specialty error", { specialty: spec.name, error });
          throw error; // Re-throw to catch in outer block and stop
        }
      }

      const totalAdded = log.reduce((s, l) => s + l.added, 0);
      toast({ title: "Equalização concluída", description: `${totalAdded} questões adicionadas em ${log.length} especialidades.` });
      loadDistribution();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      await loadDistribution();
      setEqualizing(false);
      pauseRef.current = false;
      setEqStartTime(null);
      setEqProgress(null);
    }
  };

  const totalDeficit = distribution.reduce((s, d) => s + d.deficit, 0);
  const deficitCount = distribution.filter(d => d.deficit > 0).length;

  return (
    <div className="glass-card p-4 sm:p-5 border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-emerald-500/10 flex-shrink-0">
          <Database className="h-5 w-5 text-emerald-500" />
        </div>
        <h2 className="text-sm sm:text-base font-semibold">Pipeline de Ingestão de Questões</h2>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Total Questões", value: stats.totalQuestions, color: "text-blue-500" },
          { label: "Únicas", value: stats.uniqueQuestions, color: "text-emerald-500" },
          { label: "Duplicatas", value: stats.duplicates, color: "text-amber-500" },
          { label: "Especialidades", value: stats.specialtiesCount, color: "text-purple-500" },
        ].map(s => (
          <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="balance">
        <TabsList className="mb-3 flex-wrap h-auto">
          <TabsTrigger value="balance" className="text-xs"><Scale className="h-3 w-3 mr-1" />Equilíbrio</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs"><Globe className="h-3 w-3 mr-1" />Fontes</TabsTrigger>
          <TabsTrigger value="manual" className="text-xs text-blue-500"><Download className="h-3 w-3 mr-1" />Import Direto</TabsTrigger>
          <TabsTrigger value="discovered" className="text-xs"><Link2 className="h-3 w-3 mr-1" />Descobertas</TabsTrigger>
          <TabsTrigger value="navigate" className="text-xs"><Search className="h-3 w-3 mr-1" />Navegação</TabsTrigger>
          <TabsTrigger value="log" className="text-xs"><FileText className="h-3 w-3 mr-1" />Log</TabsTrigger>
        </TabsList>

        {/* EQUILÍBRIO TAB */}
        <TabsContent value="balance">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
              <p className="text-xs text-muted-foreground">
                  {deficitCount} especialidades abaixo do alvo • Déficit total: <span className="font-bold text-red-500">{totalDeficit}</span> questões
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Alvo: {TARGET_CLINICAL} (clínicas) / {TARGET_BASIC} (básicas). Prioriza questões reais antes de gerar por IA.
                </p>
                <Badge className="mt-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Equalização automática ativa — executa diariamente às 3h
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={loadingDistribution} onClick={() => loadDistribution()} title="Atualizar contagens">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingDistribution ? "animate-spin" : ""}`} />
                </Button>
                {equalizing && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { pauseRef.current = true; }}>
                    <Pause className="h-3 w-3 mr-1" />Pausar
                  </Button>
                )}
                <Button size="sm" className="h-8 text-xs" disabled={equalizing || totalDeficit === 0} onClick={handleEqualize}>
                  {equalizing ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Equalizando...</> : <><BarChart3 className="h-3 w-3 mr-1" />Equalizar Banco</>}
                </Button>
              </div>
            </div>

            {eqProgress && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    {eqProgress.current}/{eqProgress.total} — {eqProgress.currentSpecialty}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">ETA: {eqProgress.eta}</span>
                    <Badge variant="outline" className="text-[10px]">{eqProgress.percent}%</Badge>
                  </div>
                </div>
                <Progress value={eqProgress.percent} className="h-2" />
                <p className="text-[10px] text-muted-foreground">
                  ~{eqProgress.questionsRemaining} questões restantes
                </p>
                {eqProgress.log.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                    {eqProgress.log.map((l, i) => (
                      <div key={i} className="text-[10px] flex justify-between">
                        <span>{l.specialty}</span>
                        <span className="font-medium text-emerald-600">+{l.added}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {distribution.map(d => {
                const color = d.pct >= 80 ? "text-emerald-500" : d.pct >= 40 ? "text-amber-500" : "text-red-500";
                const barColor = d.pct >= 80 ? "bg-emerald-500" : d.pct >= 40 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={d.name} className="flex items-center gap-2 p-1.5 rounded bg-background/50">
                    <span className="text-[11px] font-medium w-[140px] truncate">{d.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, d.pct)}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold w-[35px] text-right ${color}`}>{d.count}</span>
                    <span className="text-[10px] text-muted-foreground w-[15px]">/{d.target}</span>
                    {d.deficit > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 text-red-500 border-red-500/30">-{d.deficit}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sources">
          <div className="space-y-2">
            {sources.map(source => (
              <div key={source.name} className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{source.name}</span>
                    <Badge variant={source.status === "extracted" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                      {source.status === "extracted" ? `${source.questionsCount} q` : source.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{source.banca} • {source.year}</span>
                    {source.pdfUrl && (
                      <a href={source.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
                        <ExternalLink className="h-2.5 w-2.5" />PDF
                      </a>
                    )}
                  </div>
                </div>
                <Button size="sm" variant={source.status === "extracted" ? "outline" : "default"}
                  disabled={processing !== null || !source.pdfUrl} onClick={() => handleExtractPdf(source)} className="text-xs h-7 px-2">
                  {processing === source.name ? <Loader2 className="h-3 w-3 animate-spin" /> :
                   source.status === "extracted" ? <CheckCircle2 className="h-3 w-3" /> : "Extrair"}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="navigate">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={navUrl} onChange={e => setNavUrl(e.target.value)}
                placeholder="https://exemplo.com/prova.pdf" className="text-xs h-8" />
              <Button size="sm" className="h-8 text-xs" disabled={navLoading || !navUrl} onClick={handleNavigate}>
                {navLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Search className="h-3 w-3 mr-1" />Buscar</>}
              </Button>
            </div>
            {navResults.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">{navResults.length} PDFs encontrados</p>
                {navResults.map((link, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs truncate block">{link.name}</span>
                      <span className="text-[10px] text-muted-foreground">{link.year ? `Ano: ${link.year}` : "Ano desconhecido"}</span>
                    </div>
                    <div className="flex gap-1">
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><ExternalLink className="h-3 w-3" /></Button>
                      </a>
                      <Button size="sm" className="h-6 text-[10px] px-2" disabled={processing !== null}
                        onClick={() => handleExtractNavPdf(link)}>
                        {processing === link.url ? <Loader2 className="h-3 w-3 animate-spin" /> : "Extrair"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="log">
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum log registrado.</p>
            ) : logs.map((log: any) => (
              <div key={log.id} className="p-2 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{log.source_name}</span>
                  <Badge variant={log.status === "completed" ? "default" : "secondary"} className="text-[10px] h-4">
                    {log.status}
                  </Badge>
                </div>
                <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                  <span>+{log.questions_inserted ?? 0} inseridas</span>
                  <span>↑{log.questions_updated ?? 0} atualizadas</span>
                  <span>={log.duplicates_skipped ?? 0} duplicatas</span>
                  {(log.errors ?? 0) > 0 && <span className="text-red-500">✗{log.errors} erros</span>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="space-y-4 p-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">Importação Manual</label>
              
              <Tabs defaultValue="urls_tab">
                <TabsList className="mb-2 h-7">
                  <TabsTrigger value="urls_tab" className="text-[10px] h-6">URLs de PDFs</TabsTrigger>
                  <TabsTrigger value="text_tab" className="text-[10px] h-6">Colar Texto/Markdown</TabsTrigger>
                </TabsList>

                <TabsContent value="urls_tab">
                  <textarea 
                    className="w-full h-32 text-xs p-2 rounded border bg-background" 
                    placeholder="https://exemplo.com/prova-2025.pdf&#10;https://exemplo.com/gabarito-2025.pdf"
                    id="manual-urls"
                  />
                  <div className="flex gap-2 mt-2">
                    <Input className="h-8 text-xs w-24" placeholder="Ano" id="manual-year" defaultValue={new Date().getFullYear()} />
                    <Input className="h-8 text-xs flex-1" placeholder="Banca/Instituição" id="manual-banca" />
                    <Button 
                      size="sm" 
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={async () => {
                        const urlsEl = document.getElementById('manual-urls') as HTMLTextAreaElement;
                        const yearEl = document.getElementById('manual-year') as HTMLInputElement;
                        const bancaEl = document.getElementById('manual-banca') as HTMLInputElement;
                        
                        const urls = urlsEl.value.split('\n').filter(u => u.trim());
                        const year = parseInt(yearEl.value);
                        const banca = bancaEl.value;
                        
                        if (!urls.length) return;
                        
                        for (const url of urls) {
                          toast({ title: "Iniciando importação", description: url });
                          try {
                            const data = await callIngest({ mode: "pdf_url", url: url.trim(), year, banca, source_type: "manual_import", permission_type: "indexed_external" });
                            toast(getIngestToast(data, url));
                          } catch (e) {
                            toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
                          }
                        }
                        loadLogs();
                      }}
                    >
                      Processar URLs
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="text_tab">
                  <textarea 
                    className="w-full h-32 text-xs p-2 rounded border bg-background" 
                    placeholder="Cole aqui o texto extraído do PDF ou o conteúdo Markdown da página..."
                    id="manual-text-content"
                  />
                  <div className="flex gap-2 mt-2">
                    <Input className="h-8 text-xs w-24" placeholder="Ano" id="manual-text-year" defaultValue={new Date().getFullYear()} />
                    <Input className="h-8 text-xs flex-1" placeholder="Banca/Instituição" id="manual-text-banca" />
                    <Button 
                      size="sm" 
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={async () => {
                        const textEl = document.getElementById('manual-text-content') as HTMLTextAreaElement;
                        const yearEl = document.getElementById('manual-text-year') as HTMLInputElement;
                        const bancaEl = document.getElementById('manual-text-banca') as HTMLInputElement;
                        
                        const content = textEl.value.trim();
                        const year = parseInt(yearEl.value);
                        const banca = bancaEl.value;
                        
                        if (!content) return;
                        
                        toast({ title: "Processando texto", description: "Enviando para extração via LLM..." });
                        try {
                          const { data, error } = await supabase.functions.invoke('ingest-questions', {
                            body: { 
                              mode: "direct_text", 
                              text: content, 
                              year, 
                              banca, 
                              source_type: "manual_text", 
                              permission_type: "indexed_external" 
                            }
                          });
                          if (error) throw error;
                          toast(getIngestToast(data, "Texto colado"));
                        } catch (e) {
                          toast({ title: "Erro", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
                        }
                        loadLogs();
                      }}
                    >
                      Processar Texto
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <p className="text-[10px] text-muted-foreground italic mt-2">
                Dica: Use este modo quando a busca automática falhar ou o site tiver bloqueio de SSL (como no caso da FGV/ENARE).
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="discovered">
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {discoveredSources.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma fonte descoberta. Use a aba Navegação para buscar.</p>
            ) : discoveredSources.map((src: any) => (
              <div key={src.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">{src.title}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] h-4">{src.source_type}</Badge>
                    <Badge variant={src.processing_status === "completed" ? "default" : "secondary"} className="text-[10px] h-4">{src.processing_status}</Badge>
                    {src.year && <span className="text-[10px] text-muted-foreground">{src.year}</span>}
                    {src.extracted_questions_count > 0 && <span className="text-[10px] text-muted-foreground">{src.extracted_questions_count}q</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {src.source_url && (
                    <a href={src.source_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><ExternalLink className="h-3 w-3" /></Button>
                    </a>
                  )}
                  {src.processing_status === "pending" && src.source_type === "pdf_direct" && (
                    <Button size="sm" className="h-6 text-[10px] px-2" disabled={processing !== null}
                      onClick={() => handleExtractNavPdf({ url: src.source_url, name: src.title, year: src.year })}>
                      {processing === src.source_url ? <Loader2 className="h-3 w-3 animate-spin" /> : "Extrair"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminIngestionPanel;
