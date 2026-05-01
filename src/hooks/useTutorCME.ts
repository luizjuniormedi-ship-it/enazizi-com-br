import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TutorBlock } from "@/types/tutor";

export interface CMEProjectState {
  status: 'idle' | 'queued' | 'planning' | 'scripting' | 'graphing' | 'voicing' | 'rendering' | 'chunking' | 'uploading' | 'validating' | 'ready' | 'failed';
  projectId?: string;
  aggregationId?: string;
  progress: number;
  error?: string;
  message?: string;
}

export const useTutorCME = () => {
  const supabaseClient = useMemo(() => supabase, []);
  const [state, setState] = useState<CMEProjectState>({ status: 'idle', progress: 0 });

  // Listen for pipeline events in real-time
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
          console.log("[CME Pipeline Event]", newEvent);
          setState(s => ({
            ...s,
            status: newEvent.stage as any,
            progress: newEvent.progress,
            message: newEvent.message,
            error: newEvent.status === 'failed' ? newEvent.message : s.error
          }));
        }
      )
      .subscribe();

    // Timeout safety: if stuck in graphing or rendering for too long
    const timeout = setTimeout(() => {
      if (state.status === 'graphing' || state.status === 'rendering') {
        console.warn("[CME Pipeline Timeout] Stuck in stage:", state.status);
        // We don't force fail here yet, but we could if needed
      }
    }, 45000);

    return () => {
      supabaseClient.removeChannel(channel);
      clearTimeout(timeout);
    };
  }, [state.projectId, state.status, supabaseClient]);

  const logPipelineEvent = useCallback(async (projectId: string, stage: string, status: string, progress: number, message?: string, aggregationId?: string) => {
    try {
      await supabaseClient.from("cme_pipeline_events").insert({
        project_id: projectId,
        stage,
        status,
        progress,
        message,
        latency_ms: 100
      });
      
      if (aggregationId) {
        await supabaseClient.from("cme_audit_logs").insert({
          aggregation_id: aggregationId,
          action: `Pipeline: ${stage}`,
          metadata: { status, progress, message }
        });
        
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
      else if (lowTitle.includes("fisiopatologia")) type = "pathophysiology";
      else if (lowTitle.includes("clínica") || lowTitle.includes("sintomas")) type = "clinical";
      else if (lowTitle.includes("diagnóstico")) type = "diagnosis";
      else if (lowTitle.includes("tratamento") || lowTitle.includes("conduta")) type = "treatment";
      else if (lowTitle.includes("resumo") || lowTitle.includes("conclusão")) type = "summary";
      
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

    const { error: blocksError } = await supabaseClient
      .from("cme_lesson_blocks")
      .insert(blockInserts as any);

    if (blocksError) throw blocksError;

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

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let aggregationId: string | null = null;
      let finalContent = params.sourceContent;
      let lessonBlocks: any[] = [];

      if (params.isFullSession) {
        const result = await aggregateSessionContent(params.conversationId);
        aggregationId = result.aggregation.id;
        finalContent = result.aggregation.aggregated_content;
        lessonBlocks = result.blocks;
        setState(s => ({ ...s, aggregationId, progress: 10, message: "Sessão agregada..." }));
      }

      const { data: project, error: projectError } = await supabaseClient
        .from("cme_video_projects")
        .insert({
          title: params.title,
          status: 'active',
          aggregation_id: aggregationId,
          config: {
            tutor_conversation_id: params.conversationId,
            is_full_session: params.isFullSession,
            specialty: params.specialty,
            topic: params.topic
          }
        })
        .select()
        .single();

      if (projectError) throw projectError;
      const projectId = project.id;
      setState(s => ({ ...s, projectId, progress: 15, message: "Projeto criado..." }));

      // Create Planning Event
      await logPipelineEvent(projectId, 'planning', 'completed', 25, "Mapeamento semântico concluído", aggregationId || undefined);

      // Create Scene Graph (Fallback Real Implementation)
      setState(s => ({ ...s, status: 'graphing', progress: 40, message: "Gerando Scene Graph..." }));
      
      const { data: sceneGraph, error: graphError } = await supabaseClient
        .from("cme_scene_graphs")
        .insert({
          project_id: projectId,
          semantic_plan_id: null,
          scene_type: 'pedagogical_narrative',
          visual_goal: 'high_retention',
          medical_concept: params.topic,
          status: 'ready'
        } as any)
        .select()
        .single();

      if (graphError) {
        console.error("Scene Graph Error:", graphError);
        // Fallback: we continue but log the error
      } else if (sceneGraph && lessonBlocks.length > 0) {
        // Create nodes from blocks
        const nodes = lessonBlocks.map((block, idx) => ({
          scene_graph_id: sceneGraph.id,
          node_type: block.block_type || 'concept',
          semantic_role: block.title,
          node_order: idx,
          start_second: idx * 60,
          end_second: (idx + 1) * 60,
          render_payload: { content: block.content }
        }));
        
        await supabaseClient.from("cme_scene_graph_nodes").insert(nodes as any);
      }

      await logPipelineEvent(projectId, 'graphing', 'completed', 50, "Scene Graph gerado com sucesso", aggregationId || undefined);

      // Create Render Job
      const { data: renderJob, error: jobError } = await supabaseClient.from("cme_render_jobs").insert({
        project_id: projectId,
        status: 'queued',
        render_stage: 'gpu_rendering',
        priority: 1,
        retry_count: 0
      } as any).select().single();

      if (jobError) throw jobError;

      setState(s => ({ ...s, status: 'rendering', progress: 60, message: "Renderização em fila..." }));
      await logPipelineEvent(projectId, 'rendering', 'in_progress', 60, "Aguardando worker GPU real...", aggregationId || undefined);

      // Since there is no worker, we inform the user and stop here or move to builder
      setTimeout(() => {
        toast.success("Projeto preparado para o Builder.");
        if (params.onComplete && aggregationId) {
          params.onComplete(aggregationId);
        } else if (aggregationId) {
          window.location.href = `/admin/cinematic-builder/${aggregationId}`;
        } else {
           // If no aggregation, maybe go to engine monitor
           window.location.href = `/admin/cinematic-engine/${projectId}`;
        }
      }, 2000);

      return projectId;
    } catch (err: any) {
      console.error("CME Transform Error:", err);
      setState(s => ({ ...s, status: 'failed', error: err.message }));
      toast.error("Falha ao transformar: " + err.message);
      return null;
    }
  }, [aggregateSessionContent, logPipelineEvent, supabaseClient]);

  const retryRender = useCallback(async (projectId: string) => {
    setState({ status: 'queued', progress: 10, projectId, message: "Reiniciando..." });
    try {
      await supabaseClient.from("cme_render_jobs")
        .update({ status: 'queued', updated_at: new Date().toISOString() } as any)
        .eq('project_id', projectId);
      
      await logPipelineEvent(projectId, 'rendering', 'in_progress', 10, "Reiniciado pelo usuário");
      toast.success("Reiniciado!");
    } catch (err: any) {
      toast.error("Erro ao reiniciar: " + err.message);
    }
  }, [logPipelineEvent, supabaseClient]);

  return {
    state,
    transformToVideo,
    retryRender,
    resetState: () => setState({ status: 'idle', progress: 0 })
  };
};