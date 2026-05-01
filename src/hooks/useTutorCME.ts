import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TutorBlock } from "@/types/tutor";

export interface CMEProjectState {
  status: 'idle' | 'planning' | 'scripting' | 'rendering' | 'uploading' | 'validating' | 'ready' | 'failed';
  projectId?: string;
  progress: number;
  error?: string;
}

export const useTutorCME = () => {
  const [state, setState] = useState<CMEProjectState>({ status: 'idle', progress: 0 });

  const transformToVideo = useCallback(async (params: {
    title: string;
    specialty: string;
    topic: string;
    summary: string;
    sourceContent: string;
    blocks: TutorBlock[];
    conversationId: string;
  }) => {
    setState({ status: 'planning', progress: 10 });
    toast.info("Iniciando transformação cinematográfica...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const projectId = crypto.randomUUID();
      
      // 1. Criar Projeto CME
      const { error: projectError } = await supabase
        .from("cme_video_projects" as any)
        .insert({
          id: projectId,
          title: params.title,
          status: 'active',
          target_audience: 'medical_students',
          config: {
            tutor_conversation_id: params.conversationId,
            specialty: params.specialty,
            topic: params.topic,
            summary: params.summary,
            learning_objectives: params.blocks.find(b => b.type === 'summary')?.payload?.bullets || []
          }
        } as any);

      if (projectError) throw projectError;
      setState(s => ({ ...s, status: 'scripting', progress: 30, projectId }));

      // 2. Criar Plano Semântico
      const { error: planError } = await supabase
        .from("cme_semantic_plans" as any)
        .insert({
          project_id: projectId,
          content_outline: {
            summary: params.summary,
            blocks_count: params.blocks.length,
            original_context: params.sourceContent.slice(0, 2000)
          },
          pedagogical_intent: "cinematic_reinforcement",
          complexity_level: "high"
        } as any);

      if (planError) throw planError;
      setState(s => ({ ...s, status: 'rendering', progress: 50 }));

      // 3. Registrar Job de Renderização
      const { error: jobError } = await supabase
        .from("cme_render_jobs" as any)
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
            blocks: params.blocks
          }
        } as any);

      if (jobError) throw jobError;
      
      toast.success("Projeto enviado para o cluster de renderização!");
      setState(s => ({ ...s, status: 'rendering', progress: 70 }));

      // Polling básico de status (opcional, aqui apenas simulamos o sucesso inicial)
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
