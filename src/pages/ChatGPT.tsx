import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useStudyContext } from "@/lib/studyContext";
import StudyContextBanner from "@/components/study/StudyContextBanner";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ResumeSessionBanner from "@/components/layout/ResumeSessionBanner";
import { Trash2, ArrowRight } from "lucide-react";
import { useSessionMemory } from "@/contexts/SessionMemoryContext";
import { completeStudyAction } from "@/lib/completeStudyAction";
import { useRefreshUserState } from "@/hooks/useRefreshUserState";
import { Button } from "@/components/ui/button";
import { useTutorCME } from "@/hooks/useTutorCME";

import { FUNCTION_NAME, NON_MEDICAL_KEYWORDS, ensureSequentialInitialMessage } from "@/components/tutor/TutorConstants";
import type { Msg } from "@/components/tutor/TutorConstants";

import { useStreamingResponse } from "@/hooks/tutor/useStreamingResponse";
import { useChatMessages } from "@/hooks/tutor/useChatMessages";
import { useChatProgress } from "@/hooks/tutor/useChatProgress";
import { useChatContext } from "@/hooks/tutor/useChatContext";
import { useTutorPerformance } from "@/hooks/tutor/useTutorPerformance";
import { logVideoRecommendationEvent } from "@/services/tutorVideoRecommendationService";
import { useStudyNext } from "@/hooks/useStudyNext";

import TutorHeader from "@/components/tutor/CinematicTutorHero";
import TutorOnboardingCard from "@/components/tutor/TutorOnboardingCard";
import TutorMetricsBar from "@/components/tutor/TutorMetricsBar";
import TutorStartScreen from "@/components/tutor/TutorStartScreen";
import TutorStepTracker from "@/components/tutor/TutorStepTracker";
import TutorMessageList from "@/components/tutor/TutorMessageList";
import TutorInputBar from "@/components/tutor/TutorInputBar";
import TutorNextStepBlock from "@/components/tutor/TutorNextStepBlock";
import { useSpeechToText } from "@/hooks/tutor/useSpeechToText";
import { useTutorTemporalContext } from "@/hooks/useTutorTemporalContext";

