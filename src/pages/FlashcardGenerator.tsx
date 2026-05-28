import { FlipVertical, Target, Zap } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useState, useRef } from "react";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";

const QUANTITY_OPTIONS = [5, 10, 15, 20];

function parseFlashcardsFromText(content: string): Array<{ question: string; answer: string; topic: string }> {
  const flashcards: Array<{ question: string; answer: string; topic: string }> = [];
  
  // Try to find if the content is already a JSON array (some edge functions return this)
  try {
    const jsonMatch = content.match(/\[\s*{[\s\S]*}\s*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          question: item.front || item.question || item.pergunta || "",
          answer: item.back || item.answer || item.resposta || "",
          topic: item.topic || item.tema || "Medicina"
        })).filter(item => item.question && item.answer);
      }
    }
  } catch (e) {
    console.warn("Failed to parse flashcards as JSON, falling back to regex", e);
  }

  // Fallback to block parsing
  const blocks = content.split(/\*\*FLASHCARD\s+\d+/i).filter(b => b.trim());

  for (const block of blocks) {
    // Robust extraction using multiple possible labels
    const caseMatch = block.match(/(?:CASO\s+CL[ÍI]NICO|CENÁRIO)[:\s]*\*?\*?\s*([\s\S]*?)(?=\*?\*?\s*(?:❓|PERGUNTA|RESPOSTA|✅|EXPLICA[ÇC][ÃA]O|---|$))/i);
    const questionMatch = block.match(/(?:PERGUNTA|QUESTÃO|PERGUNTA[:\s]*\*?\*?)\s*([\s\S]*?)(?=\*?\*?\s*(?:✅|RESPOSTA|EXPLICA[ÇC][ÃA]O|🧠|---|$))/i);
    const answerMatch = block.match(/(?:RESPOSTA|GABARITO|RESPOSTA[:\s]*\*?\*?)\s*([\s\S]*?)(?=\*?\*?\s*(?:🧠|EXPLICA[ÇC][ÃA]O|📌|PONTO|---|$))/i);
    const explanationMatch = block.match(/(?:EXPLICA[ÇC][ÃA]O|JUSTIFICATIVA)[:\s]*\*?\*?\s*([\s\S]*?)(?=\*?\*?\s*(?:📌|PONTO|---|$))/i);
    
    const caseText = caseMatch?.[1]?.trim() || "";
    const questionText = questionMatch?.[1]?.trim() || "";
    const answerText = answerMatch?.[1]?.trim() || "";
    const explanation = explanationMatch?.[1]?.trim() || "";

    if (!questionText && !caseText) continue;
    if (!answerText) continue;

    const fullQuestion = caseText && questionText ? `${caseText}\n\n${questionText}` : (questionText || caseText);
    let fullAnswer = answerText;
    if (explanation) fullAnswer += `\n\n🧠 ${explanation}`;

    const topicMatch = block.match(/(?:TEMA|TOPICO|—|[-–])\s*([^\n]+)/i);
    const topic = topicMatch?.[1]?.trim() || "Medicina";

    flashcards.push({ question: fullQuestion, answer: fullAnswer, topic });
  }

  return flashcards;
}

