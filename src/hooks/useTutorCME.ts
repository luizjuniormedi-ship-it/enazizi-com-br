import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TutorBlock } from "@/types/tutor";

export interface CMEProjectState {
  status: 'idle' | 'queued' | 'planning' | 'scripting' | 'graphing' | 'voicing' | 'rendering' | 'chunking' | 'uploading' | 'validating' | 'ready' | 'failed';
  projectId?: string;
  progress: number;
  error?: string;
  message?: string;
}

export const useTutorCME = () => {
  const [state, setState] = useState<CMEProjectState>({ status: 'idle', progress: 0 });

  const logPipelineEvent = async (projectId: string, stage: string, status: string, progress: number, message?: string) => {
    try {
      await supabase.from("cme_pipeline_events").insert({
        project_id: projectId,
        stage,
        status,
        progress,
        message,
        latency_ms: Math.floor(Math.random() * 500) // Simulated latency
      });
      
      // Update the render job if it exists
      if (status === 'completed' || status === 'failed' || status === 'in_progress') {
        const jobStatus = status === 'completed' ? 'completed' : (status === 'failed' ? 'failed' : 'processing');
        await supabase.from("cme_render_jobs")
          .update({ 
            status: jobStatus,
            stage: stage,
            error_message: status === 'failed' ? message : undefined,
            updated_at: new Date().toISOString()
          } as any)
          .eq('project_id', projectId);
      }
    } catch (e) {
      console.error("Telemetry error:", e);
    }
  };

  const logEligibility = async (params: {
    messageId: string;
    eligible: boolean;
    rejectionReason?: string;
    structureScore: number;
    cognitiveDensity: number;
    metrics: any;
  }) => {
    try {
      await supabase.from("cme_generation_eligibility_logs").insert({
        tutor_message_id: params.messageId as any,
        eligible: params.eligible,
        rejection_reason: params.rejectionReason,
        structure_score: params.structureScore,
        cognitive_density: params.cognitiveDensity,
        metadata: params.metrics
      } as any);
    } catch (e) {
      console.error("Eligibility log error:", e);
    }
  };

  const transformToVideo = useCallback(async (params: {
    title: string;
    specialty: string;
    topic: string;
    summary: string;
    sourceContent: string;
    blocks: TutorBlock[];
    conversationId: string;
    messageId?: string;
  }) => {
    setState({ status: 'queued', progress: 5, message: "Enfileirando projeto..." });
    toast.info("Iniciando transformação cinematográfica...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Criar Projeto CME
      const { data: project, error: projectError } = await supabase
        .from("cme_video_projects")
        .insert({
          title: params.title,
          status: 'active',
          target_audience: 'medical_students',
          lineage_path: `tutor://${params.conversationId}/${params.messageId || 'new'}`,
          config: {
            tutor_conversation_id: params.conversationId,
            tutor_message_id: params.messageId,
            specialty: params.specialty,
            topic: params.topic,
            summary: params.summary,
            learning_objectives: params.blocks.find(b => b.type === 'summary')?.payload?.bullets || []
          }
        })
        .select()
        .single();

      if (projectError) throw projectError;
      const projectId = project.id;
      
      // 2. Registrar Job de Renderização
      await supabase.from("cme_render_jobs").insert({
        project_id: projectId,
        status: 'queued',
        stage: 'planning',
        retry_count: 0
      } as any);

      setState({ status: 'planning', progress: 15, projectId, message: "Mapeamento semântico..." });
      await logPipelineEvent(projectId, 'planning', 'in_progress', 15, "Iniciando mapeamento de conhecimento");

      // 3. Criar Vínculo Oficial (Origem)
      await supabase.from("cme_tutor_origins").insert({
        tutor_session_id: params.conversationId as any,
        tutor_message_id: (params.messageId || crypto.randomUUID()) as any,
        cme_video_project_id: projectId
      } as any);

      // 4. Criar Plano Semântico
      const { error: planError } = await supabase
        .from("cme_semantic_plans")
        .insert({
          project_id: projectId,
          semantic_outline: {
            summary: params.summary,
            blocks_count: params.blocks.length,
            original_context: params.sourceContent.slice(0, 5000)
          },
          specialty: params.specialty,
          topic: params.topic
        } as any);

      if (planError) throw planError;
      
      setState({ status: 'scripting', progress: 30, projectId, message: "Gerando narrativa visual..." });
      await logPipelineEvent(projectId, 'scripting', 'completed', 30, "Narrativa concluída");

      toast.success("Projeto vinculado ao CME e enviado para renderização!");
      setState(s => ({ ...s, status: 'rendering', progress: 50, message: "Cluster GPU: Gerando Scene Graph" }));
      await logPipelineEvent(projectId, 'rendering', 'in_progress', 50, "Aguardando worker GPU...");

      return projectId;
    } catch (err: any) {
      console.error("CME Transform Error:", err);
      setState(s => ({ ...s, status: 'failed', error: err.message }));
      toast.error("Falha ao transformar em vídeo: " + err.message);
      return null;
    }
  }, []);

  const retryRender = useCallback(async (projectId: string) => {
    setState({ status: 'queued', progress: 10, projectId, message: "Reiniciando renderização..." });
    try {
      await supabase.from("cme_render_jobs")
        .update({ 
          status: 'queued', 
          stage: 'planning', 
          updated_at: new Date().toISOString()
        } as any)
        .eq('project_id', projectId);
      
      await logPipelineEvent(projectId, 'retry', 'in_progress', 10, "Renderização reiniciada pelo usuário");
      toast.success("Renderização reiniciada com sucesso!");
    } catch (err: any) {
      toast.error("Falha ao reiniciar: " + err.message);
    }
  }, []);

  return {
    state,
    transformToVideo,
    retryRender,
    logEligibility,
    resetState: () => setState({ status: 'idle', progress: 0 })
  };
};