const ChatGPT = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // UI state
  const [topic, setTopic] = useState("");
  const [studyStarted, setStudyStarted] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [changingTopic, setChangingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState("");

  // Mission mode detection from URL params
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tutorMode = searchParams.get("tutor_mode") as "free" | "mission" | null;
  const tutorPhase = searchParams.get("phase") as "correction" | "lesson" | "fixation" | null;
  const tutorOrigin = searchParams.get("tutor_origin") || null;
  const scTaskId = searchParams.get("sc_task_id") || null;
  const missionContext = tutorMode === "mission" ? {
    mode: "mission" as const,
    topic: searchParams.get("sc_topic") || searchParams.get("topic") || undefined,
    error: searchParams.get("error") || undefined,
    phase: tutorPhase || searchParams.get("phase") || undefined,
    objective: searchParams.get("sc_objective") || searchParams.get("objective") || undefined,
    pendingReviews: searchParams.get("pendingReviews") ? Number(searchParams.get("pendingReviews")) : undefined,
    accuracy: searchParams.get("accuracy") ? Number(searchParams.get("accuracy")) : undefined,
    examFocus: searchParams.get("examFocus") || undefined,
    heavyRecovery: searchParams.get("heavyRecovery") === "true",
    origin: tutorOrigin || undefined,
  } : null;

  // Speech to text
  const { isListening, hasSpeechRecognition, toggleListening } = useSpeechToText(
    (text) => setInput((prev) => prev ? prev + " " + text : text)
  );

  // Hooks
  const { streamResponse } = useStreamingResponse();
  const chatMessages = useChatMessages(user?.id);
  const { messages, setMessages, conversations, activeConversationId, showHistory, setShowHistory,
    loadConversations, loadConversation, createConversation, saveMessage, deleteConversation, startNewSession: resetMessages } = chatMessages;
  const progress = useChatProgress(user?.id);
  const { enaziziStep, setEnaziziStep, saveEnaziziStep, getPhaseMap, getNextPhaseInfo } = progress;
  const context = useChatContext(user?.id, currentTopic);
  const { availableUploads, selectedUploadIds, setSelectedUploadIds, showUploads, setShowUploads,
    errorBankData, toggleUpload, buildUserContext } = context;
  const perf = useTutorPerformance(user?.id);
  const { performance, savePerformance, sessionQuestions, setSessionQuestions, sessionCorrect, setSessionCorrect, handleFinishSession } = perf;
  const sessionMemory = useSessionMemory();
  const { findLessonByTopic } = useTutorCME();
  const { data: missionData } = useStudyNext();

  // Session persistence
  const { pendingSession, checked: sessionChecked, saveSession: persistSession, completeSession, abandonSession, registerAutoSave, clearPending } = useSessionPersistence({ moduleKey: "chatgpt" });

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

  // Load enazizi progress
  useEffect(() => {
    if (!user) return;
    const loadProgress = async () => {
      const { data: prog } = await supabase.from("enazizi_progress").select("*").eq("user_id", user.id).maybeSingle();
      if (prog) {
        setEnaziziStep(prog.estado_atual || 1);
        if (prog.tema_atual && prog.estado_atual > 2) setCurrentTopic(prog.tema_atual);
      }
    };
    loadProgress();
  }, [user, setEnaziziStep]);

  // Onboarding
  useEffect(() => {
    const dismissed = localStorage.getItem("tutor-onboarding-dismissed");
    if (!dismissed) setShowOnboarding(true);
  }, []);

  // Load conversations
  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Toggle body overflow for fullscreen
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Auto-save for session persistence
  useEffect(() => {
    registerAutoSave(() => {
      if (!studyStarted || messages.length === 0) return {};
      return { messages, currentTopic, enaziziStep, performance, selectedUploadIds: Array.from(selectedUploadIds), sessionQuestions, sessionCorrect };
    });
  }, [registerAutoSave, studyStarted, messages, currentTopic, enaziziStep, performance, selectedUploadIds, sessionQuestions, sessionCorrect]);

  // Mission-mode auto-start (from MissionMode task routing)
  const missionHandled = useRef(false);
  useEffect(() => {
    if (!user || missionHandled.current) return;
    
    // Explicit mission from URL or auto-fetched from engine
    const activeTopic = missionContext?.topic || (tutorMode === "mission" && missionData?.recommendation ? (missionData.recommendation.contextPayload?.topic as string || missionData.recommendation.title) : null);
    
    if (activeTopic) {
      missionHandled.current = true;

      // Build phase-correct initial prompt
      const phase = missionContext?.phase || (missionData?.recommendation?.type === "error_review" ? "correction" : "fixation");
      let msg: string;
      if (phase === "correction") {
        msg = `MODO CORREÇÃO DE ERROS — Tema: ${activeTopic}. ` +
          `O aluno errou neste tema e precisa de correção direcionada. ` +
          `Identifique os erros comuns, explique por que a alternativa correta é certa e reforce as "golden rules" do tema. ` +
          `Foque no que cai na prova.${missionContext?.error ? ` Erro específico: ${missionContext.error}` : ""}`;
      } else if (phase === "fixation") {
        msg = `MODO REVISÃO/FIXAÇÃO — Tema: ${activeTopic}. ` +
          `O aluno precisa consolidar este tema. Inicie com Active Recall: faça 5 perguntas sequenciais para testar a memorização, ` +
          `depois proponha um caso clínico objetivo (A-D). Foque em pegadinhas de prova.`;
      } else {
        msg = `Quero estudar o tema: ${activeTopic}. ` +
          `Comece com o Bloco Técnico 1 (conceito e definição — explicação técnica baseada na literatura). ` +
          `Estou na etapa 3/15 do Protocolo ENAZIZI.`;
      }

      setStudyStarted(true);
      setMetricsCollapsed(true);
      setCurrentTopic(activeTopic);
      setTopic(activeTopic);

      // Set appropriate step based on phase
      const stepMap: Record<string, number> = { lesson: 3, fixation: 7, correction: 12 };
      const step = stepMap[phase] || 3;
      setEnaziziStep(step);

      setTimeout(() => sendMessage(ensureSequentialInitialMessage(msg)), 500);
    }
  }, [missionContext, user, missionData, tutorMode]);

  // Temporal/Hotspot context auto-start (from VideoLessonPlayer)
  const temporal = useTutorTemporalContext();
  const temporalHandled = useRef(false);
  useEffect(() => {
    if (!user || !searchParams.get("video_ts") || temporalHandled.current) return;
    
    const videoTs = searchParams.get("video_ts");
    const tutorMode = searchParams.get("tutor_mode");
    const ctx = temporal.readContext();
    
    if (temporal.temporalEnabled && ctx && !studyStarted) {
      temporalHandled.current = true;
      const topicToStudy = ctx.topic || ctx.segment_title || "Revisão de Vídeo";
      const timestamp = Math.floor(Number(videoTs));
      const minutes = Math.floor(timestamp / 60);
      const seconds = timestamp % 60;
      
      const modeInstruction = tutorMode === "feynman"
        ? "Modo do Tutor: FEYNMAN — explique com linguagem simples, analogias concretas e sem jargão desnecessário. "
        : tutorMode === "exam_sprint"
          ? "Modo do Tutor: EXAM SPRINT — foque no que cai em prova, pegadinhas, condutas e pontos de alto rendimento. "
          : "";

      const prompt = `${modeInstruction}CONTEXTO TEMPORAL — Vídeo: ${ctx.video_lesson_id}. ` +
        `O aluno pausou aos ${minutes}:${seconds.toString().padStart(2, '0')} (Segmento: ${ctx.segment_title || 'Não identificado'}). ` +
        `O objetivo é tirar uma dúvida específica deste trecho. ` +
        `Contexto do segmento: ${ctx.segment_summary || 'Resumo indisponível'}. ` +
        `Pontos-chave: ${ctx.segment_key_points?.join(', ') || 'N/A'}. ` +
        `Por favor, ajude o aluno com base neste contexto específico, mantendo o Protocolo ENAZIZI.`;

      setStudyStarted(true);
      setMetricsCollapsed(true);
      setCurrentTopic(topicToStudy);
      setTopic(topicToStudy);
      setEnaziziStep(10); // Discussion phase
      
      setTimeout(() => sendMessage(ensureSequentialInitialMessage(prompt)), 500);
    }
  }, [searchParams, user, temporal]);

  // StudyContext-driven auto-start (from guided flows via URL params)
  const studyCtx = useStudyContext();
  const ctxHandled = useRef(false);
  useEffect(() => {
    if (missionContext) return; // skip if mission mode handled
    if (!studyCtx || !user || ctxHandled.current) return;
    if (studyCtx.topic) {
      ctxHandled.current = true;
      const objectiveMap: Record<string, string> = {
        review: "revisão aprofundada",
        reinforcement: "reforço e consolidação",
        new_content: "aprendizado detalhado",
        correction: "correção de erros e reforço",
        practice: "prática e questões",
      };
      const obj = objectiveMap[studyCtx.objective || ""] || "estudo completo";
      const msg = `Quero estudar ${studyCtx.topic}${studyCtx.specialty ? ` (${studyCtx.specialty})` : ""}. Objetivo: ${obj}. Siga o Protocolo ENAZIZI.`;
      setStudyStarted(true);
      setMetricsCollapsed(true);
      setCurrentTopic(studyCtx.topic);
      setTopic(studyCtx.topic);
      setTimeout(() => sendMessage(ensureSequentialInitialMessage(msg)), 500);
    }
  }, [studyCtx, user, missionContext]);

  // Location-state driven auto-start (legacy)
  const errorBankHandled = useRef(false);
  const summaryHandled = useRef(false);
  useEffect(() => {
    const state = location.state as any;
    if (!state || !user) return;
    const startWith = (msg: string, topic: string) => {
      setStudyStarted(true);
      setMetricsCollapsed(true);
      setCurrentTopic(topic);
      setTopic(topic);
      setTimeout(() => sendMessage(ensureSequentialInitialMessage(msg)), 500);
      window.history.replaceState({}, document.title);
    };
    if (state.fromDailyPlan && state.initialMessage && !errorBankHandled.current) {
      errorBankHandled.current = true;
      startWith(state.initialMessage, state.topic || "Estudo Dirigido");
    } else if (state.fromErrorReview && state.initialMessage && !errorBankHandled.current) {
      errorBankHandled.current = true;
      startWith(state.initialMessage, "Revisão Inteligente de Erros");
    } else if (state.fromErrorBank && state.initialMessage && !errorBankHandled.current) {
      errorBankHandled.current = true;
      startWith(state.initialMessage, "Revisão do Banco de Erros");
    } else if (state.fromSimulado && state.initialMessage && !errorBankHandled.current) {
      errorBankHandled.current = true;
      startWith(state.initialMessage, "Revisão de Simulado — Proficiência");
    } else if (state.fromSummary && !summaryHandled.current) {
      summaryHandled.current = true;
      if (state.sharedUploadIds?.length) setSelectedUploadIds(new Set(state.sharedUploadIds));
      const prompt = `Com base neste resumo, continue a explicação aprofundada seguindo o Protocolo ENAZIZI. Aprofunde os pontos mais importantes, faça perguntas de active recall e proponha questões clínicas:\n\n${state.fromSummary.slice(0, 10000)}`;
      startWith(prompt, "Aprofundamento de Resumo");
    }
  }, [user, location.state]);

  // Restore session
  const handleRestoreSession = () => {
    if (!pendingSession) return;
    const data = pendingSession.session_data as any;
    if (data.messages) setMessages(data.messages);
    if (data.currentTopic) { setCurrentTopic(data.currentTopic); setTopic(data.currentTopic); }
    if (data.enaziziStep) setEnaziziStep(data.enaziziStep);
    if (data.performance) perf.setPerformance(data.performance);
    if (data.selectedUploadIds) setSelectedUploadIds(new Set(data.selectedUploadIds));
    if (data.sessionQuestions) setSessionQuestions(data.sessionQuestions);
    if (data.sessionCorrect) setSessionCorrect(data.sessionCorrect);
    setStudyStarted(true);
    setMetricsCollapsed(true);
    clearPending();
  };

  // --- Core send message ---
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !user) return;
    
    const startTime = Date.now();
    const sessionId = activeConversationId || 'pending_session';

    // Topic change detection
    let activeTopic = currentTopic;
    const topicChangeMatch = text.match(/(?:quero estudar|vamos estudar|mudar (?:tema|assunto) (?:para)?|agora (?:quero|vamos) (?:estudar)?)\s+(.+)/i);
    if (topicChangeMatch && studyStarted) {
      const detectedTopic = topicChangeMatch[1].replace(/[.!?]+$/, "").trim();
      if (detectedTopic && detectedTopic.toLowerCase() !== currentTopic.toLowerCase()) {
        setCurrentTopic(detectedTopic);
        activeTopic = detectedTopic;
        setEnaziziStep(1); // Reset para o Bloco 1 (Caso Vivo) no padrão V3
        setChangingTopic(false);
        saveEnaziziStep(1, detectedTopic, performance, sessionQuestions);
        savePerformance({ tema_atual: detectedTopic });
      }
    }

    // 1. Telemetry: Message Received
    logVideoRecommendationEvent('message_received' as any, { 
      topic: activeTopic, 
      conversationId: sessionId,
      content_length: text.length 
    });

    const userMsg: Msg = { role: "user", content: text };
    
    // Check for related video lessons to inform the AI
    let videoContext = "";
    if (activeTopic) {
      // 2. Telemetry: Topic Detected
      logVideoRecommendationEvent('topic_detected' as any, { 
        topic: activeTopic, 
        conversationId: sessionId 
      });

      const lesson = await findLessonByTopic(activeTopic, sessionId);
      if (lesson) {
        // 3. Telemetry: Video Found handled via findLessonByTopic -> service
        videoContext = `\n\n[CONTEXTO DE VÍDEO: Encontrei uma videoaula disponível sobre "${activeTopic}". O sistema já exibiu o link para o aluno no topo da sua resposta. Por favor, obrigatoriamente recomende no início da sua resposta que ele assista ao vídeo antes de prosseguir com a explicação detalhada.]`;
      }
    }

    const allMessages = [...messages, userMsg];
    if (videoContext) {
      allMessages[allMessages.length - 1].content += videoContext;
    }
    
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(text);
    }
    if (convId) await saveMessage(convId, "user", text);

    // Add placeholder assistant message
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    // 4. Telemetry: Answer Generation Started
    logVideoRecommendationEvent('answer_generation_started' as any, { 
      topic: activeTopic, 
      conversationId: convId || sessionId 
    });

    const contextToSend = buildUserContext();
    await streamResponse({
      url: CHAT_URL,
      body: {
        messages: allMessages.map(m => ({ role: m.role, content: m.content })),
        userContext: contextToSend || undefined,
        enazizi_progress: {
          estado_atual: enaziziStep,
          tema_atual: currentTopic || null,
          questoes_respondidas: performance.questoes_respondidas + sessionQuestions,
          taxa_acerto: performance.taxa_acerto,
          pontuacao_discursiva: performance.pontuacao_discursiva,
          temas_fracos: performance.temas_fracos,
        },
        error_bank: errorBankData.length > 0 ? errorBankData : undefined,
        session_memory: sessionMemory.getMemoryPayload(),
        mission_context: missionContext || undefined,
      },
      onChunk: (fullText) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullText } : m);
          }
          return [...prev, { role: "assistant", content: fullText }];
        });
      },
      onComplete: async (finalText) => {
        setIsLoading(false);
        
        // 5. Telemetry: Answer Generation Completed
        logVideoRecommendationEvent('answer_generation_completed' as any, { 
          topic: activeTopic, 
          conversationId: convId || sessionId,
          duration_ms: Date.now() - startTime,
          response_length: finalText?.length || 0
        });
        // Save assistant message
        if (convId && finalText) {
          await saveMessage(convId, "assistant", finalText);
          loadConversations();

          // Error detection for error_bank
          if (user && currentTopic) {
            const errorPatterns = [
              /(?:incorret|errad|não está corret|resposta errada|infelizmente|não é essa)/i,
              /alternativa correta[:\s]+([A-D])/i,
              /a resposta (?:correta|certa) (?:é|seria|era)/i,
            ];
            const hasError = errorPatterns.some(p => p.test(finalText));
            // Record in session memory
            sessionMemory.recordAnswer(currentTopic, !hasError, text, hasError ? finalText.slice(0, 200) : undefined);
            if (hasError) {
              const subtemaMatch = finalText.match(/(?:subtema|tópico|sobre):\s*([^\n.]+)/i);
              const categoriaMatch = finalText.match(/\[ERRO_TIPO:(\w+)\]/i);
              const motivoMatch = finalText.match(/\[ERRO_MOTIVO:([^\]]+)\]/i);
              const errorData = {
                user_id: user.id, tema: currentTopic,
                subtema: subtemaMatch?.[1]?.trim() || null,
                tipo_questao: enaziziStep >= 9 && enaziziStep <= 10 ? "objetiva" : enaziziStep >= 11 && enaziziStep <= 12 ? "discursiva" : "active_recall",
                conteudo: finalText.slice(0, 300),
                motivo_erro: motivoMatch?.[1]?.trim() || null,
                categoria_erro: categoriaMatch?.[1]?.trim() || null,
                dificuldade: 3, vezes_errado: 1,
              };
              const { data: existing } = await supabase.from("error_bank").select("id, vezes_errado").eq("user_id", user.id).eq("tema", errorData.tema).eq("tipo_questao", errorData.tipo_questao).maybeSingle();
              if (existing) {
                await supabase.from("error_bank").update({ vezes_errado: (existing.vezes_errado || 1) + 1, updated_at: new Date().toISOString(), conteudo: finalText.slice(0, 300) }).eq("id", existing.id);
              } else {
                await supabase.from("error_bank").insert(errorData);
              }
              // Suggest mnemonic if ≥2 errors on same topic
              const errorCount = existing ? (existing.vezes_errado || 1) + 1 : 1;
              if (errorCount >= 2) {
                toast({
                  title: "🧠 Dica: Gerar Mnemônico",
                  description: `Você já errou ${errorCount}x em "${currentTopic}". Um mnemônico pode ajudar a fixar!`,
                  action: (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => navigate("/dashboard/mnemonico", { state: { prefillTopic: currentTopic, fromErrorBank: true } })}
                    >
                      Gerar
                    </Button>
                  ),
                });
              }
            }
          }
        }
        setIsLoading(false);
      },
      onError: (errMsg) => {
        setIsLoading(false);
        toast({ title: "Erro na geração", description: "O Tutor permanece disponível para apoio pedagógico. Tente novamente.", variant: "destructive" });
        
        // 6. Telemetry: Answer Generation Failed
        logVideoRecommendationEvent('answer_generation_failed' as any, { 
          topic: activeTopic, 
          conversationId: convId || sessionId,
          error: errMsg,
          duration_ms: Date.now() - startTime
        });
        
        // Remove empty assistant placeholder
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
          return prev;
        });
      },
    });
  };

  // --- Handlers ---
  const handleStartStudy = (overrideTopic?: string) => {
    const t = overrideTopic || topic;
    if (!t.trim()) return;
    if (NON_MEDICAL_KEYWORDS.test(t)) {
      toast({ title: "⛔ Tema não médico", description: "Esta plataforma é exclusiva para Residência Médica. Por favor, escolha um tema de medicina.", variant: "destructive" });
      return;
    }
    setStudyStarted(true);
    setMetricsCollapsed(true);
    setCurrentTopic(t);
    sessionMemory.recordTopicChange(t);
    setSessionQuestions(0);
    setSessionCorrect(0);
    setEnaziziStep(3);
    savePerformance({ tema_atual: t });
    saveEnaziziStep(3, t, performance, sessionQuestions);
    sendMessage(`Quero estudar o tema: ${t}. Comece com o Bloco Técnico 1 (conceito e definição — explicação técnica baseada na literatura). Estou na etapa 3/15 do Protocolo ENAZIZI.`);
  };

  // Inicia o Modo Feynman: protocolo socrático de 10 passos sobre o tema escolhido.
  // Reaproveita 100% o pipeline do Tutor (chatgpt-agent + memória + telemetria).
  const handleStartFeynman = (overrideTopic?: string) => {
    const t = (overrideTopic || topic || "").trim();
    if (!t) return;
    if (NON_MEDICAL_KEYWORDS.test(t)) {
      toast({ title: "⛔ Tema não médico", description: "O Modo Feynman aqui é exclusivo para temas de Medicina.", variant: "destructive" });
      return;
    }
    setStudyStarted(true);
    setMetricsCollapsed(true);
    setCurrentTopic(t);
    sessionMemory.recordTopicChange(t);
    setSessionQuestions(0);
    setSessionCorrect(0);
    setEnaziziStep(3);
    savePerformance({ tema_atual: t });
    saveEnaziziStep(3, t, performance, sessionQuestions);

    const feynmanPrompt =
`MODO FEYNMAN — Tema: ${t}.

Conduza o aluno pelo Método Feynman aplicado à Medicina, em 10 passos sequenciais. NÃO entregue tudo de uma vez: avance UM passo por mensagem, faça perguntas socráticas e só siga adiante quando o aluno responder.

Passos do protocolo (siga nesta ordem):
1. **Escolha um conceito específico** — Confirme com o aluno qual recorte exato de "${t}" será trabalhado (ex.: definição, fisiopatologia, diagnóstico, tratamento). Pergunte e espere a resposta.
2. **Estude até entender o básico** — Apresente um resumo técnico curto e direto do conceito escolhido (3-5 linhas, baseado na literatura). Pergunte se ficou claro antes de seguir.
3. **Explique como se fosse para uma criança** — Peça ao aluno para explicar o conceito com palavras simples, como se ensinasse a um leigo. Aguarde a resposta dele.
4. **Identifique lacunas** — Avalie a explicação do aluno em 4 critérios (Clareza ✨, Completude 📋, Precisão 🎯, Simplicidade 💬). Aponte exatamente onde travou ou simplificou demais. Seja rigoroso e específico.
5. **Use linguagem simples** — Mostre como reformular os trechos técnicos em linguagem acessível, sem perder precisão clínica.
6. **Crie analogias práticas** — Proponha 1-2 analogias clínicas ou cotidianas que ancorem o conceito na memória.
7. **Reorganize a explicação** — Estruture o conteúdo em começo (definição), meio (mecanismo/clínica) e fim (conduta/relevância).
8. **Ensine para alguém real** — Peça uma nova explicação completa do aluno, agora consolidada. Avalie de novo nos 4 critérios.
9. **Revise os pontos fracos** — Liste os 2-3 pontos onde o aluno ainda falha e proponha um mini-quiz objetivo (A-D) sobre o mais crítico.
10. **Repita o processo** — Resuma o aprendizado, ofereça flashcards FSRS dos pontos fracos identificados e sugira o próximo recorte do tema para repetir o ciclo.

Regras:
- Seja socrático: pergunte mais do que entregue.
- Marque cada mensagem com o passo atual (ex.: "**Passo 3/10 — Explique como para uma criança**").
- Use a metodologia ENAZIZI nas explicações técnicas (MBE, golden rules, pegadinhas de prova).
- No passo 9, se detectar erro grave, registre no banco de erros usando os marcadores [ERRO_TIPO:...] e [ERRO_MOTIVO:...].

Comece agora pelo Passo 1.`;

    sendMessage(feynmanPrompt);
  };

  const handleChangeTopic = () => {
    if (!newTopic.trim()) return;
    if (NON_MEDICAL_KEYWORDS.test(newTopic)) {
      toast({ title: "⛔ Tema não médico", description: "Esta plataforma é exclusiva para Residência Médica.", variant: "destructive" });
      return;
    }
    setChangingTopic(false);
    setTopic(newTopic);
    setMessages(prev => [...prev, { role: "user" as const, content: `--- MUDANÇA DE TEMA ---\nNovo tema: ${newTopic}` }]);
    setCurrentTopic(newTopic);
    setEnaziziStep(3);
    saveEnaziziStep(3, newTopic, performance, sessionQuestions);
    savePerformance({ tema_atual: newTopic });
    sendMessage(`MUDANÇA DE TEMA: Quero mudar para o tema "${newTopic}". Reinicie o fluxo pedagógico. Comece do STATE 2 — Bloco Técnico 1 (conceito e definição) sobre ${newTopic}.`);
    setNewTopic("");
  };

  const handlePhaseAction = (phase: string) => {
    const phaseMap = getPhaseMap(currentTopic);
    const action = phaseMap[phase];
    if (action) {
      setEnaziziStep(action.step);
      saveEnaziziStep(action.step, currentTopic, performance, sessionQuestions);
      sendMessage(action.prompt);
    }
  };

  const handleGoBackStep = () => {
    if (enaziziStep <= 3) return;
    const prevStep = enaziziStep - 1;
    // Find the phase key for the previous step
    const stepToPhaseKey: Record<number, string> = {
      3: "tecnico1", 4: "leigo1", 5: "tecnico2", 6: "leigo2",
      7: "tecnico3", 8: "leigo3", 9: "questions", 10: "discussion",
      11: "discursive", 12: "correction", 13: "update", 14: "consolidation", 15: "feynman",
    };
    const phaseKey = stepToPhaseKey[prevStep];
    const phaseMap = getPhaseMap(currentTopic);
    const action = phaseMap[phaseKey];
    setEnaziziStep(prevStep);
    saveEnaziziStep(prevStep, currentTopic, performance, sessionQuestions);
    if (action) {
      sendMessage(`Volte para a etapa anterior. ${action.prompt}`);
    } else {
      // Step 3 = first technical block
      sendMessage(`Volte para o Bloco Técnico 1 (conceito e definição) sobre ${currentTopic}. Repita a explicação técnica.`);
    }
  };

  const { refreshAll } = useRefreshUserState();
  const [showMissionReturn, setShowMissionReturn] = useState(false);
  const savedTopicForReturn = useRef("");

  const onFinishSession = async () => {
    await handleFinishSession(currentTopic, completeSession, async (step, tema) => {
      await saveEnaziziStep(step, tema, performance, sessionQuestions);
    });

    // FSRS card creation for the studied topic
    if (user?.id && currentTopic) {
      try {
        const { data: existing } = await supabase.from("fsrs_cards")
          .select("id").eq("user_id", user.id).eq("card_ref_id", currentTopic).eq("card_type", "tema").maybeSingle();
        if (!existing) {
          await supabase.from("fsrs_cards").insert({
            user_id: user.id, card_ref_id: currentTopic, card_type: "tema",
            difficulty: 5, stability: 1, state: 0, reps: 0, lapses: 0,
            elapsed_days: 0, scheduled_days: 1, due: new Date().toISOString(),
          });
        }
      } catch {}
    }

    // If error_review origin, mark errors as reviewed
    if (user?.id && tutorOrigin === "error_review" && currentTopic) {
      try {
        await supabase.from("error_bank").update({ dominado: true, dominado_em: new Date().toISOString() })
          .eq("user_id", user.id).eq("tema", currentTopic).eq("dominado", false);
      } catch {}
    }

    // Refresh global state
    if (user?.id && currentTopic) {
      await completeStudyAction({
        userId: user.id,
        taskType: tutorOrigin === "error_review" ? "error_review" : "tutor",
        topic: currentTopic,
        source: "auto",
        originModule: "chatgpt",
      });
    }
    refreshAll();

    // Show return-to-mission CTA if came from mission
    if (tutorMode === "mission") {
      savedTopicForReturn.current = currentTopic;
      setShowMissionReturn(true);
      return; // Don't reset UI yet — show the CTA
    }

    setStudyStarted(false);
    setCurrentTopic("");
    setMessages([]);
    chatMessages.setActiveConversationId(null);
    setMetricsCollapsed(false);
  };

  const handleReturnToMission = () => {
    setShowMissionReturn(false);
    setStudyStarted(false);
    setCurrentTopic("");
    setMessages([]);
    chatMessages.setActiveConversationId(null);
    navigate("/mission");
  };

  const onNewSession = () => {
    resetMessages();
    setStudyStarted(false);
    setCurrentTopic("");
    setTopic("");
    setSessionQuestions(0);
    setSessionCorrect(0);
    setMetricsCollapsed(false);
  };

  const onLoadConversation = async (convId: string) => {
    const hasData = await loadConversation(convId);
    if (hasData) {
      setStudyStarted(true);
      setMetricsCollapsed(true);
      setCurrentTopic("Sessão anterior");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Estudante";
  const nextPhase = getNextPhaseInfo(enaziziStep);

  // Mission return overlay
  if (showMissionReturn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md w-full rounded-2xl border border-primary/30 bg-card shadow-2xl p-8 text-center space-y-6 animate-fade-in">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">✅</span>
          </div>
          <div>
            <h2 className="text-xl font-bold">Sessão Concluída!</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Você estudou <span className="font-semibold text-foreground">{savedTopicForReturn.current || currentTopic || "o tema"}</span> com sucesso.
            </p>
            {tutorOrigin === "error_review" && (
              <p className="text-xs text-primary mt-2">✓ Erros marcados como revisados</p>
            )}
          </div>
          <Button className="w-full gap-2 h-14 text-base" size="lg" onClick={handleReturnToMission}>
            <ArrowRight className="h-5 w-5" />
            CONTINUAR MISSÃO
          </Button>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setShowMissionReturn(false);
              setStudyStarted(false);
              setCurrentTopic("");
              setMessages([]);
              navigate("/dashboard");
            }}
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  const content = (
    <div className={`flex flex-col animate-fade-in min-w-0 w-full ${isFullscreen ? "fixed inset-0 z-[100] bg-background p-3 sm:p-6 overflow-hidden" : "h-full"}`}>
      <TutorHeader
        isFullscreen={isFullscreen} setIsFullscreen={setIsFullscreen}
        studyStarted={studyStarted} taxaAcerto={performance.taxa_acerto}
        showHistory={showHistory} setShowHistory={setShowHistory}
        onFinishSession={onFinishSession} onNewSession={onNewSession}
        onShowOnboarding={() => setShowOnboarding(true)}
      />

      {!isFullscreen && <StudyContextBanner />}

      {!isFullscreen && sessionChecked && pendingSession && !studyStarted && (
        <ResumeSessionBanner updatedAt={pendingSession.updated_at} onResume={handleRestoreSession} onDiscard={abandonSession} />
      )}

      {!isFullscreen && showOnboarding && !studyStarted && (
        <TutorOnboardingCard onDismiss={() => { setShowOnboarding(false); localStorage.setItem("tutor-onboarding-dismissed", "true"); }} />
      )}

      {!isFullscreen && <TutorMetricsBar performance={performance} metricsCollapsed={metricsCollapsed} setMetricsCollapsed={setMetricsCollapsed} />}

      {!studyStarted && (
        <TutorStartScreen
          displayName={displayName} topic={topic} setTopic={setTopic}
          onStartStudy={handleStartStudy} onStartFeynman={handleStartFeynman}
          performance={performance} availableUploads={availableUploads} selectedUploadIds={selectedUploadIds}
          showUploads={showUploads} setShowUploads={setShowUploads} toggleUpload={toggleUpload}
        />
      )}

      {showHistory && (
        <div className="glass-card p-3 mb-3 max-h-48 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma conversa salva.</p>
          ) : conversations.map(c => (
            <div key={c.id} onClick={() => onLoadConversation(c.id)} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${activeConversationId === c.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
              <span className="truncate flex-1 mr-2">{c.title}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {studyStarted && (
        <>
          <TutorStepTracker
            currentTopic={currentTopic} enaziziStep={enaziziStep}
            sessionQuestions={sessionQuestions} sessionCorrect={sessionCorrect}
            isLoading={isLoading} changingTopic={changingTopic} setChangingTopic={setChangingTopic}
            newTopic={newTopic} setNewTopic={setNewTopic} onChangeTopic={handleChangeTopic}
            onPhaseAction={handlePhaseAction} onGoBackStep={handleGoBackStep} nextPhase={nextPhase}
          />

          {/* Handoff Tutor → Sessão de Estudo */}
          {currentTopic && tutorMode !== "mission" && (
            <div className="px-3 pb-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                title="Abrir o ciclo guiado de aprendizado deste tema"
                onClick={() => {
                  const params = new URLSearchParams({
                    topic: currentTopic,
                    auto: "1",
                    origin: "tutor-handoff",
                  });
                  navigate(`/dashboard/sessao-estudo?${params.toString()}`);
                }}
              >
                <ArrowRight className="h-3 w-3" />
                Ir para Sessão de Estudo deste tema
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                title="Treinar 10 questões deste tema"
                onClick={() => {
                  const params = new URLSearchParams({
                    sc_source: "tutor-handoff",
                    sc_taskType: "practice",
                    sc_objective: "practice",
                    sc_topic: currentTopic,
                    sc_difficulty: "misto",
                    sc_count: "10",
                  });
                  navigate(`/dashboard/simulados?${params.toString()}`);
                }}
              >
                Gerar questões deste assunto
              </Button>
            </div>
          )}

          <TutorMessageList 
            ref={scrollRef} 
            messages={messages} 
            isLoading={isLoading} 
            onCopy={copyToClipboard}
            conversationId={activeConversationId || undefined}
            topic={currentTopic}
            specialty={searchParams.get("specialty") || undefined}
          />

          {/* Próximo passo fixo — só após concluir todos os blocos de explicação (step >= 8) */}
          {messages.length > 1 && !isLoading && enaziziStep >= 8 && (
            <TutorNextStepBlock
              topic={currentTopic || topic || null}
              specialty={searchParams.get("sc_specialty") || searchParams.get("specialty") || null}
            />
          )}

          <TutorInputBar
            input={input} setInput={setInput} isLoading={isLoading}
            onSend={() => sendMessage(input)}
            isListening={isListening}
            hasSpeechRecognition={hasSpeechRecognition}
            onToggleListening={toggleListening}
          />
        </>
      )}
    </div>
  );

  if (isFullscreen) return createPortal(content, document.body);
  return content;
};

export default ChatGPT;
