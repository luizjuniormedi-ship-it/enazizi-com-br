
export type CMEStageStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export interface CMEGPUCluster {
  id: string;
  name: string;
  region: string;
  provider: string;
  max_workers: number;
  is_active: boolean;
  created_at: string;
}

export interface CMEWorkerNode {
  id: string;
  hostname: string;
  gpu_name?: string;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  cluster_id?: string;
  vram_total_mb?: number;
  vram_used_mb?: number;
  temperature_c?: number;
  gpu_utilization_pct?: number;
  is_draining: boolean;
  maintenance_mode: boolean;
  last_heartbeat?: string;
}

export interface CMERenderQueue {
  id: string;
  priority_id: string;
  name: string;
  description: string;
  max_concurrency: number;
  is_paused: boolean;
}

export interface CMEPipelineStage {
  id: string;
  name: string;
  display_order: number;
  timeout_seconds: number;
}

export interface CMEStageExecution {
  id: string;
  render_job_id: string;
  stage_id: string;
  status: CMEStageStatus;
  started_at?: string;
  completed_at?: string;
  worker_id?: string;
  output_data?: any;
  metrics?: {
    duration_ms?: number;
    cpu_usage?: number;
    memory_usage?: number;
  };
}
