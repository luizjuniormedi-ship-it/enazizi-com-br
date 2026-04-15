import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crosshair, ArrowRight } from "lucide-react";

interface Props {
  weakestArea: string;
  weakestSubtopic?: string;
}

export default function FocusCard({ weakestArea, weakestSubtopic }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border border-border/50 bg-destructive/5 p-5 space-y-3 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Crosshair className="h-4 w-4 text-destructive/70" />
        <span className="text-xs font-semibold uppercase tracking-wider">Foco do dia</span>
      </div>

      <div className="space-y-1">
        <p className="text-lg font-bold text-foreground">{weakestArea || "Nenhuma fraqueza detectada"}</p>
        {weakestSubtopic && (
          <p className="text-sm text-muted-foreground">{weakestSubtopic}</p>
        )}
      </div>

      {weakestArea && (
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => navigate("/dashboard/banco-erros")}
          >
            Treinar agora <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
