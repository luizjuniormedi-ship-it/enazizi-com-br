/**
 * ReembedAllButton — reprocessa TODAS as memórias em lotes controlados.
 *
 * Fluxo:
 *  1. Modal de confirmação.
 *  2. Primeira chamada com `forceReembed: true` para resetar todas para `pending`
 *     e processar o primeiro lote (limit 25).
 *  3. Loops subsequentes com `retryFailed: true` (cobre falhas e novos pendings)
 *     até `remaining_after === 0`, erro, cancelamento ou MAX_BATCHES.
 *  4. UI mostra progresso, totais e botão Cancelar.
 *
 * Segurança:
 *  - Apenas admin (a página /admin/tutor-memory já é protegida).
 *  - Máximo 100 lotes por execução (parada dura).
 *  - Delay 400ms entre lotes para não estressar a edge / OpenAI.
 *  - Erro silencioso → encerra fluxo sem quebrar UI.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Zap, X, CheckCircle2 } from "lucide-react";

const BATCH_SIZE = 25;
const MAX_BATCHES = 100;
const BATCH_DELAY_MS = 400;

interface BatchResult {
  succeeded: number;
  failed: number;
  skipped: number;
  remaining_after: number;
  total_pending_before: number | null;
}

interface RunState {
  running: boolean;
  totalProcessed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number | null;
  totalInitial: number | null;
  batches: number;
  finished: boolean;
  cancelled: boolean;
  errorMsg: string | null;
}

const INITIAL: RunState = {
  running: false,
  totalProcessed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  remaining: null,
  totalInitial: null,
  batches: 0,
  finished: false,
  cancelled: false,
  errorMsg: null,
};

async function callEmbedder(
  payload: { limit: number; forceReembed?: boolean; retryFailed?: boolean },
): Promise<BatchResult> {
  const { data, error } = await supabase.functions.invoke(
    "tutor-memory-embedder",
    { body: payload },
  );
  if (error) throw new Error(error.message);
  return {
    succeeded: data?.succeeded ?? 0,
    failed: data?.failed ?? 0,
    skipped: data?.skipped ?? 0,
    remaining_after: data?.remaining_after ?? 0,
    total_pending_before: data?.total_pending_before ?? null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ReembedAllButton({ onCompleted }: { onCompleted?: () => void }) {
  const [state, setState] = useState<RunState>(INITIAL);
  const cancelRef = useRef(false);

  const runAll = async () => {
    cancelRef.current = false;
    setState({ ...INITIAL, running: true });

    try {
      // 1º lote: força reset
      const first = await callEmbedder({
        limit: BATCH_SIZE,
        forceReembed: true,
      });

      let agg: RunState = {
        ...INITIAL,
        running: true,
        totalProcessed: first.succeeded + first.failed + first.skipped,
        succeeded: first.succeeded,
        failed: first.failed,
        skipped: first.skipped,
        remaining: first.remaining_after,
        totalInitial: first.total_pending_before,
        batches: 1,
      };
      setState(agg);

      // Continua até remaining=0 / cancel / MAX_BATCHES
      while (
        !cancelRef.current &&
        agg.remaining !== null &&
        agg.remaining > 0 &&
        agg.batches < MAX_BATCHES
      ) {
        await sleep(BATCH_DELAY_MS);
        if (cancelRef.current) break;

        const batch = await callEmbedder({
          limit: BATCH_SIZE,
          retryFailed: true,
        });

        agg = {
          ...agg,
          totalProcessed:
            agg.totalProcessed +
            batch.succeeded +
            batch.failed +
            batch.skipped,
          succeeded: agg.succeeded + batch.succeeded,
          failed: agg.failed + batch.failed,
          skipped: agg.skipped + batch.skipped,
          remaining: batch.remaining_after,
          batches: agg.batches + 1,
        };
        setState(agg);

        // Se um lote inteiro não processou nada, evita loop infinito
        if (
          batch.succeeded + batch.failed + batch.skipped === 0 &&
          batch.remaining_after > 0
        ) {
          agg = { ...agg, errorMsg: "Lote vazio — encerrando para evitar loop." };
          setState(agg);
          break;
        }
      }

      const cancelled = cancelRef.current;
      setState((s) => ({
        ...s,
        running: false,
        finished: true,
        cancelled,
      }));

      if (cancelled) {
        toast.warning(
          `Reprocessamento cancelado · ${agg.totalProcessed} processados`,
        );
      } else {
        toast.success(
          `Reprocessamento concluído · ${agg.succeeded} ok · ${agg.failed} falhas · ${agg.skipped} skipped`,
        );
      }
      onCompleted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      setState((s) => ({ ...s, running: false, finished: true, errorMsg: msg }));
      toast.error(`Falha ao reprocessar: ${msg}`);
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    toast.info("Cancelando após o lote atual…");
  };

  const reset = () => {
    cancelRef.current = false;
    setState(INITIAL);
  };

  const total = state.totalInitial ?? state.totalProcessed;
  const pct =
    total > 0
      ? Math.min(100, Math.round((state.totalProcessed / total) * 100))
      : state.finished
        ? 100
        : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={state.running}
              className="gap-2"
            >
              {state.running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Reprocessar TODOS embeddings
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reprocessar TODOS os embeddings?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai marcar todas as memórias como <code>pending</code> e
                reprocessar embeddings em lotes de {BATCH_SIZE}. Pode levar
                vários minutos. Você pode cancelar a qualquer momento (o lote
                em andamento ainda será concluído).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={runAll}>
                Confirmar e iniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {state.running && (
          <Button variant="outline" size="sm" onClick={cancel} className="gap-2">
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        )}

        {state.finished && !state.running && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Ocultar progresso
          </Button>
        )}
      </div>

      {(state.running || state.finished) && (
        <Card>
          <CardContent className="p-3 md:p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                {state.finished && !state.errorMsg && !state.cancelled ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Loader2
                    className={`h-4 w-4 ${state.running ? "animate-spin" : ""}`}
                  />
                )}
                Lote {state.batches} / {MAX_BATCHES}
              </span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
              <Stat label="Processados" value={state.totalProcessed} />
              <Stat label="OK" value={state.succeeded} tone="success" />
              <Stat label="Falhas" value={state.failed} tone="destructive" />
              <Stat label="Skipped" value={state.skipped} tone="muted" />
              <Stat
                label="Restantes"
                value={state.remaining ?? "—"}
                tone="muted"
              />
            </div>
            {state.errorMsg && (
              <p className="text-xs text-destructive">{state.errorMsg}</p>
            )}
            {state.cancelled && (
              <p className="text-xs text-muted-foreground">
                Cancelado pelo usuário.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "destructive" | "muted";
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border bg-card/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