const FlashcardGenerator = () => {
  const { user } = useAuth();
  const { addXp } = useGamification();
  const studyCtx = useStudyContext();
  const [specialty, setSpecialty] = useState<string>(studyCtx?.specialty || studyCtx?.topic || "");
  const [quantity, setQuantity] = useState(10);
  const [showSetup, setShowSetup] = useState(true);
  const initialPromptRef = useRef<string>("");
  const decisionIdRef = useRef<string | null>(null);

  const effectiveSpecialty = specialty.trim();

  const buildPrompt = () => {
    const specPart = effectiveSpecialty || "várias especialidades médicas (variando)";
    return `Gere ${quantity} flashcards clínicos de ${specPart} com casos clínicos variados, cobrindo subtemas diferentes. Formato com caso clínico, pergunta, resposta, explicação e ponto de prova.`;
  };

  const quickActions = showSetup ? [] : [
    { label: "🔄 Gerar mais", prompt: buildPrompt(), icon: "🔄" },
  ];

  const handleSaveFlashcards = useCallback(async (content: string): Promise<number> => {
    if (!user) throw new Error("Usuário não autenticado");

    const parsed = parseFlashcardsFromText(content);
    if (parsed.length === 0) throw new Error("Nenhum flashcard encontrado para salvar. Verifique se o formato é válido.");

    // Garantir decisionId antes de salvar
    if (!decisionIdRef.current) {
      const { getOrchestratorDecision } = await import("@/lib/cognitiveOrchestrator");
      decisionIdRef.current = await getOrchestratorDecision(user.id, "flashcard-generator", {
        topic: effectiveSpecialty
      });
    }

    const rows = parsed.map((f) => ({
      user_id: user.id,
      question: f.question,
      answer: f.answer,
      topic: f.topic,
      decision_id: decisionIdRef.current,
    }));

    const { error, data: inserted } = await supabase
      .from("flashcards")
      .insert(rows)
      .select("id, is_global");
    if (error) throw new Error("Erro ao salvar: " + error.message);

    // Fase 1B: vincular FSRS para todo card pessoal recém-criado
    const personalIds = (inserted || [])
      .filter((c: any) => c.is_global === false)
      .map((c: any) => c.id);
    if (personalIds.length > 0) {
      const { ensurePersonalFlashcardsFsrsBatch } = await import("@/lib/personalFlashcardFsrs");
      const { failed } = await ensurePersonalFlashcardsFsrsBatch(
        user.id,
        personalIds,
        "flashcard_generator",
      );
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} flashcard(s) foram revertidos por falha no vínculo FSRS.`,
        );
      }
    }

    await addXp(XP_REWARDS.flashcard_created * parsed.length);

    return parsed.length;
  }, [user, addXp, effectiveSpecialty]);

  const loadPreviousFlashcards = useCallback(async (): Promise<string> => {
    if (!user) return "";
    const { data } = await supabase
      .from("flashcards")
      .select("question, topic")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data || data.length === 0) return "";
    const items = data.map((f, i) => {
      const truncated = f.question?.slice(0, 80) || "";
      return `${i + 1}. [${f.topic || "Geral"}] ${truncated}`;
    });
    return `⛔ FLASHCARDS JÁ GERADOS ANTERIORMENTE (NÃO REPETIR cenários similares — varie diagnóstico, perfil do paciente e abordagem):\n${items.join("\n")}`;
  }, [user]);

  const handleStartGenerating = async () => {
    if (user) {
      const { getOrchestratorDecision } = await import("@/lib/cognitiveOrchestrator");
      decisionIdRef.current = await getOrchestratorDecision(user.id, "flashcard-generator", {
        topic: effectiveSpecialty,
        quantity
      });
    }
    setShowSetup(false);
    initialPromptRef.current = buildPrompt();
  };


  if (showSetup) {
    return (
      <div className="flex flex-col animate-fade-in h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <StudyContextBanner />
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <FlipVertical className="h-6 w-6 text-primary" />
            Gerador de Flashcards Clínicos
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Configure e gere flashcards com casos clínicos para residência.</p>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="glass-card p-6 sm:p-8 max-w-lg w-full space-y-6">
            {/* Tema */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                Tema / Especialidade
              </label>
              <Input
                placeholder="Ex: Cardiologia, IAM, Pneumonia (vazio = misto)"
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantidade</label>
              <div className="flex gap-2">
                {QUANTITY_OPTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      quantity === q
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Start button */}
            <Button
              className="w-full gap-2 h-12 text-base"
              onClick={handleStartGenerating}
            >
              <FlipVertical className="h-5 w-5" />
              Gerar {quantity} Flashcards
              {effectiveSpecialty ? ` de ${effectiveSpecialty}` : ""}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AgentChat
      title="Gerador de Flashcards Clínicos"
      subtitle={`${effectiveSpecialty ? effectiveSpecialty + " • " : ""}${quantity} flashcards`}
      icon={<FlipVertical className="h-6 w-6 text-primary" />}
      welcomeMessage={`Gerando ${quantity} flashcards${effectiveSpecialty ? ` de ${effectiveSpecialty}` : " mistos"}... Aguarde! 🏥`}
      welcomeMessageWithUploads="📚 Detectei {count} material(is) do seu acervo: {materiais}. Vou usar como base para gerar flashcards clínicos! 👇"
      placeholder="Ex: Gere mais 5 de Cardiologia sobre IAM..."
      functionName="generate-flashcards"
      onSaveMessage={handleSaveFlashcards}
      quickActions={quickActions}
      showUploadButton={true}
      autoPromptAfterUpload="Gere 10 flashcards clínicos baseados no material que acabei de enviar: {filename}. Use o conteúdo do material como base para criar casos clínicos variados."
      previousContentLoader={loadPreviousFlashcards}
      initialPrompt={initialPromptRef.current}
    />
  );
};

export default FlashcardGenerator;
