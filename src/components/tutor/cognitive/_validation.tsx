import { AlertTriangle } from "lucide-react";

/**
 * Helpers de validação para blocos cognitivos do Tutor IA.
 * Sanitiza payloads vindos da IA, evitando crashes na renderização.
 */

const isDev = import.meta.env.DEV;

export function devWarn(component: string, msg: string, extra?: unknown) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(`[${component}] ${msg}`, extra ?? "");
  }
}

export function clamp01(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, v));
}

export function dedupeBy<T>(items: T[], keyFn: (it: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/** Garante array tipado mesmo se o payload vier null/undefined/objeto. */
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** UI de fallback vazio: card discreto com aviso. */
export function CognitiveEmpty({
  title,
  message = "Nenhum dado disponível para este bloco.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground"
    >
      <div className="mb-1 flex items-center gap-1.5 text-foreground/80">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium">{title ?? "Bloco incompleto"}</span>
      </div>
      <p className="leading-snug">{message}</p>
    </div>
  );
}
