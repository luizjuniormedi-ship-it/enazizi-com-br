import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Snowflake,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FreezeCheckResult {
  ok: boolean;
  generated_at: string;
  flags: {
    ok: boolean;
    enabled_count: number;
    items: Array<{ flag_key: string; enabled: boolean; rollout_mode: string | null }>;
  };
  shadow_events: {
    ok: boolean;
    total: number;
    by_event: Array<{ event_name: string; count: number; last_at: string | null }>;
    by_source_property: number;
    last_at: string | null;
  };
  shadow_decisions: {
    ok: boolean;
    total: number;
    last_at: string | null;
    table_present: boolean;
  };
  summary: { contamination_detected: boolean; reasons: string[] };
}

/**
 * Banner admin-only que monitora a integridade do freeze observacional.
 *
 * Apenas-leitura: chama a edge function `baseline-freeze-check` (gated por
 * has_role admin) e exibe o estado. Nenhuma flag é alterada, nenhum dado é
 * apagado. O componente NÃO toca a jornada do aluno.
 */
export default function BaselineFreezeAlert() {
  const [data, setData] = useState<FreezeCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: invokeErr } = await supabase.functions.invoke(
        "baseline-freeze-check",
        { body: {} },
      );
      if (invokeErr) throw invokeErr;
      if (res?.error) throw new Error(res.error);
      setData(res as FreezeCheckResult);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  if (loading && !data) {
    return (
      <Alert className="border-muted-foreground/20">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Verificando integridade do freeze observacional…</AlertTitle>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Falha ao verificar freeze observacional</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span className="text-xs">{error}</span>
          <Button size="sm" variant="outline" onClick={run}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const contaminated = data.summary.contamination_detected;
  const generated = new Date(data.generated_at).toLocaleString("pt-BR");

  return (
    <Alert
      variant={contaminated ? "destructive" : "default"}
      className={
        contaminated
          ? "border-destructive/40"
          : "border-emerald-500/30 bg-emerald-500/5"
      }
    >
      {contaminated ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
      )}
      <AlertTitle className="flex items-center gap-2">
        <Snowflake className="h-3.5 w-3.5" />
        {contaminated
          ? "⚠️ Contaminação da baseline detectada"
          : "Freeze observacional íntegro"}
        <Badge variant="outline" className="ml-auto text-[10px] font-mono">
          {generated}
        </Badge>
      </AlertTitle>

      <AlertDescription className="space-y-3 mt-2">
        {contaminated ? (
          <ul className="list-disc list-inside text-xs space-y-1">
            {data.summary.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma flag shadow ativa, nenhum evento <code>shadow_%</code> gravado e
            nenhuma decisão <code>shadow-adaptive-v1</code> registrada. Baseline preservada.
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 px-2 text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" /> ocultar detalhes
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" /> ver detalhes
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={run}
            disabled={loading}
            className="h-7 px-2 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            re-checar
          </Button>
        </div>

        {expanded && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            {/* Flags */}
            <div className="rounded border bg-background/60 p-2">
              <div className="font-semibold flex items-center gap-1 mb-1">
                Flags shadow{" "}
                <Badge variant={data.flags.ok ? "secondary" : "destructive"} className="text-[10px]">
                  {data.flags.enabled_count} ativa(s)
                </Badge>
              </div>
              <ul className="space-y-0.5">
                {data.flags.items.length === 0 && (
                  <li className="text-muted-foreground">Nenhum registro encontrado.</li>
                )}
                {data.flags.items.map((f) => (
                  <li key={f.flag_key} className="flex justify-between gap-2">
                    <span className="font-mono">{f.flag_key}</span>
                    <span className={f.enabled ? "text-destructive font-semibold" : "text-muted-foreground"}>
                      {f.enabled ? "ON" : "off"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Shadow events */}
            <div className="rounded border bg-background/60 p-2">
              <div className="font-semibold flex items-center gap-1 mb-1">
                Eventos shadow (30d){" "}
                <Badge
                  variant={data.shadow_events.ok ? "secondary" : "destructive"}
                  className="text-[10px]"
                >
                  {data.shadow_events.total + data.shadow_events.by_source_property}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                event_name <code>shadow_%</code>: {data.shadow_events.total}
              </p>
              <p className="text-muted-foreground">
                properties.source = <code>shadow-adaptive-v1</code>: {data.shadow_events.by_source_property}
              </p>
              {data.shadow_events.by_event.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {data.shadow_events.by_event.slice(0, 5).map((e) => (
                    <li key={e.event_name} className="flex justify-between gap-2">
                      <span className="font-mono truncate">{e.event_name}</span>
                      <span>{e.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Decisions */}
            <div className="rounded border bg-background/60 p-2">
              <div className="font-semibold flex items-center gap-1 mb-1">
                assistant_decisions{" "}
                <Badge
                  variant={data.shadow_decisions.ok ? "secondary" : "destructive"}
                  className="text-[10px]"
                >
                  {data.shadow_decisions.total}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                source_module = <code>shadow-adaptive-v1</code>
              </p>
              {data.shadow_decisions.last_at && (
                <p className="text-muted-foreground mt-1">
                  Último: {new Date(data.shadow_decisions.last_at).toLocaleString("pt-BR")}
                </p>
              )}
              {!data.shadow_decisions.table_present && (
                <p className="text-amber-600 mt-1">Tabela ausente</p>
              )}
            </div>
          </div>
        )}

        {contaminated && (
          <p className="text-[11px] text-muted-foreground border-t pt-2 mt-2">
            <strong>Importante:</strong> este alerta é apenas-leitura. Nenhuma flag
            foi alterada e nenhum dado foi apagado automaticamente. Avalie a causa
            raiz antes de qualquer ação manual.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
