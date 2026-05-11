import { useState, useRef, useEffect, useCallback } from "react";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { createPortal } from "react-dom";
import { Send, Bot, User, Loader2, Plus, History, Trash2, BookOpen, Maximize2, Minimize2, Heart, HeartOff, Lightbulb, AlertTriangle, ChevronDown, Zap, MoreVertical, HelpCircle, Swords } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ChronicleOSCE from "@/components/chronicles/ChronicleOSCE";
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import ChronicleProgressBar from "@/components/chronicles/ChronicleProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ChronicleRenderer from "@/components/chronicles/ChronicleRenderer";
import { useGamification, XP_REWARDS } from "@/hooks/useGamification";

type Msg = { role: "user" | "assistant"; content: string };
interface Conversation { id: string; title: string; created_at: string; }

const SPECIALTIES = [
  "Clínica Médica", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia",
  "Medicina Preventiva", "Urgência e Emergência", "Cardiologia", "Neurologia",
  "Infectologia", "Pneumologia", "Gastroenterologia", "Ortopedia",
  "Dermatologia", "Hematologia", "Oncologia", "Reumatologia",
  "Urologia", "Psiquiatria", "Medicina de Emergência", "Terapia Intensiva",
];

const DIFFICULTIES = [
  { value: "intermediario", label: "🟡 Intermediário" },
  { value: "avancado", label: "🟠 Avançado" },
  { value: "expert", label: "🔴 Expert" },
];

