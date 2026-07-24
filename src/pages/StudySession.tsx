/**
 * StudySession — rota legada `/dashboard/tutor-legacy` (o Mentor real vive em
 * `/dashboard/sessao-estudo` → TutorV2Page). Mantida para retrocompatibilidade
 * e restaurada na Fase 2/3 do plano de recuperação do Mentor IA:
 *
 * ✅ Gate obrigatório de Especialidade + Tema antes do primeiro envio.
 * ✅ Persistência real via `useChatMessages` (chat_conversations + chat_messages)
 *    com espelhamento para tutor_sessions/tutor_messages e RLS por auth.uid().
 * ✅ Retomada por refresh, listagem de histórico, nova sessão.
 * ✅ Confirmação ao trocar tema durante a conversa (nova conversa vs. manter).
 * ✅ Uma gravação por mensagem (removida a duplicação de setMessages / duas
 *    escritas no banco).
 * ✅ Payload do backend recebe { specialty, topic } explicitamente.
 * ✅ Removido console.error("🔥 BUILD_FORENSE") que poluía produção.
 *
 * NÃO altera Recovery/Mastery, FSRS, Planner ou Event Bus (fora do escopo desta rodada).
 */
import { useState, useEffect, useMemo, useRef, memo, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { callTutorV3 } from "@/lib/tutor/tutorClient";
import { useChatMessages } from "@/hooks/tutor/useChatMessages";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { Send, Loader2, ChevronLeft, Stethoscope, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const SPECIALTY_OPTIONS = [
  "Clínica Médica",
  "Cirurgia",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Medicina Preventiva",
  "Medicina de Emergência",
  "Cardiologia",
  "Pneumologia",
  "Neurologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Nefrologia",
  "Hematologia",
  "Infectologia",
  "Dermatologia",
  "Ortopedia",
  "Oftalmologia",
  "Otorrinolaringologia",
  "Psiquiatria",
  "Reumatologia",
] as const;

const StudySessionContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Contexto vindo por query string (rotas legadas ou navegação com contexto).
  const urlSpecialty = searchParams.get("specialty") || searchParams.get("sc_specialty") || "";
  const urlTopic = searchParams.get("topic") || searchParams.get("sc_topic") || "";

  const {
    messages,
    setMessages,
    conversations,
    activeConversationId,
    showHistory,
    setShowHistory,
    loadConversations,
    loadConversation,
    createConversation,
    saveMessage,
    startNewSession,
  } = useChatMessages(user?.id);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [specialty, setSpecialty] = useState<string>(urlSpecialty);
  const [topic, setTopic] = useState<string>(urlTopic);
  const [pendingTopicChange, setPendingTopicChange] = useState<string | null>(null);

  // Guard contra clique-duplo e requisições concorrentes.
  const inflightRef = useRef(false);

  const contextReady = !!specialty.trim() && !!topic.trim();

  // Carrega lista de conversas ao autenticar.
  useEffect(() => {
    if (user?.id) loadConversations();
  }, [user?.id, loadConversations]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (isLoading || inflightRef.current) return;
    if (!contextReady) {
      toast({
        title: "Selecione especialidade e tema",
        description: "O Mentor precisa desse contexto para calibrar a resposta.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id) {
      toast({ title: "Autenticação pendente", description: "Aguarde e tente novamente.", variant: "destructive" });
      return;
    }

    inflightRef.current = true;
    setInput("");
    setIsLoading(true);

    try {
      // Garante conversa persistida (Fase 3).
      let convId = activeConversationId;
      if (!convId) {
        const title = `${specialty} • ${topic}`;
        convId = await createConversation(title, { specialty, topic, mode: "free" });
        if (!convId) {
          toast({ title: "Erro ao criar sessão", variant: "destructive" });
          setIsLoading(false);
          inflightRef.current = false;
          return;
        }
        // Atualiza lista para o histórico refletir a nova conversa.
        loadConversations();
      }

      // Otimista: mostra mensagem do aluno imediatamente.
      setMessages((prev) => [...prev, { role: "user", content: text }]);

      // Persiste mensagem do aluno EXATAMENTE UMA VEZ (Fase 3).
      await saveMessage(convId, "user", text);

      // Chama Tutor com contexto pedagógico completo.
      const response = await callTutorV3(
        {
          messages: [...messages, { role: "user", content: text }],
          topic,
          specialty,
          conversationId: convId,
        },
        { functionName: "tutor-v3-premium", stream: false }
      );

      const data = await response.json();
      const assistantContent = data?.content || data?.message || "";

      if (!assistantContent) {
        toast({
          title: "Resposta vazia",
          description: "O provedor não retornou conteúdo. Tente novamente.",
          variant: "destructive",
        });
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
        await saveMessage(convId, "assistant", assistantContent);
      }
    } catch (err) {
      console.warn("[StudySession] sendMessage failed:", err);
      toast({ title: "Erro no chat", description: "Não foi possível obter resposta.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      inflightRef.current = false;
    }
  };

  const requestTopicChange = (nextTopic: string) => {
    if (nextTopic === topic) return;
    if (!activeConversationId || messages.length === 0) {
      // Sem conversa em andamento: troca livre.
      setTopic(nextTopic);
      return;
    }
    // Conversa ativa → confirma para não misturar assuntos.
    setPendingTopicChange(nextTopic);
  };

  const applyTopicChangeAsNewSession = () => {
    if (pendingTopicChange == null) return;
    setTopic(pendingTopicChange);
    setPendingTopicChange(null);
    startNewSession();
    toast({ title: "Nova sessão iniciada", description: "O tema anterior foi preservado no histórico." });
  };

  const applyTopicChangeKeepConversation = () => {
    if (pendingTopicChange == null) return;
    setTopic(pendingTopicChange);
    setPendingTopicChange(null);
    toast({ title: "Tema atualizado", description: "Mantendo a conversa atual." });
  };

  const conversationList = useMemo(() => conversations, [conversations]);

  return (
    <div className="flex h-screen bg-[#050508] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-black/40 backdrop-blur-md z-20 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white/40 hover:text-white shrink-0"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="h-8 w-px bg-white/5 mx-1 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate max-w-[240px]">{topic || "Sessão de Estudo"}</h1>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest truncate">
                {specialty || "Escolha a especialidade"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewSession}
              className="text-white/60 hover:text-white text-[11px] font-bold uppercase tracking-widest gap-1"
              aria-label="Nova sessão"
            >
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
            <Sheet open={showHistory} onOpenChange={setShowHistory}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white text-[11px] font-bold uppercase tracking-widest gap-1"
                  aria-label="Abrir histórico de conversas"
                >
                  <History className="h-3.5 w-3.5" /> Histórico
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-slate-950 border-white/10 text-white w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="text-white text-sm font-black uppercase tracking-widest">
                    Suas conversas
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-6rem)]">
                  {conversationList.length === 0 && (
                    <p className="text-xs text-white/40">Nenhuma conversa ainda.</p>
                  )}
                  {conversationList.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => loadConversation(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg border transition",
                        activeConversationId === c.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-white/5 hover:bg-white/5"
                      )}
                    >
                      <p className="text-xs font-bold text-white truncate">{c.title || "Sem título"}</p>
                      <p className="text-[10px] text-white/40">{new Date(c.created_at).toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Gate: Especialidade + Tema */}
        {!contextReady && (
          <div className="p-4 border-b border-white/5 bg-black/30 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-400">
              <Stethoscope className="h-3.5 w-3.5" /> Selecione especialidade e tema para iniciar
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger
                  aria-label="Especialidade"
                  className="sm:w-[240px] bg-white/5 border-white/10 text-white"
                >
                  <SelectValue placeholder="Especialidade" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white max-h-[280px]">
                  {SPECIALTY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={topic}
                onChange={(e) => requestTopicChange(e.target.value)}
                placeholder="Tema (ex.: IAM com supra de ST)"
                aria-label="Tema"
                className="flex-1 bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && contextReady && (
            <div className="text-center py-16 text-white/40 text-xs">
              Faça a primeira pergunta sobre <strong className="text-white/70">{topic}</strong> ({specialty}).
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl p-4",
                m.role === "user"
                  ? "bg-primary/10 ml-auto border border-primary/20"
                  : "bg-white/5 mr-auto border border-white/10"
              )}
            >
              <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-white/30 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Mentor pensando...
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-md">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={contextReady ? "Sua dúvida ou resposta..." : "Selecione especialidade e tema acima..."}
              aria-label="Mensagem"
              className="bg-white/5 border-white/10 text-white disabled:opacity-50"
              disabled={!contextReady || isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || !contextReady}
              aria-label="Enviar mensagem"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmação de troca de tema durante conversa ativa */}
      <AlertDialog
        open={pendingTopicChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTopicChange(null);
        }}
      >
        <AlertDialogContent className="bg-slate-950 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar tema para "{pendingTopicChange}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Você está em uma conversa sobre <strong className="text-white/80">{topic}</strong>. Deseja começar uma
              nova sessão para o novo tema (recomendado) ou manter esta conversa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setPendingTopicChange(null)}>Cancelar</AlertDialogCancel>
            <Button variant="secondary" onClick={applyTopicChangeKeepConversation}>
              Manter conversa
            </Button>
            <AlertDialogAction onClick={applyTopicChangeAsNewSession}>Iniciar nova sessão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StudySession = () => (
  <ErrorBoundary>
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 space-y-6">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <div className="text-center">
            <h2 className="text-lg font-black uppercase tracking-widest text-white/80 animate-pulse">
              SESSÃO DE ESTUDO
            </h2>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">
              Sincronizando Ecossistema...
            </p>
          </div>
        </div>
      }
    >
      <StudySessionContent />
    </Suspense>
  </ErrorBoundary>
);

export default memo(StudySession);
