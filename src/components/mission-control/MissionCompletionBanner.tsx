import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  completedTitle: string;
  badges?: string[];
  onDismiss: () => void;
}

export default function MissionCompletionBanner({ completedTitle, badges, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for fade-out
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`relative rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-1.5 shrink-0 mt-0.5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1.5 min-w-0">
          <p className="text-sm font-medium text-foreground">Etapa concluída!</p>
          <p className="text-xs text-muted-foreground truncate">
            Concluído: {completedTitle}
          </p>
          {badges && badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {badges.map((b, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {b}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
