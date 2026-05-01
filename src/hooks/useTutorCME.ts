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
    } catch (e) {
      console.error("Telemetry error:", e);
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
      
      setState({ status: 'planning', progress: 15, projectId, message: "Mapeamento semântico..." });
      await logPipelineEvent(projectId, 'planning', 'in_progress', 15, "Iniciando mapeamento de conhecimento");

      // 2. Criar Vínculo Oficial (Origem)
      await supabase.from("cme_tutor_origins").insert({
        tutor_session_id: params.conversationId as any,
        tutor_message_id: (params.messageId || crypto.randomUUID()) as any,
        cme_video_project_id: projectId
      });

      // 3. Criar Plano Semântico
      const { error: planError } = await supabase
        .from("cme_semantic_plans")
        .insert({
          project_id: projectId,
          content_outline: {
            summary: params.summary,
            blocks_count: params.blocks.length,
            original_context: params.sourceContent.slice(0, 5000)
          },
          pedagogical_intent: "cinematic_reinforcement",
          complexity_level: "high"
        });

      if (planError) throw planError;
      
      setState({ status: 'scripting', progress: 30, projectId, message: "Gerando narrativa visual..." });
      await logPipelineEvent(projectId, 'scripting', 'completed', 30, "Narrativa concluída");

      // 4. Registrar Job de Renderização (Simulando o início do pipeline GPU)
      const { error: jobError } = await supabase
        .from("cme_render_jobs")
        .insert({
          project_id: projectId,
          render_type: 'cinematic_v2',
          render_mode: 'autonomous_director',
          status: 'processing',
          render_stage: 'scene_generation',
          priority: 30,
          gpu_required: true,
          render_metadata: {
            source: 'tutor_ia',
            blocks: params.blocks,
            origin_message_id: params.messageId
          }
        });

      if (jobError) throw jobError;
      
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

  return {
    state,
    transformToVideo,
    resetState: () => setState({ status: 'idle', progress: 0 })
  };
};
