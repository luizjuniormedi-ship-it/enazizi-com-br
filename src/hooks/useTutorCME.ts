import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TutorBlock } from "@/types/tutor";
import { Database } from "@/integrations/supabase/types";

type CmeAggregationStatus = Database['public']['Enums']['cme_aggregation_status'];
type CmeRenderStatus = Database['public']['Enums']['cme_render_status'];

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
}

export const useTutorCME = () => {
  const supabaseClient = useMemo(() => supabase, []);
  const [state, setState] = useState<CMEProjectState>({ status: 'idle', progress: 0 });
  const [workerHealth, setWorkerHealth] = useState<any>(null);
  const lastEventRef = useRef<number>(Date.now());

  const checkWorkerHealth = useCallback(async () => {
    try {
      const { data, error } = await supabaseClient.from('cme_worker_nodes')
        .select('id, status, last_heartbeat')
        .eq('status', 'online');
      
      const workersOnline = data?.length || 0;
      setWorkerHealth({ workers_online: workersOnline });
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
            workerStatus: 'online'
          }));
        }
      )
      .subscribe();

    const stuckCheckInterval = setInterval(async () => {
      const elapsed = Date.now() - lastEventRef.current;
      
      // If we are in rendering stage and no updates for 20s
      if (state.status === 'rendering' && elapsed > 20000) {
        const onlineCount = await checkWorkerHealth();
        if (onlineCount === 0) {
          setState(s => ({ 
            ...s, 
            status: 'pending_hardware',
            workerStatus: 'offline_or_unavailable',
            message: "Renderização pendente de hardware. O Worker/GPU parece estar offline.",
            isStuck: true 
          }));
        }
      }
    }, 5000);

    return () => {
      supabaseClient.removeChannel(channel);
      clearInterval(stuckCheckInterval);
    };
  }, [state.projectId, state.status, supabaseClient, checkWorkerHealth]);

  const logPipelineEvent = useCallback(async (projectId: string, stage: string, status: string, progress: number, message?: string, aggregationId?: string) => {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("cme_pipeline_events").insert([{
        project_id: projectId,
        aggregation_id: aggregationId,
        stage,
        status,
        progress,
        message,
        user_id: user?.id
      } as any]);
... keep existing code
      
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

  const aggregateSessionContent = useCallback(async (conversationId: string) => {
    const { data: messages, error } = await supabaseClient
      .from("tutor_messages")
      .select("id, content, role, created_at")
      .eq("tutor_session_id", conversationId)
      .eq("role", "assistant")
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!messages || messages.length === 0) throw new Error("Nenhuma mensagem encontrada na sessão.");

    const fullText = messages.map(m => m.content).join("\n\n---\n\n");
    const blocks: { type: string; title: string; content: string }[] = [];
    const sections = fullText.split("\n#").filter(s => s.trim().length > 0);
    
    sections.forEach((section, idx) => {
      const title = section.split("\n")[0].replace(/^#+\s*/, "").trim() || `Capítulo ${idx + 1}`;
      let type = "deep_dive";
      const lowTitle = title.toLowerCase();
      if (lowTitle.includes("introdução")) type = "introduction";
      else if (lowTitle.includes("resumo")) type = "summary";
      blocks.push({ type, title, content: section });
    });

    const { data: aggregation, error: aggError } = await supabaseClient
      .from("cme_session_aggregations")
      .insert({
        tutor_session_id: conversationId,
        aggregated_content: fullText,
        total_blocks: blocks.length,
        status: 'aggregating',
        started_at: new Date().toISOString()
      } as any)
      .select()
      .single();

    if (aggError) throw aggError;

    const blockInserts = blocks.map((b, idx) => ({
      aggregation_id: aggregation.id,
      block_type: b.type,
      title: b.title,
      block_order: idx + 1,
      content: b.content,
      estimated_minutes: 2
    }));

    await supabaseClient.from("cme_lesson_blocks").insert(blockInserts as any);
    return { aggregation, blocks };
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
    setState({ status: 'queued', progress: 5, message: "Iniciando pipeline..." });
    lastEventRef.current = Date.now();

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let aggregationId: string | null = null;
      let lessonBlocks: any[] = params.blocks || [];

      if (params.isFullSession) {
        const result = await aggregateSessionContent(params.conversationId);
        aggregationId = result.aggregation.id;
        lessonBlocks = result.blocks;
        setState(s => ({ ...s, aggregationId, progress: 10, message: "Sessão agregada..." }));
      }

      const { data: project, error: projectError } = await supabaseClient
        .from("cme_video_projects")
        .insert({
          title: params.title,
          status: 'active',
          aggregation_id: aggregationId,
          user_id: user.id,
          config: {
            tutor_conversation_id: params.conversationId,
            is_full_session: params.isFullSession,
            specialty: params.specialty,
            topic: params.topic
          }
        } as any)
        .select()
        .single();

      if (projectError) throw projectError;
      const projectId = project.id;
      setState(s => ({ ...s, projectId, progress: 20, message: "Projeto criado..." }));

      await logPipelineEvent(projectId, 'planning', 'completed', 30, "Mapeamento semântico concluído", aggregationId || undefined);
      await logPipelineEvent(projectId, 'mapping', 'completed', 35, "Knowledge Mapping pronto", aggregationId || undefined);

      setState(s => ({ ...s, status: 'graphing', progress: 40, message: "Gerando Scene Graph..." }));
      const { data: sceneGraph, error: sgError } = await supabaseClient
        .from("cme_scene_graphs")
        .insert({
          project_id: projectId,
          user_id: user.id,
          scene_type: 'pedagogical',
          visual_goal: 'high_engagement',
          status: 'ready'
        } as any)
        .select()
        .single();

      if (sgError) throw new Error("Falha ao persistir Scene Graph.");

      if (sceneGraph && lessonBlocks.length > 0) {
        const nodes = lessonBlocks.map((block, idx) => ({
          scene_graph_id: sceneGraph.id,
          node_type: block.type || 'concept',
          semantic_role: block.title,
          node_order: idx,
          start_second: idx * 60,
          end_second: (idx + 1) * 60,
          render_payload: { content: block.content }
        }));
        await supabaseClient.from("cme_scene_graph_nodes").insert(nodes as any);
      }

      setState(s => ({ ...s, sceneGraphId: sceneGraph.id }));
      await logPipelineEvent(projectId, 'graphing', 'completed', 50, "Scene Graph gerado", aggregationId || undefined);

      setState(s => ({ ...s, status: 'rendering', progress: 50, message: "Orquestrando Renderização..." }));
      
      const { data: orchestratorResult, error: orchError } = await supabaseClient.functions.invoke('cme-orchestrator', {
        body: { 
          action: 'start_render', 
          projectId,
          payload: { priority: 1, title: params.title }
        }
      });

      if (orchError) {
        throw new Error(orchError.message || "Erro no orquestrador");
      }

      if (orchestratorResult?.status === 'waiting_hardware') {
        setState(s => ({ 
          ...s, 
          status: 'pending_hardware', 
          message: orchestratorResult.message,
          progress: 60
        }));
      }

      return projectId;
    } catch (err: any) {
      console.error("CME Transform Error:", err);
      setState(s => ({ ...s, status: 'failed', error: err.message }));
      toast.error("Erro: " + err.message);
      return null;
    }
  }, [aggregateSessionContent, logPipelineEvent, supabaseClient]);

  return {
    state,
    workerHealth,
    transformToVideo,
    retryRender: async (pid: string) => {
       await supabaseClient.from("cme_render_jobs").update({ status: 'queued' } as any).eq('project_id', pid);
       toast.success("Reiniciado");
    },
    resetState: () => setState({ status: 'idle', progress: 0 })
  };
};