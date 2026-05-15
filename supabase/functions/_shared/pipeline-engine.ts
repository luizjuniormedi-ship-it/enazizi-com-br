import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function createPipelineJob(data: {
  type: 'ingestion' | 'bulk_generation' | 'ecg_extraction' | 'embedding_sync' | 'ocr_process';
  payload: any;
  user_id?: string;
  max_retries?: number;
}) {
  const { data: job, error } = await supabase
    .from("pipeline_jobs")
    .insert([{
      type: data.type,
      payload: data.payload,
      user_id: data.user_id,
      max_retries: data.max_retries || 5,
      status: "pending",
      stage: "initial"
    }])
    .select()
    .single();

  if (error) throw error;
  return job;
}

export async function updatePipelineJob(jobId: string, updates: any) {
  const { error } = await supabase
    .from("pipeline_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  
  if (error) {
    console.error(`[PipelineJob] Error updating job ${jobId}:`, error);
  }
}

export async function failPipelineJob(jobId: string, error: any, stage?: string) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  const { data: job } = await supabase
    .from("pipeline_jobs")
    .select("retries, max_retries")
    .eq("id", jobId)
    .single();

  const retries = (job?.retries || 0) + 1;
  const maxRetries = job?.max_retries || 5;
  const canRetry = retries <= maxRetries;

  await updatePipelineJob(jobId, {
    status: canRetry ? "retrying" : "failed",
    stage: stage || "error",
    last_error: errorMsg,
    retries,
    completed_at: canRetry ? null : new Date().toISOString()
  });

  return { canRetry, retries };
}

export async function completePipelineJob(jobId: string, results: any) {
  await updatePipelineJob(jobId, {
    status: "completed",
    stage: "finished",
    progress: results,
    completed_at: new Date().toISOString()
  });
}