const AGENT_TYPE = "medical-chronicle";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-chronicle`;

const MedicalChronicles = () => {
  const { user } = useAuth();
  const { addXp } = useGamification();
  const { pendingSession, checked, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "chronicles" });
  const [specialty, setSpecialty] = useState("Clínica Médica");
  const [subtopic, setSubtopic] = useState("");
  const [difficulty, setDifficulty] = useState("avancado");
  const [studyStarted, setStudyStarted] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [weakTopics, setWeakTopics] = useState<{ tema: string; count: number }[]>([]);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  // OSCE state
  const [osceData, setOsceData] = useState<any>(null);
  const [osceLoading, setOsceLoading] = useState(false);
  const [chronicleDbId, setChronicleDbId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load weak topics from error_bank for smart suggestions
  const loadWeakTopics = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("error_bank")
      .select("tema, vezes_errado")
      .eq("user_id", user.id)
      .order("vezes_errado", { ascending: false })
      .limit(8);
    if (data && data.length > 0) {
      const grouped = data.reduce((acc, row) => {
        const existing = acc.find(a => a.tema === row.tema);
        if (existing) existing.count += row.vezes_errado;
        else acc.push({ tema: row.tema, count: row.vezes_errado });
        return acc;
      }, [] as { tema: string; count: number }[]);
      setWeakTopics(grouped.sort((a, b) => b.count - a.count).slice(0, 5));
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .eq("agent_type", AGENT_TYPE)
      .order("updated_at", { ascending: false })
      .limit(20);
    setConversations(data || []);
  }, [user]);

  // Check if current conversation is favorited
  const checkFavorite = useCallback(async (convId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("chronicle_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("conversation_id", convId)
      .maybeSingle();
    setIsFavorited(!!data);
  }, [user]);

  useEffect(() => { loadConversations(); loadWeakTopics(); }, [loadConversations, loadWeakTopics]);

  // Auto-save session
  useEffect(() => {
    registerAutoSave(() => {
      if (!studyStarted || messages.length === 0) return {};
      return { messages, activeConversationId, specialty, difficulty, subtopic, currentTopic };
    });
  }, [messages, activeConversationId, specialty, difficulty, subtopic, currentTopic, studyStarted, registerAutoSave]);

  const handleResumeSession = () => {
    if (!pendingSession) return;
    const d = pendingSession.session_data as any;
    if (d.messages?.length) setMessages(d.messages);
    if (d.activeConversationId) setActiveConversationId(d.activeConversationId);
    if (d.specialty) setSpecialty(d.specialty);
    if (d.difficulty) setDifficulty(d.difficulty);
    if (d.subtopic) setSubtopic(d.subtopic);
    if (d.currentTopic) setCurrentTopic(d.currentTopic);
    setStudyStarted(true);
    setXpAwarded(true);
    clearPending();
  };

  // Smart scroll: only auto-scroll if user is near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    setIsNearBottom(nearBottom);
    if (!nearBottom && isLoading) {
      setUserScrolledUp(true);
    }
    if (nearBottom) {
      setUserScrolledUp(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!userScrolledUp && isNearBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, userScrolledUp, isNearBottom]);

  const scrollToBottom = () => {
    setUserScrolledUp(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    if (activeConversationId) checkFavorite(activeConversationId);
    else setIsFavorited(false);
  }, [activeConversationId, checkFavorite]);

  const toggleFavorite = async () => {
    if (!user || !activeConversationId) return;
    if (isFavorited) {
      await supabase.from("chronicle_favorites").delete()
        .eq("user_id", user.id).eq("conversation_id", activeConversationId);
      setIsFavorited(false);
      toast({ title: "Removido dos favoritos" });
    } else {
      await supabase.from("chronicle_favorites").insert({
        user_id: user.id,
        conversation_id: activeConversationId,
        specialty: currentTopic,
      });
      setIsFavorited(true);
      toast({ title: "💖 Crônica salva nos favoritos!" });
    }
  };

  const loadConversation = async (convId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      setStudyStarted(true);
      setCurrentTopic("Sessão anterior");
    }
    setActiveConversationId(convId);
    setShowHistory(false);
    setXpAwarded(true); // already read
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chronicle_favorites").delete().eq("conversation_id", convId);
    await supabase.from("chat_conversations").delete().eq("id", convId);
    if (activeConversationId === convId) startNewSession();
    loadConversations();
  };

  const startNewSession = () => {
    completeSession();
    setActiveConversationId(null);
    setMessages([]);
    setStudyStarted(false);
    setCurrentTopic("");
    setSubtopic("");
    setShowHistory(false);
    setIsFavorited(false);
    setXpAwarded(false);
  };

  const streamResponse = async (body: Record<string, unknown>, allMessages: Msg[]) => {
    setIsLoading(true);
    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast({ title: "Erro", description: errData.error || `Erro ${resp.status}`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const appendChunk = (content: string) => {
        if (!content) return;
        assistantSoFar += content;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      const processSseLine = (rawLine: string): "ok" | "done" | "incomplete" => {
        let line = rawLine;
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") return "ok";
        if (!line.startsWith("data: ")) return "ok";
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return "done";
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) appendChunk(content);
          return "ok";
        } catch {
          return "incomplete";
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          const line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          const result = processSseLine(line);
          if (result === "done") { streamDone = true; break; }
          if (result === "incomplete") { textBuffer = `${line}\n${textBuffer}`; break; }
        }
      }

      textBuffer += decoder.decode();
      if (textBuffer.trim()) {
        for (const line of textBuffer.split("\n")) {
          if (!line) continue;
          const result = processSseLine(line);
          if (result === "done") break;
        }
      }

      // Award XP for completing a chronicle
      if (user && assistantSoFar && !xpAwarded) {
        await addXp(XP_REWARDS.question_answered * 3);
        setXpAwarded(true);

        // Save chronicle to medical_chronicles for OSCE conversion
        try {
          const { data: chrRec } = await supabase.from("medical_chronicles").insert({
            user_id: user.id,
            specialty: specialty,
            topic: currentTopic || specialty,
            subtopic: subtopic || null,
            difficulty,
            content: assistantSoFar,
          }).select("id").single();
          if (chrRec) setChronicleDbId(chrRec.id);
        } catch (e) {
          console.error("Failed to save chronicle:", e);
        }
      }

      // Save to DB
      if (user && assistantSoFar) {
        let convId = activeConversationId;
        if (!convId) {
          const title = currentTopic ? `Crônica: ${currentTopic}` : "Crônica Médica";
          const { data: newConv } = await supabase
            .from("chat_conversations")
            .insert({ user_id: user.id, agent_type: AGENT_TYPE, title: title.slice(0, 60) })
            .select("id")
            .single();
          if (newConv) {
            convId = newConv.id;
            setActiveConversationId(convId);
          }
        }
        if (convId) {
          const lastUserMsg = allMessages[allMessages.length - 1];
          if (lastUserMsg?.role === "user") {
            await supabase.from("chat_messages").insert({
              conversation_id: convId, user_id: user.id, role: "user", content: lastUserMsg.content,
            });
          }
          await supabase.from("chat_messages").insert({
            conversation_id: convId, user_id: user.id, role: "assistant", content: assistantSoFar,
          });
          await supabase.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
          loadConversations();
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao gerar crônica.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChronicle = (overrideTopic?: string) => {
    const topicToUse = overrideTopic || (subtopic.trim() ? `${specialty} — ${subtopic.trim()}` : specialty);
    setStudyStarted(true);
    setCurrentTopic(topicToUse);
    setXpAwarded(false);

    const userMsg: Msg = { role: "user", content: `Crie uma Crônica Médica sobre **${topicToUse}** (nível ${difficulty})` };
    setMessages([userMsg]);

    const topicParts = topicToUse.split(" — ");
    streamResponse(
      { specialty: topicParts[0] || specialty, subtopic: topicParts[1] || subtopic.trim() || undefined, difficulty },
      [userMsg],
    );
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !user) return;
    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");

    streamResponse(
      { messages: allMessages.map(m => ({ role: m.role, content: m.content })) },
      allMessages,
    );
  };

  const handleGenerateOSCE = async () => {
    const chronicleContent = messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n");
    if (!chronicleContent || chronicleContent.length < 200) {
      toast({ title: "Crônica muito curta", description: "Aguarde a geração completa da crônica.", variant: "destructive" });
      return;
    }
    setOsceLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-chronicle-osce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          chronicle_content: chronicleContent,
          specialty,
          topic: currentTopic,
          difficulty,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }
      const data = await resp.json();
      setOsceData(data);
    } catch (e: any) {
      toast({ title: "Erro ao gerar OSCE", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setOsceLoading(false);
    }
  };

  const QUICK_ACTIONS = [
    { label: "🔥 Nível Extremo", prompt: "Agora evolua para nível extremo: adicione complicações graves (choque, arritmia, insuficiência respiratória). Crie uma nova crônica com armadilhas múltiplas e decisão sob pressão máxima." },
    { label: "❓ Mais Questões", prompt: "Gere mais 3 questões de prova sobre o tema desta crônica, estilo USP/ENARE, com gabarito comentado." },
    { label: "🔬 Aprofundar", prompt: "Aprofunde a fisiopatologia do caso desta crônica. Explique os mecanismos moleculares e celulares envolvidos." },
    { label: "⚖️ Diferenciais", prompt: "Faça uma discussão completa dos diagnósticos diferenciais deste caso, com tabela comparativa detalhada." },
    { label: "📖 Nova Crônica", prompt: "Crie uma nova crônica médica completa sobre um tema diferente da mesma especialidade, mantendo o nível de dificuldade." },
  ];

  // If OSCE is active, show OSCE component
  if (osceData) {
    const osceContent = (
      <div className={`flex flex-col animate-fade-in min-w-0 ${isFullscreen ? "fixed inset-0 z-[100] bg-background p-2 sm:p-4" : "h-[calc(100vh-7rem)] sm:h-[calc(100vh-4rem)] overflow-y-auto"}`}>
        <ChronicleOSCE
          osceData={osceData}
          chronicleId={chronicleDbId}
          onBack={() => setOsceData(null)}
        />
      </div>
    );
    if (isFullscreen) return createPortal(osceContent, document.body);
    return osceContent;
  }

  const content = (
    <div className={`flex flex-col animate-fade-in min-w-0 ${isFullscreen ? "fixed inset-0 z-[100] bg-background p-2 sm:p-4" : "h-[calc(100vh-7rem)] sm:h-[calc(100vh-4rem)]"}`}>
      {/* Header */}
      <div className="mb-2 sm:mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 truncate">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <span className="truncate">Crônicas Médicas</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">Narrativas clínicas imersivas no estilo "Mente de Residente"</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 items-center">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {studyStarted && activeConversationId && (
                <DropdownMenuItem onClick={toggleFavorite}>
                  {isFavorited ? <Heart className="h-4 w-4 mr-2 fill-current text-red-400" /> : <HeartOff className="h-4 w-4 mr-2" />}
                  {isFavorited ? "Remover favorito" : "Salvar favorito"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={startNewSession}><Plus className="h-4 w-4 mr-2" /> Nova crônica</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowHistory(!showHistory)}><History className="h-4 w-4 mr-2" /> Histórico</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.open("https://docs.enazizi.com", "_blank")}>
                <HelpCircle className="h-4 w-4 mr-2" /> Como usar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="glass-card p-3 mb-4 max-h-48 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma crônica salva.</p>
          ) : conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                activeConversationId === c.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"
              }`}
            >
              <span className="truncate flex-1 mr-2">{c.title}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={(e) => deleteConversation(c.id, e)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Topic Selection */}
      {!studyStarted && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {pendingSession && (
            <ResumeSessionBanner
              updatedAt={pendingSession.updated_at}
              onResume={handleResumeSession}
              onDiscard={abandonSession}
            />
          )}
          <div className="glass-card p-4 sm:p-6 text-center space-y-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Escolha o tema da crônica</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Você será imerso em um caso clínico cinematográfico — como se estivesse no plantão
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Especialidade</label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Subtema (opcional)</label>
                <Input
                  placeholder="Ex: IAM, Dengue, Meningite..."
                  value={subtopic}
                  onChange={e => setSubtopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStartChronicle()}
                  className="bg-secondary border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Dificuldade</label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={() => handleStartChronicle()} className="glow gap-2 px-6" size="lg">
              <BookOpen className="h-5 w-5" />
              Gerar Crônica
            </Button>
          </div>

          {/* Smart Suggestions from weak topics */}
          {weakTopics.length > 0 && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Sugestões Inteligentes</h3>
                  <p className="text-[10px] text-muted-foreground">Baseado nos seus temas com mais erros</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map((wt) => (
                  <button
                    key={wt.tema}
                    onClick={() => handleStartChronicle(wt.tema)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {wt.tema}
                    <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-amber-500/20">
                      {wt.count}x erros
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      {studyStarted && (
        <>
          {/* Topic indicator + progress bar */}
          <div className="space-y-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium truncate max-w-[60%]">
                📖 {currentTopic}
              </span>
              {xpAwarded && (
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">
                  ✨ XP ganho
                </span>
              )}
            </div>
            {/* Chronicle progress bar */}
            {messages.some(m => m.role === "assistant") && (
              <ChronicleProgressBar content={messages.filter(m => m.role === "assistant").map(m => m.content).join("")} />
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 glass-card p-3 sm:p-6 overflow-y-auto space-y-5 sm:space-y-8 mb-2 sm:mb-4 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </div>
                )}
                <div className={`rounded-xl text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "max-w-[85%] sm:max-w-[75%] bg-primary text-primary-foreground px-3 py-2 sm:px-4 sm:py-3"
                    : "w-full py-1"
                }`}>
                  {msg.role === "assistant" ? (
                    <ChronicleRenderer content={msg.content} />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2 sm:gap-3">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <div className="rounded-xl px-4 py-3 bg-secondary">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />

            {/* Scroll to bottom button */}
            {userScrolledUp && (
              <button
                onClick={scrollToBottom}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary/90 transition-all"
              >
                <ChevronDown className="h-3 w-3" />
                Rolar ao final
              </button>
            )}
          </div>

          {/* Quick actions above input */}
          {messages.length >= 2 && !isLoading && (
            <div className="mb-2">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors sm:hidden"
              >
                <Zap className="h-3 w-3" />
                Ações rápidas
                <ChevronDown className={`h-3 w-3 transition-transform ${showQuickActions ? "rotate-180" : ""}`} />
              </button>
               <div className={`flex flex-wrap gap-1.5 overflow-x-auto ${showQuickActions ? "" : "hidden sm:flex"}`}>
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 flex-shrink-0"
                    onClick={() => sendMessage(action.prompt)}
                    disabled={isLoading}
                  >
                    {action.label}
                  </Button>
                ))}
                {/* OSCE Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 flex-shrink-0 gap-1"
                  onClick={handleGenerateOSCE}
                  disabled={isLoading || osceLoading}
                >
                  {osceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Swords className="h-3 w-3" />}
                  Transformar em Simulação
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Pergunte sobre o caso, peça aprofundamento..."
              className="bg-secondary border-border text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              disabled={isLoading}
            />
            <Button onClick={() => sendMessage(input)} size="icon" className="glow flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10" disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  if (isFullscreen) return createPortal(content, document.body);
  return content;
};

export default MedicalChronicles;
