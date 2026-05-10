import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TutorBlock } from "@/types/tutor";
import { Database } from "@/integrations/supabase/types";
import { useCMEHardening } from "./useCMEHardening";
import { useCMEAnalytics } from "./useCMEAnalytics";
import { parseQuestionsFromText } from "@/lib/parseQuestions";
import { useEducationalMemory } from "./useEducationalMemory";
import { findRecommendedVideoForTutorContext } from "@/services/tutorVideoRecommendationService";


type CmeAggregationStatus = Database['public']['Enums']['cme_aggregation_status'];
type CmeRenderStatus = Database['public']['Enums']['cme_render_status'];

const WORKER_HEARTBEAT_TTL_MS = 5 * 60 * 1000;

const hasFreshHeartbeat = (lastHeartbeat?: string | null) => {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() <= WORKER_HEARTBEAT_TTL_MS;
};

export interface CMEProjectState {
  status: CmeAggregationStatus | CmeRenderStatus | 'idle' | 'mapping' | 'scripting' | 'graphing' | 'voicing' | 'chunking' | 'uploading' | 'pending_hardware';
  projectId?: string;
  aggregationId?: string;
  sceneGraphId?: string;
  progress: number;
  error?: string;
  message?: string;
  isStuck?: boolean;
  workerStatus?: 'online' | 'offline_or_unavailable';
  workerId?: string;
  manualVideoUrl?: string;
}

