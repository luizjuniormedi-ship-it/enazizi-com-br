import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingUp, Info, X } from "lucide-react";
import { useState } from "react";

export interface SmartAlert {
  id: string;
  type: "warning" | "success" | "info";
  message: string;
}

interface Props {
  alerts: SmartAlert[];
}

const iconMap = {
  warning: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
  success: <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />,
  info: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
};

const bgMap = {
  warning: "bg-amber-500/5 border-amber-500/20",
  success: "bg-emerald-500/5 border-emerald-500/20",
  info: "bg-blue-500/5 border-blue-500/20",
};

export default function SmartAlerts({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = alerts.filter((a) => !dismissed.has(a.id)).slice(0, 2);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {visible.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bgMap[alert.type]}`}
          >
            {iconMap[alert.type]}
            <p className="text-sm text-foreground/80 flex-1">{alert.message}</p>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
