/**
 * Fase 4 — Drenagem IA controlada
 * UI mínima para executar `fase4-ai-drain` em lotes de 100 (chunk 10),
 * exibir o JSON bruto e o checkpoint agregado.
 *
 * Acesso: /admin/fase4-drain (admin only via AdminRoute)
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type DrainResult = Record<string, unknown> & {
  run_id?: string;
  fetched?: number;
  returned?: number;
  applied_auto?: number;
  applied_review?: number;
  applied_low?: number;
  out_of_scope?: number;
  failed?: number;
  avg_confidence?: number;
  coverage_returned_pct?: number;
  chunks_total?: number;
  chunks_empty?: number;
  chunks_retried?: number;
};

interface RunEntry {
  ts: string;
  ok: boolean;
  data: DrainResult | null;
  error: string | null;
  ms: number;
}


export default function Fase4Drain() {
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [batchSize, setBatchSize] = useState(100);
  const [chunkSize, setChunkSize] = useState(10);
  const [n, setN] = useState(1);
  const [checkpoint, setCheckpoint] = useState<string>("");

  const runOnce = async (): Promise<RunEntry> => {
    const ts = new Date().toISOString();
    const t0 = performance.now();
    const { data, error } = await supabase.functions.invoke("fase4-ai-drain", {
      body: { batch_size: batchSize, chunk_size: chunkSize, dry_run: false },
    });
    const ms = Math.round(performance.now() - t0);
    return {
      ts,
      ok: !error,
      data: (data as DrainResult) ?? null,
      error: error ? error.message ?? String(error) : null,
      ms,
    };
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      for (let i = 0; i < n; i++) {
        const r = await runOnce();
        setRuns((prev) => [r, ...prev]);
        if (!r.ok) break;
        // pequena pausa entre lotes
        if (i < n - 1) await new Promise((res) => setTimeout(res, 1500));
      }
    } finally {
      setRunning(false);
    }
  };

  const handleCheckpoint = async () => {
    setCheckpoint("...consultando...");
    try {
      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => any;
        };
      };
      const base = () => sb.from("questions_bank").select("*", { count: "exact", head: true });

      const [
        { count: total },
        { count: classificadas },
        { count: out_of_scope },
        { count: manual_review },
        { count: low_confidence },
        { count: pendentes },
      ] = await Promise.all([
        base(),
        base().not("specialty_id", "is", null),
        base().eq("classification_method", "manual").eq("classification_reason", "out_of_scope"),
        base().eq("classification_reason", "manual_review"),
        base().eq("classification_reason", "low_confidence"),
        base()
          .is("specialty_id", null)
          .eq("classification_method", "skipped")
          .neq("classification_reason", "out_of_scope"),
      ]);

      const t = total ?? 0;
      const c = classificadas ?? 0;
      const o = out_of_scope ?? 0;
      const payload = {
        total: t,
        classificadas: c,
        out_of_scope: o,
        manual_review: manual_review ?? 0,
        low_confidence: low_confidence ?? 0,
        pendentes: pendentes ?? 0,
        cobertura_pct: t > 0 ? +(((c + o) / t) * 100).toFixed(2) : 0,
      };
      setCheckpoint(JSON.stringify(payload, null, 2));
    } catch (e) {
      setCheckpoint(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
    }
  };


  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Fase 4 — Drenagem IA</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Executa <code>fase4-ai-drain</code> com sua sessão admin. Use lotes pequenos
          (100/10) para evitar timeout do gateway.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col text-sm">
            <span className="mb-1">batch_size</span>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value || "0", 10))}
              className="border rounded px-2 py-1 w-24 bg-background"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1">chunk_size</span>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value || "0", 10))}
              className="border rounded px-2 py-1 w-24 bg-background"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1">nº de lotes</span>
            <input
              type="number"
              value={n}
              onChange={(e) => setN(parseInt(e.target.value || "1", 10))}
              className="border rounded px-2 py-1 w-24 bg-background"
            />
          </label>
          <Button onClick={handleRun} disabled={running}>
            {running ? "Rodando..." : `Rodar ${n} lote(s)`}
          </Button>
          <Button variant="outline" onClick={handleCheckpoint} disabled={running}>
            Checkpoint do banco
          </Button>
          <Button
            variant="ghost"
            onClick={() => setRuns([])}
            disabled={running || runs.length === 0}
          >
            Limpar
          </Button>
        </div>
      </Card>

      {checkpoint && (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Checkpoint (questions_pool)</h2>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto whitespace-pre-wrap">
            {checkpoint}
          </pre>
        </Card>
      )}

      <div className="space-y-3">
        {runs.map((r, i) => (
          <Card key={i} className="p-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>{r.ts}</span>
              <span>{r.ms} ms</span>
              <span className={r.ok ? "text-green-600" : "text-red-600"}>
                {r.ok ? "OK" : "ERRO"}
              </span>
            </div>
            <div className="text-xs font-mono mb-1">ERROR:</div>
            <pre className="text-xs bg-muted p-2 rounded mb-2 overflow-auto">
              {r.error ? r.error : "null"}
            </pre>
            <div className="text-xs font-mono mb-1">RESULT:</div>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto whitespace-pre-wrap">
              {r.data ? JSON.stringify(r.data, null, 2) : "null"}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