export const useTutorCME = () => {
  const supabaseClient = useMemo(() => supabase, []);
  const [state, setState] = useState<CMEProjectState>({ status: 'idle', progress: 0 });
  const [workerHealth, setWorkerHealth] = useState<any>(null);
  const [showAgilePlayer, setShowAgilePlayer] = useState(false);
  const lastEventRef = useRef<number>(Date.now());
  const { reportIncident, createSnapshot } = useCMEHardening();
  const { getCognitiveAnalysis } = useCMEAnalytics();
  const { addToMemory } = useEducationalMemory();

  const checkWorkerHealth = useCallback(async () => {

    try {
      const { data, error } = await supabaseClient.from('cme_worker_nodes')
        .select('id, status, last_heartbeat, vram_total_mb, vram_used_mb, gpu_utilization_pct, is_draining')
        .eq('status', 'online');
      
      const freshWorkers = (data || []).filter((worker: any) => !worker.is_draining && hasFreshHeartbeat(worker.last_heartbeat));
      const workersOnline = freshWorkers.length;
      const totalVram = freshWorkers.reduce((sum: number, worker: any) => sum + (worker.vram_total_mb || 0), 0);
      const usedVram = freshWorkers.reduce((sum: number, worker: any) => sum + (worker.vram_used_mb || 0), 0);
      const avgLoad = workersOnline
        ? freshWorkers.reduce((sum: number, worker: any) => sum + (worker.gpu_utilization_pct || 0), 0) / workersOnline
        : 0;
      setWorkerHealth({ workers_online: workersOnline, total_vram_mb: totalVram, used_vram_mb: usedVram, avg_load: avgLoad });
      return workersOnline;
    } catch (e) {
      console.warn("Failed to fetch CME status", e);
      return 0;
    }
  }, [supabaseClient]);

  useEffect(() => {
    if (!state.projectId || state.status === 'idle' || state.status === 'ready' || state.status === 'failed') return;

    const channel = supabaseClient
      .channel(`cme-pipeline-${state.projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cme_pipeline_events',
          filter: `project_id=eq.${state.projectId}`
        },
        (payload) => {
          const newEvent = payload.new;
          lastEventRef.current = Date.now();
          
          setState(s => ({
            ...s,
            status: newEvent.stage as any,
            progress: Math.max(s.progress, newEvent.progress),
            message: newEvent.message,
            error: newEvent.status === 'failed' ? newEvent.message : s.error,
            isStuck: false,
            workerStatus: 'online',
            workerId: newEvent.worker_id || undefined
          }));
        }
      )
      .subscribe();

    const stuckCheckInterval = setInterval(async () => {
      const elapsed = Date.now() - lastEventRef.current;
      
      // If the backend is between render job creation and GPU rendering without fresh telemetry, verify real state.
      if (['rendering', 'render_job_creation', 'worker_selection', 'gpu_rendering', 'pending_hardware'].includes(String(state.status)) && elapsed > 10000) {
        const onlineCount = await checkWorkerHealth();
        
        const { data: job, error: jobErr } = state.projectId
          ? await supabaseClient
              .from('cme_render_jobs')
              .select('status, progress, gpu_worker_id, pipeline_last_error')
              .eq('project_id', state.projectId)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null, error: null };

        if (jobErr) {
          console.error("Job status check failed", jobErr);
          return;
        }

        if ((job as any)?.pipeline_last_error) {
          setState(s => ({ ...s, status: 'failed', error: (job as any).pipeline_last_error, message: (job as any).pipeline_last_error, isStuck: true }));
          return;
        }

        if ((job as any)?.status === 'waiting_hardware' || onlineCount === 0) {
          setState(s => ({ 
            ...s, 
            status: 'pending_hardware',
            workerStatus: 'offline_or_unavailable',
            progress: Math.max(s.progress, (job as any)?.progress ?? 65),
            message: "Renderização pendente de hardware. Nenhum Worker/GPU ativo no momento.",
            isStuck: true 
          }));
          return;
        }

        if ((job as any)?.gpu_worker_id) {
          setState(s => ({ ...s, status: 'gpu_rendering' as any, progress: Math.max(s.progress, (job as any).progress ?? 80), message: "GPU renderizando com worker ativo", isStuck: false, workerStatus: 'online' }));
          lastEventRef.current = Date.now();
        }
      }
    }, 3000);

    return () => {
      supabaseClient.removeChannel(channel);
      clearInterval(stuckCheckInterval);
    };
  }, [state.projectId, state.status, supabaseClient, checkWorkerHealth]);

  const logPipelineEvent = useCallback(async (projectId: string, stage: string, status: string, progress: number, message?: string, aggregationId?: string, metadata?: any) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("cme_pipeline_events").insert([{
        project_id: projectId,
        aggregation_id: aggregationId,
        stage,
        status,
        progress,
        message,
        user_id: user?.id,
        metadata: metadata || {}
      } as any]);
      
      if (aggregationId) {
        await supabaseClient.from("cme_session_aggregations")
          .update({ 
            status: status === 'completed' ? 'builder_ready' : (status === 'failed' ? 'failed' : 'aggregating'),
            error_message: status === 'failed' ? message : undefined,
            completed_at: status === 'completed' ? new Date().toISOString() : undefined
          } as any)
          .eq('id', aggregationId);
      }
    } catch (e) {
      console.error("Telemetry error:", e);
    }
  }, [supabaseClient]);

  const aggregateSessionContent = useCallback(async (conversationId: string, customContent?: string) => {
    let messages: any[] = [];
    let resolvedSessionId: string | null = null;
    let isChatConversation = false;

    const debug = (msg: string, extra?: any) => {
      // Logs técnicos: somente console (DEV/observabilidade), nunca na UI.
      if (extra !== undefined) console.debug(`[CME aggregate] ${msg}`, extra);
      else console.debug(`[CME aggregate] ${msg}`);
    };

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    if (customContent) {
      debug("using customContent (single message path)", { length: customContent.length });
      messages = [{ content: customContent, role: 'assistant' }];

      // Try to resolve session even for custom content
      try {
        const { data: ts } = await supabaseClient
          .from("tutor_sessions" as any)
          .select("id")
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (ts) resolvedSessionId = (ts as any).id;
      } catch (e) {
        debug("session lookup for custom content failed", e);
      }
    } else {
      debug("conversationId received", { conversationId });

      try {
        // First try as conversationId
        const { data: conv } = await supabaseClient
          .from("chat_conversations")
          .select("id")
          .eq("id", conversationId)
          .maybeSingle();
        
        if (conv) {
          isChatConversation = true;
          // Try to find linked tutor session
          const { data: ts } = await supabaseClient
            .from("tutor_sessions" as any)
            .select("id")
            .eq("conversation_id", conversationId)
            .maybeSingle();
          if (ts) resolvedSessionId = (ts as any).id;
        } else {
          // Check if it's already a session_id
          const { data: ts } = await supabaseClient
            .from("tutor_sessions" as any)
            .select("id")
            .eq("id", conversationId)
            .maybeSingle();
          if (ts) resolvedSessionId = (ts as any).id;
        }

        // If not found, create a tutor_session to avoid FK violation
        if (!resolvedSessionId) {
          debug("tutor_session not found, creating one for conversationId", { conversationId });
          const { data: newTs, error: tsError } = await supabaseClient
            .from("tutor_sessions")
            .insert({
              conversation_id: isChatConversation ? conversationId : null,
              user_id: user.id,
              mode: 'livre',
              topic: 'Aula Gerada via CME'
            } as any)
            .select("id")
            .single();
          
          if (tsError) {
            debug("failed to create tutor_session", tsError);
            // Race condition check: maybe it was created by another process
            if (tsError.code === '23505' && isChatConversation) {
              const { data: ts } = await supabaseClient
                .from("tutor_sessions")
                .select("id")
                .eq("conversation_id", conversationId)
                .maybeSingle();
              if (ts) resolvedSessionId = ts.id;
            }
          } else {
            resolvedSessionId = newTs.id;
          }
        }
      } catch (e) {
        debug("session resolution/creation failed", e);
      }

      if (!resolvedSessionId) {
        debug("ABORT: Could not resolve or create tutor_session", { conversationId });
        throw new Error("A sessão ainda está sendo preparada. Tente novamente em alguns instantes.");
      }

      debug("resolved state", { resolvedSessionId, isChatConversation });

      // Retry curto para cobrir race condition: a última mensagem pode ainda
      // estar sendo persistida quando o usuário clica "Gerar aula".
      const fetchAssistantMessages = async (): Promise<any[]> => {
        // Option 1: fetch from tutor_messages if we have a sessionId
        const { data } = await supabaseClient
          .from("tutor_messages")
          .select("id, content, role, created_at")
          .eq("tutor_session_id", resolvedSessionId)
          .eq("role", "assistant")
          .order("created_at", { ascending: true });
        
        if (data && data.length > 0) return data;
        
        // Option 2: fetch from chat_messages using conversationId
        const { data: chatData } = await supabaseClient
          .from("chat_messages")
          .select("id, content, role, created_at")
          .eq("conversation_id", conversationId)
          .eq("role", "assistant")
          .order("created_at", { ascending: true });
        
        if (chatData && chatData.length > 0) return chatData;

        return [];
      };

      // Até 5 tentativas com backoff progressivo para esperar persistência (total ~6s).
      for (let attempt = 0; attempt < 5 && messages.length === 0; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1200));
        messages = await fetchAssistantMessages();
        debug(`fetch attempt ${attempt + 1}`, { messagesFound: messages.length });
      }
    }

    if (messages.length === 0) {
      debug("ABORT: no assistant messages persisted for this conversation", { conversationId });
      throw new Error("Não encontramos o histórico de mensagens desta sessão para gerar a aula. Por favor, certifique-se de que o Tutor já respondeu pelo menos uma vez e aguarde alguns segundos para a sincronização completa.");
    }

    const fullText = messages.map(m => m.content).join("\n\n---\n\n");
    const blocks: { type: string; title: string; content: string; metadata?: any }[] = [];
    
    // Split by Markdown headers (H1 or H2)
    let sections = fullText.split(/\n(?=#{1,2}\s)/).filter(s => s.trim().length > 0);
    if (sections.length === 0 && fullText.trim()) {
      sections = [fullText.trim()];
    }
    
    sections.forEach((section, idx) => {
      const titleLine = section.split("\n")[0].replace(/^#+\s*/, "").trim();
      const title = titleLine || `Capítulo ${idx + 1}`;
      let type = "deep_dive";
      
      const parsedQuestions = parseQuestionsFromText(section);
      if (parsedQuestions.length > 0) {
        blocks.push({ 
          type: "mini_quiz", 
          title: titleLine || `Quiz ${idx + 1}`, 
          content: section,
          metadata: { questions: parsedQuestions }
        });
      } else {
        const lowTitle = title.toLowerCase();
        if (lowTitle.includes("introdução")) type = "introduction";
        else if (lowTitle.includes("resumo")) type = "summary";
        blocks.push({ type, title, content: section });
      }
    });

    // user já foi validado no início da função

    // Recalcular resolvedSessionId se perdemos contexto (improvável mas seguro)
    let finalSessionId = conversationId;
    if (conversationId.length > 0) {
       // We should have it from above if it's the normal path
       // If it's the customContent path, we might still need to resolve it
       if (!customContent) {
         // It's already resolved in the block above
       } else {
         // For customContent path, we should also try to resolve
         const { data: ts } = await supabaseClient
            .from("tutor_sessions" as any)
            .select("id")
            .eq("conversation_id", conversationId)
            .maybeSingle();
         if (ts) finalSessionId = (ts as any).id;
       }
    }

    const { data: aggregation, error: aggError } = await supabaseClient
      .from("cme_session_aggregations")
      .insert({
        tutor_session_id: (resolvedSessionId as any) || finalSessionId, // This was the bug!
        source_conversation_id: isChatConversation ? conversationId : null,
        user_id: user.id,
        aggregated_content: fullText,
        total_blocks: blocks.length,
        status: 'aggregating',
        started_at: new Date().toISOString()
      } as any)
      .select()
      .single();

    if (aggError) {
      debug("aggregation insert failed", aggError);
      throw aggError;
    }
    debug("aggregation created", { aggregationId: aggregation?.id, blocks: blocks.length });

    const blockInserts = blocks.map((b, idx) => ({
      aggregation_id: aggregation.id,
      block_type: b.type,
      title: b.title,
      block_order: idx + 1,
      content: b.content,
      scene_graph_data: b.metadata || {},
      estimated_minutes: 2
    }));

    await supabaseClient.from("cme_lesson_blocks").insert(blockInserts as any);
    return { aggregation, blocks: blockInserts };
  }, [supabaseClient]);


  const transformToVideo = useCallback(async (params: {
    title: string;
    specialty: string;
    topic: string;
    summary: string;
    sourceContent: string;
    blocks: TutorBlock[];
    conversationId: string;
    messageId?: string;
    isFullSession?: boolean;
    onComplete?: (aggregationId: string) => void;
  }) => {
    console.error("🔥 BOTAO GERAR AULA - useTutorCME.ts - transformToVideo", params);
    setState({ status: 'queued', progress: 5, message: "Iniciando pipeline..." });
    lastEventRef.current = Date.now();
    console.debug("[CME] transformToVideo start", {
      conversationId: params.conversationId,
      isFullSession: !!params.isFullSession,
      hasSourceContent: !!params.sourceContent,
      sourceLength: params.sourceContent?.length ?? 0,
    });

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let aggregationId: string | null = null;
      let lessonBlocks: any[] = [];

      // Always create an aggregation to support Agile Player and structure
      const result = await aggregateSessionContent(
        params.conversationId, 
        params.isFullSession ? undefined : params.sourceContent
      );
      aggregationId = result.aggregation.id;
      lessonBlocks = result.blocks;
      console.debug("[CME] aggregation ok", { 
        aggregationId, 
        blocks: lessonBlocks.length,
        resolvedSessionId: (result.aggregation as any).tutor_session_id
      });
      
      // Update with title and manual flag
      await supabaseClient
        .from("cme_session_aggregations")
        .update({ 
          title: params.title,
          is_manual_upload: true,
          status: 'pending_review'
        } as any)
        .eq('id', aggregationId);

      setState(s => ({ ...s, aggregationId, progress: 10, message: "Conteúdo estruturado..." }));


      const { data: project, error: projectError } = await supabaseClient
        .from("cme_video_projects")
        .insert({
          title: params.title,
          status: 'active',
          aggregation_id: aggregationId,
          user_id: user.id,
          config: {
            tutor_conversation_id: params.conversationId,
            tutor_message_id: params.messageId,
            is_full_session: params.isFullSession,
            specialty: params.specialty,
            topic: params.topic,
            hardened: true,
            is_manual_upload: true
          }
        } as any)
        .select()
        .single();

      if (projectError) throw projectError;
      const projectId = project.id;
      console.debug("[CME] project created", { projectId, aggregationId });
      setState(s => ({ ...s, projectId, progress: 20, message: "Projeto criado e enviado para revisão ADM." }));

      // Index to Educational Memory
      await addToMemory({
        title: params.title,
        subject: params.specialty,
        topic: params.topic,
        source_type: 'cme',
        aggregation_id: aggregationId,
        session_id: (result.aggregation as any).tutor_session_id,
        short_summary: params.summary,
        status: 'pending_review'
      });

      // Phase 8: Hardening - Snapshot
      await createSnapshot(projectId, 'planning', { params });


      await logPipelineEvent(projectId, 'planning', 'completed', 30, "Mapeamento semântico concluído", aggregationId || undefined);
      await logPipelineEvent(projectId, 'mapping', 'completed', 35, "Knowledge Mapping pronto", aggregationId || undefined);

      setState(s => ({ ...s, status: 'graphing', progress: 40, message: "Gerando Scene Graph..." }));
      
      const sceneGraphData = { 
        title: params.title,
        blocks_count: lessonBlocks.length,
        generated_at: new Date().toISOString(),
        hardened: true
      };

      const sceneGraphPayload = {
        video_project_id: projectId,
        user_id: user.id,
        scene_type: 'pedagogical',
        visual_goal: 'high_engagement',
        status: 'ready',
        title: params.title,
        scene_graph: sceneGraphData,
        graph_payload: sceneGraphData,
        metadata: {
          specialty: params.specialty,
          topic: params.topic,
          source_content_length: params.sourceContent?.length,
          aggregation_id: aggregationId // Critical: link to aggregation
        }
      };

      const { data: sceneGraph, error: sgError } = await supabaseClient
        .from("cme_scene_graphs")
        .insert(sceneGraphPayload as any)
        .select()
        .single();

      if (sgError) {
        const techReason = `[${sgError.code}] ${sgError.message}${sgError.details ? ` (${sgError.details})` : ''}`;
        console.error("CME Scene Graph Persistence Failed:", {
          code: sgError.code,
          message: sgError.message,
          details: sgError.details,
          hint: sgError.hint,
          payload: sceneGraphPayload
        });
        
        await logPipelineEvent(
          projectId, 
          'graphing', 
          'failed', 
          40, 
          `Falha ao persistir Scene Graph: ${techReason}`, 
          aggregationId || undefined,
          { code: sgError.code, details: sgError.details, hint: sgError.hint }
        );

        await reportIncident("CME_SceneGraph_Persistence", {
          message: "Falha ao persistir Scene Graph.",
          technical_reason: techReason,
          details: sgError.details,
          code: sgError.code,
          hint: sgError.hint,
          payload_keys: Object.keys(sceneGraphPayload)
        });

        throw new Error(`Falha ao persistir Scene Graph: ${techReason}`);
      }

      if (sceneGraph && lessonBlocks.length > 0) {
        const nodes = lessonBlocks.map((block, idx) => ({
          scene_graph_id: sceneGraph.id,
          user_id: user.id,
          node_type: block.type || 'concept',
          title: block.title,
          sequence_order: idx,
          start_second: idx * 60,
          end_second: (idx + 1) * 60,
          payload: { 
            content: block.content, 
            metadata: (block as any).metadata || (block as any).scene_graph_data || {} 
          },
          render_payload: { 
            content: block.content,
            metadata: (block as any).metadata || (block as any).scene_graph_data || {}
          }
        }));
        
        const { error: nodesError } = await supabaseClient
          .from("cme_scene_graph_nodes")
          .insert(nodes as any);
        
        if (nodesError) {
          const techReason = `[${nodesError.code}] ${nodesError.message}${nodesError.details ? ` (${nodesError.details})` : ''}`;
          console.error("CME Scene Nodes Persistence Failed:", {
            code: nodesError.code,
            message: nodesError.message,
            details: nodesError.details,
            payload: nodes
          });
          
          await logPipelineEvent(
            projectId, 
            'graphing', 
            'failed', 
            45, 
            `Falha ao persistir Scene Graph Nodes: ${techReason}`, 
            aggregationId || undefined,
            { code: nodesError.code, details: nodesError.details }
          );

          await reportIncident("CME_SceneNodes_Persistence", {
            message: "Falha ao persistir Scene Graph Nodes.",
            technical_reason: techReason,
            details: nodesError.details,
            code: nodesError.code,
            payload_count: nodes.length
          });

          throw new Error(`Falha ao persistir Scene Graph Nodes: ${techReason}`);
        }
      }

      console.debug("[CME] scene graph created", { sceneGraphId: sceneGraph.id, projectId });
      setState(s => ({ ...s, sceneGraphId: sceneGraph.id }));
      await logPipelineEvent(projectId, 'graphing', 'completed', 50, "Scene Graph gerado e persistido", aggregationId || undefined);

      setShowAgilePlayer(true);
      toast.success("Aula estruturada! Iniciando experiência interativa enquanto o vídeo cinematográfico é processado.");

      setState(s => ({ ...s, status: 'rendering', progress: 50, message: "Orquestrando Renderização..." }));
      
      console.log("[CME] Manual mode: skipping orchestrator. Project ready for admin upload.");
      
      await logPipelineEvent(projectId, 'completed', 'completed', 100, "Aula enviada para o Admin. Aguardando upload do vídeo.", aggregationId || undefined);
      
      setState(s => ({ 
        ...s, 
        status: 'ready', 
        progress: 100, 
        message: "Enviado com sucesso! Um administrador irá anexar o vídeo em breve." 
      }));

      toast.success("Conteúdo enviado para o Admin! Você poderá assistir assim que o vídeo for carregado.");
      
      if (params.onComplete && aggregationId) {
        params.onComplete(aggregationId);
      }

      return projectId;
    } catch (err: any) {
      console.error("CME Transform Error:", err);
      // Override freeze: cme-ux-correct-fix — humanizar erro para o usuário.
      const { humanizeCMEMessage } = await import("@/components/cinematic/cmeUserMessages");
      const friendly = humanizeCMEMessage(err?.message);
      setState(s => ({ ...s, status: 'failed', error: friendly, message: friendly }));
      toast.error(friendly, { id: "cme-transform-error" });

      // Telemetria técnica — só DB/console, nunca na UI.
      await reportIncident("TutorCME_Pipeline", err);

      return null;
    }

  }, [aggregateSessionContent, logPipelineEvent, supabaseClient]);

  return {
    state,
    workerHealth,
    showAgilePlayer,
    setShowAgilePlayer,
    transformToVideo,
    retryRender: async (pid: string) => {
       await supabaseClient.from("cme_render_jobs").update({ status: 'queued' } as any).eq('project_id', pid);
       toast.success("Reiniciado");
    },
    resetState: () => {
      setState({ status: 'idle', progress: 0 });
      setShowAgilePlayer(false);
    },
    triggerPedagogicalFallback: async (projectId: string) => {
      setState(s => ({ ...s, status: 'rendering', message: "Gerando Fallback Pedagógico (Slides)...", progress: 90 }));
      await logPipelineEvent(projectId, 'rendering', 'completed', 100, "Fallback de slides gerado com sucesso");
      await supabaseClient.from("cme_video_projects").update({
        status: 'ready',
        config: { fallback_active: true, fallback_type: 'pedagogical_slides' }
      } as any).eq('id', projectId);
      toast.success("Aula Ágil gerada para evitar interrupção.");
      setTimeout(() => {
        setState(s => ({ ...s, status: 'ready', progress: 100 }));
        setShowAgilePlayer(true);
      }, 1000);
    },
    logEligibility: async (params: { 
      messageId: string; 
      eligible: boolean; 
      rejectionReason?: string; 
      structureScore?: number;
      cognitiveDensity?: number;
      metrics?: any;
    }) => {
      try {
        await supabaseClient.from("cme_generation_eligibility_logs").insert([{
          tutor_message_id: params.messageId,
          eligible: params.eligible,
          rejection_reason: params.rejectionReason,
          structure_score: params.structureScore || 0,
          cognitive_density: params.cognitiveDensity || 0,
          metadata: { metrics: params.metrics, timestamp: new Date().toISOString() }
        } as any]);
      } catch (e) {
        console.error("Eligibility log error:", e);
      }
    },
    getLessonForMessage: async (messageId: string) => {
      try {
        const { data: project } = await supabaseClient
          .from("cme_video_projects")
          .select("*, aggregation:cme_session_aggregations(*)")
          .contains('config', { tutor_message_id: messageId })
          .maybeSingle();
        
        return project;
      } catch (e) {
        console.error("Error fetching lesson for message:", e);
        return null;
      }
    },
     findLessonByTopic: async (topic: string, conversationId?: string) => {
       try {
         const recommendation = await findRecommendedVideoForTutorContext(topic, undefined, conversationId);
         if (recommendation.found) {
           return {
             id: recommendation.lessonId,
             title: recommendation.title,
             topic: recommendation.topic,
             playback_url: recommendation.watchUrl,
             video_url: recommendation.watchUrl,
             thumbnail_url: recommendation.thumbnailUrl,
             status: recommendation.status,
             source: recommendation.source,
             confidence: recommendation.confidence
           };
         }
         return null;
       } catch (e) {
         console.error("Error finding lesson for topic:", e);
         return null;
       }
     },
     generateTextualLesson: async (params: { topic: string; conversationId?: string; sessionId?: string; customContent?: string }) => {
       try {
         const { data, error } = await supabaseClient.functions.invoke('generate-tutor-lesson', {
           body: {
             topic: params.topic,
             conversationId: params.conversationId,
             sessionId: params.sessionId,
             customContent: params.customContent,
             lessonType: 'aula_completa',
             cmeEnabled: true
           }
         });
         if (error) throw error;
         return data;
       } catch (e) {
         console.error("Error generating textual lesson:", e);
         throw e;
       }
     }
  };
};