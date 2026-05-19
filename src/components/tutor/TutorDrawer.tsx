/**
 * TutorDrawer — F4
 *
 * Contextual Tutor IA surfaced as a side sheet. Receives topic + reason from
 * the orchestrator (or any module via openTutorDrawer()) and opens the chat
 * with the context already injected as the first user message.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import AgentChat from "@/components/agents/AgentChat";
import { useTutorDrawer } from "@/hooks/useTutorDrawer";
import { useEffect, useMemo } from "react";
import { telemetry } from "@/lib/pedagogicalTelemetry";

const QUICK_ACTIONS = [
  { label: "🩺 Explicar do zero", prompt: "Explique este tema do zero, como se eu nunca tivesse visto.", icon: "🩺" },
  { label: "📌 Pegadinhas de prova", prompt: "Quais as pegadinhas mais cobradas em provas sobre este tema?", icon: "📌" },
  { label: "💊 Conduta resumida", prompt: "Resuma a conduta padrão em até 5 bullets.", icon: "💊" },
  { label: "🔄 Diagnóstico diferencial", prompt: "Quais os diagnósticos diferenciais e como distingui-los?", icon: "🔄" },
];

function buildInitialPrompt(ctx: { topic?: string; reason?: string; tutorPhase?: string; initialPrompt?: string }) {
  if (ctx.initialPrompt) return ctx.initialPrompt;
  const parts: string[] = [];
  if (ctx.topic) parts.push(`Tema: **${ctx.topic}**`);
  if (ctx.reason) parts.push(`Motivo: ${ctx.reason}`);
  if (ctx.tutorPhase === "correction") {
    parts.push("Por favor, foque em corrigir o que provavelmente errei e fixar o conceito-chave.");
  } else if (ctx.tutorPhase === "mnemonic_assist") {
    parts.push("Me ajude a memorizar os pontos-chave com analogias e mnemônicos.");
  } else if (ctx.topic) {
    parts.push("Me dê uma explicação direta com pontos de prova.");
  }
  return parts.length ? parts.join("\n") : "";
}

export default function TutorDrawer() {
  const { open, context, setOpen } = useTutorDrawer();
  const navigate = useNavigate();

  const initialPrompt = useMemo(() => buildInitialPrompt(context ?? {}), [context]);
  const topic = context?.topic;

  useEffect(() => {
    if (open) {
      telemetry.track("tutor_opened", {
        topic: context?.topic ?? null,
        source: context?.source ?? null,
        phase: context?.tutorPhase ?? null,
      });
    }
  }, [open, context]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <SheetTitle className="text-base truncate">Tutor IA</SheetTitle>
              {context?.source && (
                <Badge variant="outline" className="gap-1 text-[10px] h-5">
                  <Sparkles className="h-3 w-3" /> {context.source}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                navigate("/dashboard/tutor");
              }}
              className="gap-1 text-xs text-muted-foreground"
              title="Abrir Tutor em tela cheia"
            >
              Tela cheia <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
          {topic && (
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Contexto: <span className="text-foreground font-medium">{topic}</span>
              {context?.reason ? ` — ${context.reason}` : ""}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Re-mount when topic changes so AgentChat resets with new context */}
          <AgentChat
            key={`${topic ?? "free"}-${context?.tutorPhase ?? ""}`}
            title="Tutor IA"
            subtitle={topic ? `Foco: ${topic}` : "Apoio contextual"}
            icon={<Brain className="h-5 w-5 text-primary" />}
            welcomeMessage={
              topic
                ? `Vamos destravar **${topic}** juntos. Mande sua dúvida ou escolha uma ação rápida abaixo. 🧠`
                : "Olá! Como posso te ajudar agora? 🩺"
            }
            welcomeMessageWithUploads="📚 Detectei {count} material(is) no seu acervo: {materiais}. Vou usar como base. 👇"
            placeholder={topic ? `Pergunte algo sobre ${topic}...` : "Faça sua pergunta..."}
            functionName="tutor-v3-premium"
            quickActions={QUICK_ACTIONS}
            initialPrompt={initialPrompt || undefined}
            topic={context?.topic ?? null}
            subtopic={context?.subtopic ?? null}
            specialty={context?.specialty ?? null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
