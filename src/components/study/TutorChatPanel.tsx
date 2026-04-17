import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, ArrowUpRight, MessageSquare, Lightbulb, Brain, FileQuestion, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStreamingResponse } from "@/hooks/tutor/useStreamingResponse";
import { FUNCTION_NAME } from "@/components/tutor/TutorConstants";
import { cn } from "@/lib/utils";

export interface TutorContext {
  topic?: string;
  specialty?: string;
  phase?: string;
  lastError?: string;
  focus?: string;
  mode?: "free" | "mission";
  origin?: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: (ctx: TutorContext) => string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Me explica isso",
    icon: Lightbulb,
    prompt: (ctx) => `Me explique de forma clara e didática o tema: ${ctx.topic || "tema atual"}. Use analogias se ajudar.`,
  },
  {
    label: "Explique meu erro",
    icon: MessageSquare,
    prompt: (ctx) =>
      `Estou estudando ${ctx.topic || "este tema"} e errei. ${ctx.lastError ? `Erro: ${ctx.lastError}.` : ""} Explique o conceito que faltou e como não errar de novo.`,
  },
  {
    label: "Resuma este tópico",
    icon: Brain,
    prompt: (ctx) => `Faça um resumo prático e objetivo de ${ctx.topic || "o tema atual"} focado no que cai em prova.`,
  },
  {
    label: "Crie uma analogia",
    icon: Wand2,
    prompt: (ctx) => `Crie uma analogia simples e memorável para entender ${ctx.topic || "o tema atual"}.`,
  },
  {
    label: "Vire pergunta de prova",
    icon: FileQuestion,
    prompt: (ctx) => `Transforme ${ctx.topic || "o tema atual"} em uma questão de caso clínico estilo residência (A-E), com gabarito e explicação.`,
  },
];

interface Props {
  context: TutorContext;
  /** Show CTA to navigate to Sessão de Estudo from inside Tutor (handoff back). Defaults to false (panel is already inside Sessão). */
  showStudySessionCTA?: boolean;
  /** Optional className for outer wrapper */
  className?: string;
}

export default function TutorChatPanel({ context, showStudySessionCTA = false, className }: Props) {
  const navigate = useNavigate();
  const { streamResponse } = useStreamingResponse();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: Msg = { role: "user", content: text };
      const all = [...messages, userMsg];
      setMessages([...all, { role: "assistant", content: "" }]);
      setInput("");
      setIsLoading(true);

      const missionContext =
        context.mode === "mission" || context.topic
          ? {
              mode: "mission" as const,
              topic: context.topic,
              error: context.lastError,
              phase: context.phase,
              objective: context.focus,
              origin: context.origin || "study-session-panel",
            }
          : null;

      await streamResponse({
        url: CHAT_URL,
        body: {
          messages: all.map((m) => ({ role: m.role, content: m.content })),
          mission_context: missionContext || undefined,
        },
        onChunk: (fullText) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: fullText } : m));
            }
            return [...prev, { role: "assistant", content: fullText }];
          });
        },
        onComplete: () => setIsLoading(false),
        onError: () => {
          setIsLoading(false);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
            return prev;
          });
        },
      });
    },
    [messages, isLoading, streamResponse, CHAT_URL, context]
  );

  const goToSession = () => {
    const params = new URLSearchParams();
    if (context.topic) params.set("topic", context.topic);
    if (context.specialty) params.set("sc_specialty", context.specialty);
    params.set("auto", "1");
    params.set("origin", "tutor-handoff");
    navigate(`/dashboard/sessao-estudo?${params.toString()}`);
  };

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-background", className)}>
      {/* Context header */}
      <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Tutor IA</span>
          {context.topic && (
            <Badge variant="secondary" className="text-[10px] truncate max-w-[200px]">
              {context.topic}
            </Badge>
          )}
          {context.phase && (
            <Badge variant="outline" className="text-[10px]">
              {context.phase}
            </Badge>
          )}
        </div>
        {showStudySessionCTA && context.topic && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={goToSession}>
            <ArrowUpRight className="h-3 w-3" />
            Ir para Sessão de Estudo
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Sparkles className="h-8 w-8 text-primary/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Tire dúvidas sobre <span className="text-foreground font-medium">{context.topic || "o conteúdo"}</span> sem sair da sessão.
            </p>
            <p className="text-xs text-muted-foreground">Use os atalhos abaixo ou faça uma pergunta livre.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_table]:text-xs">
                  <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="border-t border-border px-3 pt-2">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 whitespace-nowrap shrink-0"
                disabled={isLoading}
                onClick={() => send(a.prompt(context))}
              >
                <Icon className="h-3 w-3" />
                {a.label}
              </Button>
            );
          })}
        </div>

        {/* Input */}
        <div className="flex gap-2 pb-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ao Tutor..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={isLoading}
            className="flex-1 h-9 text-sm"
          />
          <Button onClick={() => send(input)} disabled={isLoading || !input.trim()} size="icon" className="h-9 w-9">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
