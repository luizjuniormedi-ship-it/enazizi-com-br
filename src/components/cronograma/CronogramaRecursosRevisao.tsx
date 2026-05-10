import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { encodeStudyContext } from "@/lib/studyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, Layers, Brain, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import InteractiveQuestionCard, { type InteractiveQuestion } from "@/components/agents/InteractiveQuestionCard";

interface Props {
  tema: string;
  especialidade: string;
}

interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  topic: string | null;
  is_global: boolean;
}

const CronogramaRecursosRevisao = ({ tema, especialidade }: Props) => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<InteractiveQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      const searchTema = `%${tema}%`;
      const searchEsp = `%${especialidade}%`;

      const [qRes, fRes] = await Promise.all([
        supabase
          .from("questions_bank")
          .select("statement, options, correct_index, explanation, topic")
          .or(`topic.ilike.${searchTema},topic.ilike.${searchEsp}`)
          .limit(10),
        supabase
          .from("flashcards")
          .select("id, question, answer, topic, is_global")
          .or(`topic.ilike.${searchTema},topic.ilike.${searchEsp}`)
          .limit(10),
      ]);

      if (qRes.data) {
        const shuffled = qRes.data.sort(() => Math.random() - 0.5).slice(0, 5);
        setQuestions(
          shuffled.map((q) => ({
            statement: q.statement,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            correctIndex: q.correct_index ?? 0,
            explanation: q.explanation ?? "",
            topic: q.topic ?? undefined,
          }))
        );
      }

      if (fRes.data) {
        const shuffled = fRes.data.sort(() => Math.random() - 0.5).slice(0, 5);
        setFlashcards(shuffled);
      }

      setLoading(false);
    };

    fetchResources();
  }, [tema, especialidade]);

  const toggleReveal = (id: string) => {
    setRevealedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggle = (section: string) => setOpenSection((prev) => (prev === section ? null : section));

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando recursos...
      </div>
    );
  }

  const hasQuestions = questions.length > 0;
  const hasFlashcards = flashcards.length > 0;
  const hasAny = hasQuestions || hasFlashcards;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        Recursos para este tema
        {hasAny && (
          <Badge variant="secondary" className="text-[10px]">
            {questions.length + flashcards.length} encontrados
          </Badge>
        )}
      </h3>

      {!hasAny && (
        <p className="text-xs text-muted-foreground">Nenhuma questão ou flashcard encontrado para este tema.</p>
      )}

      {/* Questions */}
      {hasQuestions && (
        <Collapsible open={openSection === "questions"} onOpenChange={() => toggle("questions")}>
          <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-medium hover:bg-secondary/50 transition-colors">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Questões sugeridas
              <Badge variant="outline" className="text-[10px]">{questions.length}</Badge>
            </span>
            {openSection === "questions" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            {questions.map((q, i) => (
              <InteractiveQuestionCard key={i} question={q} index={i} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Flashcards */}
      {hasFlashcards && (
        <Collapsible open={openSection === "flashcards"} onOpenChange={() => toggle("flashcards")}>
          <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-medium hover:bg-secondary/50 transition-colors">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Flashcards
              <Badge variant="outline" className="text-[10px]">{flashcards.length}</Badge>
            </span>
            {openSection === "flashcards" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {flashcards.map((fc) => (
              <div key={fc.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-relaxed">{fc.question}</p>
                  {fc.is_global && <Badge variant="secondary" className="text-[9px] shrink-0">Global</Badge>}
                </div>
                <button
                  onClick={() => toggleReveal(fc.id)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {revealedCards.has(fc.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {revealedCards.has(fc.id) ? "Ocultar resposta" : "Ver resposta"}
                </button>
                {revealedCards.has(fc.id) && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-2 text-sm text-muted-foreground animate-fade-in">
                    {fc.answer}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard/mentor?${encodeStudyContext({ source: "planner", topic: tema, objective: "review" })}`)}
        >
          <Brain className="h-3 w-3 mr-1" /> Tutor IA
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard/questoes?topic=${encodeURIComponent(tema)}`)}
        >
          <BookOpen className="h-3 w-3 mr-1" /> Banco de Questões
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard/flashcards?topic=${encodeURIComponent(tema)}`)}
        >
          <Layers className="h-3 w-3 mr-1" /> Flashcards
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard/gerador-questoes?topic=${encodeURIComponent(tema)}`)}
        >
          <BookOpen className="h-3 w-3 mr-1" /> Gerar Questões
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard/anamnese?specialty=${encodeURIComponent(especialidade)}`)}
        >
          <Brain className="h-3 w-3 mr-1" /> Anamnese
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate(`/dashboard/simulacao-clinica?specialty=${encodeURIComponent(especialidade)}`)}
        >
          <Brain className="h-3 w-3 mr-1" /> Caso Clínico
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
};

export default CronogramaRecursosRevisao;
