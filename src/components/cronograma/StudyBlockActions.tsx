import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, Layers, MessageSquare, Stethoscope, Activity, GraduationCap } from "lucide-react";

interface StudyBlockActionsProps {
  subject: string;
  specialty?: string;
}

const MODULES = [
  {
    key: "tutor",
    label: "Tutor IA",
    icon: MessageSquare,
    path: (s: string) => `/dashboard/mentor?topic=${encodeURIComponent(s)}`,
    color: "hover:text-blue-500 hover:bg-blue-500/10",
  },
  {
    key: "flashcards",
    label: "Flashcards",
    icon: Layers,
    path: (s: string) => `/dashboard/flashcards?topic=${encodeURIComponent(s)}`,
    color: "hover:text-violet-500 hover:bg-violet-500/10",
  },
  {
    key: "questoes",
    label: "Gerar Questões",
    icon: BookOpen,
    path: (s: string) => `/dashboard/gerador-questoes?topic=${encodeURIComponent(s)}`,
    color: "hover:text-emerald-500 hover:bg-emerald-500/10",
  },
  {
    key: "banco",
    label: "Questões do Tema",
    icon: GraduationCap,
    path: (s: string) => `/dashboard/simulados?topic=${encodeURIComponent(s)}`,
    color: "hover:text-cyan-500 hover:bg-cyan-500/10",
  },
  {
    key: "anamnese",
    label: "Anamnese",
    icon: Stethoscope,
    path: (_s: string, sp?: string) => `/dashboard/anamnese?specialty=${encodeURIComponent(sp || _s)}`,
    color: "hover:text-amber-500 hover:bg-amber-500/10",
  },
  {
    key: "plantao",
    label: "Caso Clínico",
    icon: Activity,
    path: (_s: string, sp?: string) => `/dashboard/simulacao-clinica?specialty=${encodeURIComponent(sp || _s)}`,
    color: "hover:text-rose-500 hover:bg-rose-500/10",
  },
];

const StudyBlockActions = ({ subject, specialty }: StudyBlockActionsProps) => {
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label="Praticar tema"
        >
          <GraduationCap className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-auto p-1.5"
        sideOffset={4}
      >
        <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium">
          Praticar: {subject}
        </p>
        <div className="flex gap-0.5">
          <TooltipProvider delayDuration={200}>
            {MODULES.map((mod) => (
              <Tooltip key={mod.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(mod.path(subject, specialty))}
                    className={`p-2 rounded-md transition-all text-muted-foreground ${mod.color} active:scale-95`}
                    aria-label={mod.label}
                  >
                    <mod.icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {mod.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default StudyBlockActions;
