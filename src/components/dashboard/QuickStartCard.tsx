import { Link } from "react-router-dom";
import { Rocket, Brain, BookOpen, Target, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  questionsAnswered: number;
  flashcards: number;
  hasCompletedDiagnostic: boolean;
}

const QuickStartCard = ({ questionsAnswered, flashcards, hasCompletedDiagnostic }: Props) => {
  const isNewUser = questionsAnswered === 0 && flashcards === 0;

  if (!isNewUser) return null;

  const steps = [
    {
      done: hasCompletedDiagnostic,
      icon: Target,
      label: "Fazer nivelamento inicial",
      description: "Descubra seus pontos fortes e fracos",
      to: "/dashboard/diagnostico",
      cta: "Começar nivelamento",
    },
    {
      done: questionsAnswered > 0,
      icon: Brain,
      label: "Estudar com o Tutor IA",
      description: "Aula personalizada sobre qualquer tema",
      to: "/dashboard/sessao-estudo",
      cta: "Abrir Tutor IA",
    },
    {
      done: flashcards > 0,
      icon: BookOpen,
      label: "Criar seus primeiros flashcards",
      description: "Memorize com repetição espaçada",
      to: "/dashboard/gerar-flashcards",
      cta: "Gerar flashcards",
    },
  ];

  return (
    <div className="glass-card p-6 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Comece sua jornada
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </h2>
          <p className="text-sm text-muted-foreground">3 passos para dominar seus estudos</p>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <Link
            key={i}
            to={step.to}
            className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card transition-all group"
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              step.done ? "bg-green-500/10" : "bg-primary/10"
            }`}>
              <step.icon className={`h-5 w-5 ${step.done ? "text-green-500" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{step.label}</div>
              <div className="text-xs text-muted-foreground">{step.description}</div>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-8 opacity-70 group-hover:opacity-100 flex-shrink-0">
              {step.cta}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default QuickStartCard;
