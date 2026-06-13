import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, FolderSearch, Play, RefreshCw } from "lucide-react";

interface QueueRow {
  id: string;
  drive_file_id: string;
  file_name: string;
  folder_path: string | null;
  specialty: string | null;
  file_size: number | null;
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  skip_reason: string | null;
  error_message: string | null;
  retry_count: number;
  chunks_count: number | null;
  processed_at: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
  skipped: "secondary",
};

export default function DriveCorpusAdmin() {
  const [folderId, setFolderId] = useState("1apsS3Jlbory-Or9cUQSDGpdPTZhaK9vY");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 });

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("drive_corpus_queue" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data || []) as any);

    const { data: stats } = await supabase
      .from("drive_corpus_queue" as any)
      .select("status");
    const c = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
    (stats || []).forEach((r: any) => { c[r.status as keyof typeof c]++; });
    setCounts(c);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleScan() {
    if (!folderId.trim()) { toast.error("Informe o folder_id do Drive"); return; }
    setScanning(true);
    const { data, error } = await supabase.functions.invoke("drive-corpus-scan", {
      body: { folder_id: folderId.trim() },
    });
    setScanning(false);
    if (error) { toast.error(`Scan falhou: ${error.message}`); return; }
    toast.success("Scan iniciado em background. Recarregue em 30s.");
    console.log("[SCAN_RESP]", data);
    setTimeout(loadData, 5000);
  }

  async function handleIngest(batchSize = 5) {
    setIngesting(true);
    const { data, error } = await supabase.functions.invoke("drive-corpus-ingest", {
      body: { batch_size: batchSize },
    });
    setIngesting(false);
    if (error) { toast.error(`Ingestão falhou: ${error.message}`); return; }
    toast.success(`Lote: ${(data as any)?.status || "ok"} (${(data as any)?.processed || 0} processados)`);
    loadData();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drive Corpus — Ingestão</h1>
        <p className="text-muted-foreground mt-1">
          Pipeline: Drive PDF → Gemini (extração) → Claude (estruturação) → OpenAI (embedding) → RAG isolado (<code>source_type=drive_corpus</code>).
          Não afeta o RAG Global de 20 materiais.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["pending", "processing", "completed", "failed", "skipped"] as const).map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{s}</div>
              <div className="text-2xl font-bold">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderSearch className="h-5 w-5" /> 1. Escanear pasta do Drive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="folder_id (ex: 1apsS3Jl...)"
            />
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Escanear"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Lista recursivo. PDFs com nomes contendo Harrison/Nelson/Sabiston/Robbins/Guyton/Netter/Cecil são marcados como <code>skipped</code> automaticamente (copyright).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" /> 2. Processar lote</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => handleIngest(5)} disabled={ingesting}>
            {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Processar 5"}
          </Button>
          <Button onClick={() => handleIngest(1)} disabled={ingesting} variant="outline">
            Processar 1 (teste)
          </Button>
          <Button onClick={loadData} variant="ghost" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[280px] truncate" title={r.file_name}>{r.file_name}</TableCell>
                  <TableCell>{r.specialty || "—"}</TableCell>
                  <TableCell>{r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(1)}MB` : "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell>{r.chunks_count ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                    {r.skip_reason || r.error_message || (r.processed_at ? `OK ${new Date(r.processed_at).toLocaleString("pt-BR")}` : "—")}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Vazio. Rode um scan primeiro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
