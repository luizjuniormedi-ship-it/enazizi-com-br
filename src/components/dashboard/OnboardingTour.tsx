import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, BookOpen, Brain, FileText, Trophy, Stethoscope, BarChart3, Zap, MessageSquare, Upload, CalendarDays, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ONBOARDING_KEY = "enazizi_onboarding_completed_v2";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip: string;
  route?: string;
}

const steps: Step[] = [
  {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "Bem-vindo ao ENAZIZI! 🎉",
    description: "Sua plataforma completa de estudos para Residência Médica e Revalida com Inteligência Artificial.",
    tip: "Vamos fazer um tour rápido pelas principais funcionalidades!",
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: "🤖 Tutor IA (Principal)",
    description: "Seu mentor pessoal de medicina. Tire dúvidas, estude temas, resolva questões e receba explicações detalhadas — tudo em uma conversa inteligente.",
    tip: "Dica: Envie PDFs na seção de Uploads e o Tutor usará como base para suas respostas!",
    route: "/dashboard/mentor",
  },
  {
    icon: <Stethoscope className="h-8 w-8 text-primary" />,
    title: "🩺 Nivelamento Inicial",
    description: "Faça um nivelamento do seu nível atual respondendo questões de todas as especialidades. O sistema vai identificar seus pontos fortes e fracos.",
    tip: "Recomendado: Faça o nivelamento assim que começar para personalizar seu plano de estudos.",
    route: "/dashboard/diagnostico",
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "⚡ Plano do Dia",
    description: "Receba um plano de estudos personalizado para hoje baseado no seu cronograma, temas fracos e progresso.",
    tip: "Acesse todos os dias para manter a consistência nos estudos!",
    route: "/dashboard/plano-dia",
  },
  {
    icon: <CalendarDays className="h-8 w-8 text-primary" />,
    title: "📅 Cronograma Inteligente",
    description: "Motor de repetição espaçada adaptativo que agenda revisões automáticas (D1, D3, D7, D15, D30) e extras baseadas na sua taxa de erro. Inclui o Plano de Estudos com upload de edital e contagem regressiva até a prova.",
    tip: "Registre temas e o sistema cria revisões automaticamente. Use a aba 'Plano de Estudos' para gerar um cronograma semanal com IA!",
    route: "/dashboard/planner",
  },
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: "🃏 Flashcards com Repetição Espaçada",
    description: "Estude com flashcards que usam algoritmo de repetição espaçada. Gerados automaticamente a partir dos seus PDFs ou criados manualmente.",
    tip: "O sistema agenda revisões automáticas para maximizar sua retenção de longo prazo.",
    route: "/dashboard/flashcards",
  },
  {
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: "📝 Simulados e Questões",
    description: "Gere questões estilo ENARE/USP com casos clínicos, pratique no banco de questões, e faça simulados completos cronometrados.",
    tip: "Use o Gerador de Questões para criar questões específicas sobre seus temas fracos.",
    route: "/dashboard/simulados",
  },
  {
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    title: "🚨 Modo Plantão & Discursivas",
    description: "Simule plantões médicos com casos clínicos interativos e pratique questões discursivas com correção detalhada pela IA.",
    tip: "O Modo Plantão treina tomada de decisão rápida — essencial para a prova prática!",
    route: "/dashboard/plantao",
  },
  {
    icon: <Upload className="h-8 w-8 text-primary" />,
    title: "📤 Uploads Inteligentes",
    description: "Envie PDFs, apostilas e materiais. A IA extrai o texto e usa como base para gerar flashcards, questões e resumos personalizados.",
    tip: "Formatos aceitos: PDF, imagens e documentos de texto.",
    route: "/dashboard/uploads",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "📊 Analytics e Benchmark",
    description: "Acompanhe seu progresso com gráficos, mapa de evolução por especialidade e compare seu desempenho com outros alunos anonimamente.",
    tip: "Quanto mais você usa a plataforma, mais precisas ficam as previsões de desempenho!",
    route: "/dashboard/analytics",
  },
  {
    icon: <Trophy className="h-8 w-8 text-primary" />,
    title: "🏆 Gamificação",
    description: "Ganhe XP, suba de nível, desbloqueie conquistas e dispute o ranking semanal com outros alunos. Estudar nunca foi tão motivante!",
    tip: "Mantenha seu streak diário para ganhar bônus de XP!",
    route: "/dashboard/conquistas",
  },
];

const OnboardingTour = () => {
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShow(false);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleClose();
    }
  }, [currentStep, handleClose]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleGoTo = useCallback((route?: string) => {
    if (route) {
      handleClose();
      navigate(route);
    }
  }, [navigate, handleClose]);

  if (!show) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-8 sm:pt-12 p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Card */}
      <div className="relative w-full max-w-lg animate-fade-in">
        <div className="glass-card border border-primary/20 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Step counter */}
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-muted-foreground font-medium">
                {currentStep + 1} de {steps.length}
              </span>
              <div className="flex gap-1 ml-auto">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? "w-6 bg-primary"
                        : i < currentStep
                        ? "w-1.5 bg-primary/50"
                        : "w-1.5 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-5 mx-auto">
              {step.icon}
            </div>

            {/* Text */}
            <h2 className="text-xl font-bold text-center mb-2">{step.title}</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-4">
              {step.description}
            </p>

            {/* Tip */}
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mb-6">
              <p className="text-xs text-primary font-medium text-center">
                💡 {step.tip}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {currentStep > 0 ? (
                <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleClose} className="text-muted-foreground">
                  Pular tour
                </Button>
              )}

              <div className="flex-1" />

              {step.route && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGoTo(step.route)}
                  className="text-primary border-primary/30"
                >
                  Ir para →
                </Button>
              )}

              <Button size="sm" onClick={handleNext} className="gap-1">
                {isLast ? "Começar! 🚀" : <>Próximo <ChevronRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
