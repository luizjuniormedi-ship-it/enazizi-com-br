import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Brain, FileText, Stethoscope } from "lucide-react";

type FocusType = "review" | "new" | "test" | "practice";

const focusOptions: { type: FocusType; icon: React.ReactNode; label: string; desc: string; path: string }[] = [
  { type: "review", icon: <Brain className="h-5 w-5" />, label: "Revisão", desc: "Revisar temas já estudados", path: "/dashboard/plano-dia" },
  { type: "new", icon: <BookOpen className="h-5 w-5" />, label: "Tema Novo", desc: "Aprender conteúdo novo", path: "/dashboard/mentor?origin=focus&mode=new" },
  { type: "test", icon: <FileText className="h-5 w-5" />, label: "Simulado", desc: "Praticar com questões", path: "/dashboard/simulados" },
  { type: "practice", icon: <Stethoscope className="h-5 w-5" />, label: "Prática Clínica", desc: "Treinar casos reais", path: "/dashboard/simulacao-clinica" },
];

const STORAGE_KEY = "enazizi_daily_focus";

export default function FocusSelector() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<FocusType | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toDateString();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) return parsed.type as FocusType;
      } catch {}
    }
    return null;
  });

  const handleSelect = (type: FocusType) => {
    setSelected(type);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, date: new Date().toDateString() }));
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">🎯 Foco do dia</h3>
          {selected && (
            <Badge variant="outline" className="text-[10px]">
              {focusOptions.find((f) => f.type === selected)?.label}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {focusOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => handleSelect(opt.type)}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-sm ${
                selected === opt.type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-accent/50 text-foreground"
              }`}
            >
              <div className={`shrink-0 ${selected === opt.type ? "text-primary" : "text-muted-foreground"}`}>
                {opt.icon}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {selected && (
          <Button
            size="sm"
            className="w-full mt-3 gap-1.5"
            onClick={() => navigate(focusOptions.find((f) => f.type === selected)!.path)}
          >
            Iniciar foco
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
