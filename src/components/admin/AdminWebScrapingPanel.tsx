import { useState, useCallback, useRef, useEffect } from "react";
import { Globe, Search, Loader2, CheckCircle2, AlertTriangle, PlayCircle, XCircle, Bot, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SPECIALTIES = [
  "Angiologia", "Cardiologia", "Cirurgia Geral", "Dermatologia",
  "Endocrinologia", "Gastroenterologia", "Ginecologia e Obstetrícia",
  "Hematologia", "Infectologia", "Medicina Preventiva", "Nefrologia",
  "Neurologia", "Oftalmologia", "Oncologia", "Ortopedia",
  "Otorrinolaringologia", "Pediatria", "Pneumologia", "Psiquiatria",
  "Reumatologia", "Urologia",
];

const BANCAS = [
  "REVALIDA INEP", "ENAMED", "ENARE", "USP", "UNICAMP", "SUS-SP", "Santa Casa SP", "AMRIGS",
];

interface ScrapeResult {
  specialty: string;
  questions_inserted: number;
  sources_used: string[];
  pages_scraped: number;
}

interface BulkResult {
  specialty: string;
  questions: number;
  error?: string;
}

interface BankMetrics {
  total: number;
  real: number;
  ai: number;
  realPct: string;
}

const AdminWebScrapingPanel = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [specialty, setSpecialty] = useState("Cardiologia");
  const [banca, setBanca] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bankMetrics, setBankMetrics] = useState<BankMetrics>({ total: 0, real: 0, ai: 0, realPct: "0" });

  // Bulk search state
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkCurrent, setBulkCurrent] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      const [totalRes, realRes] = await Promise.all([
        supabase.from("questions_bank").select("*", { count: "exact", head: true }).eq("is_global", true),
        supabase.from("questions_bank").select("*", { count: "exact", head: true }).eq("is_global", true)
          .or("exam_bank_id.not.is.null,source_type.eq.indexed_external,source_url.not.is.null"),
      ]);
      const total = totalRes.count || 0;
      const real = realRes.count || 0;
      const ai = total - real;
      setBankMetrics({ total, real, ai, realPct: total > 0 ? ((real / total) * 100).toFixed(1) : "0" });
    };
    fetchMetrics();
  }, [result, bulkResults]);

  const searchSingle = useCallback(async (spec: string, bancaVal: string | null): Promise<ScrapeResult | null> => {
    if (!session) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-real-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            specialty: spec,
            banca: bancaVal === "all" ? null : bancaVal,
          }),
          signal: controller.signal,
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro na busca");
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [session]);

  const handleSearch = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await searchSingle(specialty, banca);
      if (data) {
        setResult(data);
        toast({
          title: `${data.questions_inserted ?? 0} questões encontradas!`,
          description: `${data.pages_scraped ?? 0} páginas analisadas de fontes oficiais.`,
        });
      }
    } catch (e: any) {
      const isTimeout = e instanceof TypeError && /load failed|abort|timeout/i.test(e.message);
      let msg = isTimeout
        ? "A busca demorou demais e foi cancelada. Tente novamente ou escolha outra especialidade."
        : (e instanceof Error ? e.message : "Erro desconhecido");
      
      if (msg.includes("FIRECRAWL_API_KEY")) {
        msg = "Configuração ausente: FIRECRAWL_API_KEY não encontrada no Supabase. O Web Scraping automático requer esta chave.";
      }
      
      setError(msg);
      toast({ title: "Erro de Configuração", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, specialty, banca, toast, searchSingle]);

  const handleBulkSearch = useCallback(async () => {
    if (!session) return;
    cancelRef.current = false;
    setBulkRunning(true);
    setBulkResults([]);
    setBulkProgress(0);
    setBulkCurrent("");

    const results: BulkResult[] = [];
    for (let i = 0; i < SPECIALTIES.length; i++) {
      if (cancelRef.current) break;
      const spec = SPECIALTIES[i];
      setBulkCurrent(spec);
      setBulkProgress(((i) / SPECIALTIES.length) * 100);

      try {
        const data = await searchSingle(spec, null);
        results.push({ specialty: spec, questions: data?.questions_inserted || 0 });
      } catch {
        results.push({ specialty: spec, questions: 0, error: "falhou" });
      }
      setBulkResults([...results]);

      if (i < SPECIALTIES.length - 1 && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    setBulkProgress(100);
    setBulkCurrent("");
    setBulkRunning(false);

    const total = results.reduce((s, r) => s + r.questions, 0);
    toast({
      title: `Busca geral concluída!`,
      description: `${total} questões inseridas em ${results.filter(r => r.questions > 0).length} especialidades.`,
    });
  }, [session, searchSingle, toast]);

  const handleCancelBulk = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const bulkTotal = bulkResults.reduce((s, r) => s + r.questions, 0);

  return (
    <div className="glass-card p-4 sm:p-5 border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-transparent">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-blue-500/10 flex-shrink-0">
          <Globe className="h-5 w-5 text-blue-500" />
        </div>
        <h2 className="text-sm sm:text-base font-semibold">Buscar Questões Reais (Web Scraping)</h2>
      </div>

      {/* Bank metrics header */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Banco global:</span>
        <span className="text-sm font-bold">{bankMetrics.total.toLocaleString()}</span>
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
          <Globe className="h-2.5 w-2.5" />
          {bankMetrics.real.toLocaleString()} reais
        </Badge>
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] gap-1">
          <Bot className="h-2.5 w-2.5" />
          {bankMetrics.ai.toLocaleString()} IA
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {bankMetrics.realPct}% real
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground mb-1">
        Busca questões reais de provas de residência em sites oficiais (INEP, universidades, portais) usando Firecrawl.
      </p>
      <div className="flex items-center gap-1.5 mb-3">
        <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30 bg-amber-500/5">
          Requer FIRECRAWL_API_KEY
        </Badge>
        <span className="text-[9px] text-muted-foreground italic">
          Sem a chave, use o "Import Direto" no Pipeline de Ingestão.
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTIES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={banca} onValueChange={setBanca}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Banca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as bancas</SelectItem>
            {BANCAS.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={handleSearch}
          disabled={loading || bulkRunning}
          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Buscando..." : "Buscar"}
        </Button>

        {!bulkRunning ? (
          <Button
            size="sm"
            onClick={handleBulkSearch}
            disabled={loading || bulkRunning}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <PlayCircle className="h-4 w-4" />
            Buscar Todas (21)
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleCancelBulk}
            variant="destructive"
            className="gap-1.5"
          >
            <XCircle className="h-4 w-4" />
            Cancelar
          </Button>
        )}
      </div>

      {/* Bulk progress */}
      {bulkRunning && (
        <div className="space-y-2 mb-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              Buscando {bulkResults.length + 1}/{SPECIALTIES.length}: {bulkCurrent}
            </span>
            <span className="text-muted-foreground">{bulkTotal} questões</span>
          </div>
          <Progress value={bulkProgress} className="h-2" />
        </div>
      )}

      {/* Bulk results summary */}
      {!bulkRunning && bulkResults.length > 0 && (
        <div className="space-y-2 mb-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">{bulkTotal} questões inseridas no total</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {bulkResults.map((r) => (
              <div key={r.specialty} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-background/50">
                <span className={r.error ? "text-destructive" : ""}>{r.specialty}</span>
                <Badge variant={r.questions > 0 ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                  {r.error ? "erro" : r.questions}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-2 mt-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">
              {result.questions_inserted} questões inseridas
            </span>
            <Badge variant="secondary" className="text-xs">
              {result.pages_scraped} páginas
            </Badge>
          </div>
          {result.sources_used.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Fontes utilizadas:</span>
              {result.sources_used.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-500 hover:underline truncate"
                >
                  {url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}
    </div>
  );
};

export default AdminWebScrapingPanel;
