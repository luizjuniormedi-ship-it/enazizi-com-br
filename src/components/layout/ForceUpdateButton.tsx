import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { forceAppUpdate, type ForceUpdateStage } from "@/lib/force-app-update";

interface ForceUpdateButtonProps {
  variant?: "sidebar" | "menu";
  collapsed?: boolean;
  onAfterClick?: () => void;
  className?: string;
}

/**
 * Botão "Forçar atualização do app" — destrava clientes presos em bundle/cache antigo.
 * Compatível com Safari iOS, Chrome Android/Desktop, Edge e Firefox.
 */
export const ForceUpdateButton = ({
  variant = "menu",
  collapsed = false,
  onAfterClick,
  className,
}: ForceUpdateButtonProps) => {
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setStatusLabel("Atualizando aplicativo…");
    const toastId = toast.loading("Atualizando aplicativo…");

    try {
      await forceAppUpdate({
        onStage: (_stage: ForceUpdateStage, label) => {
          setStatusLabel(label);
          toast.loading(label, { id: toastId });
        },
      });
      onAfterClick?.();
    } catch (error) {
      console.error("[ForceUpdateButton] failed", error);
      setStatusLabel("Falha — tente novamente");
      toast.error("Falha ao atualizar — tente novamente", { id: toastId });
      setBusy(false);
    }
  };

  const showLabel = !collapsed;
  const label = busy ? (statusLabel ?? "Atualizando…") : "Forçar atualização";

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleClick}
        disabled={busy}
        title="Forçar atualização do app"
        aria-label="Forçar atualização do app"
        className={cn(
          "flex items-center rounded-xl text-sm text-muted-foreground/60 hover:bg-sidebar-accent/40 transition-colors w-full disabled:opacity-60",
          collapsed ? "justify-center p-2" : "gap-2.5 px-3 py-1.5",
          className,
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {showLabel && <span className="truncate">{label}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title="Forçar atualização do app"
      aria-label="Forçar atualização do app"
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors w-full disabled:opacity-60",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
};

export default ForceUpdateButton;
