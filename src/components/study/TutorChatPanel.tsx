import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Send, Sparkles, ArrowUpRight, MessageSquare, 
  Lightbulb, Brain, FileQuestion, Wand2, Clapperboard, 
  Play, Stethoscope, Activity, BookOpen, Clock, AlertCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStreamingResponse } from "@/hooks/tutor/useStreamingResponse";
import { FUNCTION_NAME } from "@/components/tutor/TutorConstants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTelemetry } from "@/hooks/useTelemetry";

interface MsgRowProps { role: "user" | "assistant"; content: string; bibliography?: any[] }
const ChatMsgRow = memo(({ role, content, bibliography }: MsgRowProps) => (
  <div className={`flex flex-col ${role === "user" ? "items-end" : "items-start"} gap-2`}>
    <div
      className={cn(
        "max-w-[92%] rounded-2xl px-4 py-3 text-[13px] font-medium leading-relaxed",
        role === "user" 
          ? "bg-primary text-primary-foreground shadow-sm" 
          : "bg-white/5 border border-white/5 backdrop-blur-sm"
      )}
    >
      {role === "assistant" ? (
        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-2 [&_table]:text-xs [&_strong]:text-primary [&_strong]:font-black">
          <ReactMarkdown>{content || "..."}</ReactMarkdown>
        </div>
      ) : (
        content
      )}
    </div>
    
    {role === "assistant" && bibliography && bibliography.length > 0 && (
      <div className="ml-2 mt-1 space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> Fontes Consultadas
        </p>
        <div className="flex flex-wrap gap-1.5">
          {bibliography.map((b, i) => (
            <Badge key={i} variant="outline" className="text-[9px] bg-primary/5 border-primary/20 text-primary/80">
              {b.file || b.source} {b.page ? `(pág. ${b.page})` : ""}
            </Badge>
          ))}
        </div>
      </div>
    )}
  </div>
), (prev, next) => prev.role === next.role && prev.content === next.content && JSON.stringify(prev.bibliography) === JSON.stringify(next.bibliography));
ChatMsgRow.displayName = "ChatMsgRow";


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
  bibliography?: any[];
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
  const { trackAction } = useTelemetry();
  const { streamResponse } = useStreamingResponse();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [lessonStatus, setLessonStatus] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      // Telemetry
      if (messages.length === 0) {
        trackAction('first_question_loaded', { topic: context.topic, mode: context.mode });
      } else {
        trackAction('first_answer_submitted', { topic: context.topic, mode: context.mode });
      }

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
        onComplete: (fullText, data: any) => {
          setIsLoading(false);
          // Se o backend retornou bibliografia RAG
          if (data?.adaptive_context?.bibliography) {
             setMessages(prev => prev.map((m, i) => 
               i === prev.length - 1 ? { ...m, bibliography: data.adaptive_context.bibliography } : m
             ));
          }
        },
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

  const handleGenerateLesson = async () => {
    if (!context.topic || isGeneratingLesson) return;
    
    setIsGeneratingLesson(true);
    setLessonStatus('processing');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-tutor-lesson', {
        body: {
          topic: context.topic,
          lessonType: 'aula_completa',
          cmeEnabled: true
        }
      });

      if (error) throw error;

      toast.success("Aula gerada com sucesso!");
      setLessonStatus('ready');
      
      // If textual lesson is ready, we could show it. For now, let's navigate to a viewer if it existed.
      // But according to prompt, we just need to fix the generation flow.
    } catch (err: any) {
      console.error("Lesson generation failed", err);
      setLessonStatus('failed');
      toast.error(err.message || "Falha ao gerar aula.");
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const transformFullSession = () => {
    if (!context.topic) return;
    const params = new URLSearchParams();
    params.set("topic", context.topic);
    if (context.specialty) params.set("specialty", context.specialty);
    params.set("mode", "transform");
    // Redireciona para o Mentor Hub que agora lida com sessões persistidas e automação
    navigate(`/dashboard/mentor?${params.toString()}`);
  };

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-background/95 backdrop-blur-xl", className)}>
      {/* Context header — Premium Cockpit style */}
      <div className="px-4 py-4 border-b border-white/5 bg-card/40 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shadow-glow-sm">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-black tracking-tight uppercase leading-none">Tutor Mentor</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {context.topic && (
                  <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[140px] uppercase tracking-wide">
                    {context.topic}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {showStudySessionCTA && context.topic && (
              <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold gap-2 border-primary/20 text-primary hover:bg-primary/10 rounded-xl" onClick={goToSession}>
                <ArrowUpRight className="h-3.5 w-3.5" />
                INICIAR SESSÃO
              </Button>
            )}
          </div>
        </div>

        {/* CME Transformation Buttons — Premium Netflix-style glow */}
        {context.topic && (
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 h-9 text-[10px] font-black gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-lg shadow-orange-900/20 border-none transition-all group active:scale-95"
              onClick={transformFullSession}
            >
              <Clapperboard className="h-3.5 w-3.5 group-hover:animate-bounce" />
              TRANSFORMAR SESSÃO COMPLETA
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 text-[10px] font-black gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10 backdrop-blur-md transition-all active:scale-95"
            >
              <Play className="h-3.5 w-3.5" />
              ULTIMA RESPOSTA
            </Button>
          </div>
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
          <ChatMsgRow key={i} role={m.role} content={m.content} bibliography={m.bibliography} />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions — Premium visual pills */}
      <div className="border-t border-white/5 px-4 pt-3 pb-4 bg-card/40 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                size="sm"
                className="h-8 text-[11px] font-bold gap-2 whitespace-nowrap shrink-0 rounded-xl border-white/10 bg-white/5 hover:bg-primary/10 hover:text-primary transition-all"
                disabled={isLoading}
                onClick={() => send(a.prompt(context))}
              >
                <Icon className="h-3.5 w-3.5" />
                {a.label.toUpperCase()}
              </Button>
            );
          })}
        </div>

        {/* Input — Premium integrated look */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida aqui..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={isLoading}
              className="flex-1 h-11 bg-white/5 border-white/10 rounded-xl px-4 text-sm font-medium focus:ring-primary/20 placeholder:text-muted-foreground/40"
            />
          </div>
          <Button 
            onClick={() => send(input)} 
            disabled={isLoading || !input.trim()} 
            size="icon" 
            className="h-11 w-11 rounded-xl shadow-glow-sm transition-all active:scale-90"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 fill-current" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
