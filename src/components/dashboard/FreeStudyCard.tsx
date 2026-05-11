import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageSquare, Stethoscope, Layers, ClipboardList, FileText, BookMarked,
} from "lucide-react";

const MODULES = [
  { label: "Tutor IA", path: "/dashboard/sessao-estudo", icon: MessageSquare, color: "text-primary" },
  { label: "Prova Prática", path: "/dashboard/prova-pratica", icon: Stethoscope, color: "text-blue-500" },
  { label: "Flashcards", path: "/dashboard/flashcards", icon: Layers, color: "text-violet-500" },
  { label: "Simulados", path: "/dashboard/simulados", icon: ClipboardList, color: "text-emerald-500" },
  { label: "Resumos", path: "/dashboard/resumos", icon: FileText, color: "text-orange-500" },
  { label: "Crônicas", path: "/dashboard/cronicas", icon: BookMarked, color: "text-pink-500" },
];

export default function FreeStudyCard() {
  const navigate = useNavigate();

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          Explorar módulos
        </CardTitle>
        <p className="text-xs text-muted-foreground/70">Estude fora da missão</p>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.path}
                onClick={() => navigate(mod.path)}
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted active:bg-muted/60 active:scale-[0.97] hover:border-primary/20 transition-all group min-h-[72px] justify-center"
              >
                <Icon className={`h-5 w-5 ${mod.color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">
                  {mod.label}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
