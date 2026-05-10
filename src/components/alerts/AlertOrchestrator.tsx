/**
 * AlertOrchestrator
 * Camada única de alertas com priority queue + cooldown + agrupamento.
 * Substitui (gradualmente) SmartAlerts, BehavioralAlerts, SmartAlertCard,
 * SmartNotifications. Não emite alertas próprios — recebe-os via prop ou hook.
 *
 * Uso:
 *   <AlertOrchestrator alerts={alerts} maxVisible={2} />
 *
 * Cada alerta deve carregar:
 *   - id (para dedupe + cooldown)
 *   - priority (0..100, maior = mais urgente)
 *   - severity ('info' | 'warning' | 'critical')
 *   - title, description, action?
 *   - cooldownMinutes? (default 60)
 */
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertSeverity = "info" | "warning" | "critical";

export interface OrchestratedAlert {
  id: string;
  priority: number;
  severity: AlertSeverity;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  cooldownMinutes?: number;
  group?: string;
}

interface Props {
  alerts: OrchestratedAlert[];
  maxVisible?: number;
  className?: string;
}

const COOLDOWN_KEY = "alert_orchestrator:cooldown";

function readCooldowns(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(COOLDOWN_KEY) || "{}");
  } catch {
    return {};
  }
}

function isCooldownActive(id: string, mins: number): boolean {
  const map = readCooldowns();
  const last = map[id];
  if (!last) return false;
  return Date.now() - last < mins * 60_000;
}

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; icon: React.ReactNode; ring: string }> = {
  info: {
    bg: "bg-sky-500/10 border-sky-500/20 text-sky-100",
    icon: <Info className="h-4 w-4 text-sky-400" />,
    ring: "ring-sky-500/30",
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/20 text-amber-100",
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    ring: "ring-amber-500/30",
  },
  critical: {
    bg: "bg-rose-500/10 border-rose-500/20 text-rose-100",
    icon: <AlertCircle className="h-4 w-4 text-rose-400" />,
    ring: "ring-rose-500/30",
  },
};

export function AlertOrchestrator({ alerts, maxVisible = 2, className }: Props) {
  const queue = useMemo(() => {
    // Dedupe by id, filter cooldown, group, sort by priority
    const seen = new Set<string>();
    const groupSeen = new Set<string>();
    const filtered: OrchestratedAlert[] = [];
    const sorted = [...alerts].sort((a, b) => b.priority - a.priority);
    for (const a of sorted) {
      if (seen.has(a.id)) continue;
      if (isCooldownActive(a.id, a.cooldownMinutes ?? 60)) continue;
      if (a.group && groupSeen.has(a.group)) continue;
      seen.add(a.id);
      if (a.group) groupSeen.add(a.group);
      filtered.push(a);
      if (filtered.length >= maxVisible) break;
    }
    return filtered;
  }, [alerts, maxVisible]);

  const dismiss = (a: OrchestratedAlert) => {
    const map = readCooldowns();
    map[a.id] = Date.now();
    try {
      sessionStorage.setItem(COOLDOWN_KEY, JSON.stringify(map));
    } catch {
      /* noop */
    }
    a.onDismiss?.();
  };

  if (queue.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence initial={false}>
        {queue.map((a) => {
          const s = SEVERITY_STYLES[a.severity];
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "relative flex items-start gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md",
                s.bg
              )}
            >
              <div className="mt-0.5">{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold leading-tight">{a.title}</div>
                {a.description && (
                  <div className="text-xs opacity-75 mt-0.5 leading-snug">{a.description}</div>
                )}
                {a.action && (
                  <button
                    onClick={a.action.onClick}
                    className="mt-2 text-[11px] font-bold uppercase tracking-wider underline-offset-4 hover:underline"
                  >
                    {a.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(a)}
                className="text-current opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Dispensar alerta"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default AlertOrchestrator;
