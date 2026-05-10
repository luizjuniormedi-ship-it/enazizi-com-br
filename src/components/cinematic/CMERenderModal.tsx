
import React, { useEffect, useState, useRef } from 'react';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  Cpu, 
  Globe, 
  Video, 
  Brain, 
  Database,
  Layout,
  RefreshCcw,
  Play,
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AgileLessonPlayer } from './AgileLessonPlayer';
import { useAdminCheck } from "@/hooks/useAdminCheck";
import {
  humanizeCMEMessage,
  FRIENDLY_STATUS_LABEL,
  friendlyStageLabel,
} from './cmeUserMessages';

interface CMERenderModalProps {
  aggregationId: string;
  onClose?: () => void;
  onComplete?: () => void;
}

// Telemetria técnica: VISÍVEL APENAS NO MODO ADMIN/DEV.
const STAGES = [
  { id: 'planning', label: 'Planning', icon: Brain, progress: 15 },
  { id: 'mapping', label: 'Mapping', icon: Database, progress: 35 },
  { id: 'graphing', label: 'Scene Graph', icon: Layout, progress: 50 },
  { id: 'render_job_creation', label: 'Render Job', icon: Settings, progress: 60 },
  { id: 'worker_selection', label: 'Worker', icon: Cpu, progress: 70 },
  { id: 'gpu_rendering', label: 'GPU Render', icon: Cpu, progress: 80 },
  { id: 'hls_cdn_sync', label: 'HLS/CDN', icon: Globe, progress: 90 },
  { id: 'completed', label: 'Finished', icon: CheckCircle2, progress: 100 },
];

// Rótulos técnicos (admin/dev only).
const STAGE_LABELS: Record<string, string> = {
  planning: 'Planejamento Semântico',
  mapping: 'Mapeamento de Conhecimento',
  graphing: 'Gerando Scene Graph',
  render_job_creation: 'Criando Render Job',
  worker_selection: 'Selecionando Worker GPU',
  gpu_rendering: 'GPU Renderizando',
  hls_cdn_sync: 'Sincronizando HLS/CDN',
  completed: 'Concluído',
};

const MAX_AUTO_RETRIES = 2; // Override freeze: cme-ux-correct-fix.

export const CMERenderModal = ({ aggregationId, onComplete, onClose }: CMERenderModalProps) => {
  const navigate = useNavigate();
  const { isAdmin } = useAdminCheck();
  const [events, setEvents] = useState<any[]>([]);
  const [currentStage, setCurrentStage] = useState('aggregation');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'processing' | 'ready' | 'failed' | 'waiting_hardware'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [sceneGraphId, setSceneGraphId] = useState<string | null>(null);
  const [renderJob, setRenderJob] = useState<any | null>(null);
  const [configState, setConfigState] = useState<'config_validated' | 'config_warning' | 'config_invalid' | 'retry_using_original_config' | 'fallback_using_config' | 'unknown'>('unknown');
  const [devWorkerLoading, setDevWorkerLoading] = useState(false);
  const [devWorkerError, setDevWorkerError] = useState<string | null>(null);
  const [showAgilePlayer, setShowAgilePlayer] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const lastEventRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!aggregationId) return;

    const fetchEvents = async () => {
      const { data } = await supabase
        .from('cme_pipeline_events')
        .select('*')
        .eq('aggregation_id', aggregationId)
        .order('created_at', { ascending: true });
      
      if (data && data.length > 0) {
        setEvents(data);
        const last = data[data.length - 1];
        setCurrentStage(last.stage);
        setProgress(last.progress);
        if (last.status === 'completed' && last.progress === 100) setStatus('ready');
        const hasConfigWarning = data.some((e: any) => e.stage === 'config' && e.status === 'warning');
        if (hasConfigWarning) setConfigState('config_warning');
      }

      const { data: job } = await supabase
        .from('cme_render_jobs' as any)
        .select('id, status, progress, config, retry_count, gpu_worker_id, pipeline_last_error, output_url, preview_url, project_id')
        .eq('generation_id', aggregationId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (job) {
        setRenderJob(job);
        const cfg = (job as any).config || {};
        if (cfg && cfg._config_version) {
          setConfigState((prev) => (prev === 'config_warning' ? prev : 'config_validated'));
        } else {
          setConfigState('config_invalid');
        }
      }

      const { data: sg } = await supabase.from('cme_scene_graphs' as any)
        .select('id')
        .eq('video_project_id', aggregationId)
        .limit(1)
        .maybeSingle();
      if (sg) setSceneGraphId((sg as any).id);
    };

    fetchEvents();

    const channel = supabase
      .channel(`cme-render-${aggregationId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'cme_pipeline_events', 
          filter: `aggregation_id=eq.${aggregationId}` 
        },
        (payload) => {
          const newEvent = payload.new;
          setEvents(prev => [...prev, newEvent]);
          setCurrentStage(newEvent.stage);
          setProgress(newEvent.progress);
          lastEventRef.current = Date.now();
          
          if (newEvent.status === 'failed') {
            setStatus('failed');
            setError(newEvent.message);
          } else if (newEvent.progress === 100) {
            setStatus('ready');
            onComplete?.();
          }
        }
      )
      .subscribe();

    const timer = setInterval(async () => {
      const elapsed = Date.now() - lastEventRef.current;
      if (status !== 'processing' || elapsed < 30000) return;

      const [{ data: sg }, { data: job }, { data: workers }] = await Promise.all([
        supabase.from('cme_scene_graphs' as any).select('id').eq('video_project_id', aggregationId).limit(1).maybeSingle(),
        supabase.from('cme_render_jobs' as any)
          .select('id, status, progress, gpu_worker_id, pipeline_last_error, output_url, preview_url')
          .eq('generation_id', aggregationId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('cme_worker_nodes').select('id').eq('status', 'online').eq('is_draining', false),
      ]);

      const hasWorkers = (workers?.length ?? 0) > 0;
      if (!sg && progress < 50) return;
      
      if (!job && progress >= 50) {
        setStatus('failed');
        setError('RENDER_JOB_NOT_CREATED — orchestrator não criou render job.');
        return;
      }
      if (job && !(job as any).gpu_worker_id && !hasWorkers) {
        setStatus('waiting_hardware');
        return;
      }
      lastEventRef.current = Date.now();
    }, 5000);

    const pollTimer = setInterval(async () => {
      if (status === 'ready' || status === 'failed') return;

      let jobQuery = supabase
        .from('cme_render_jobs' as any)
        .select('id, status, progress, gpu_worker_id, pipeline_last_error, output_url, preview_url, project_id, aggregation_id')
        .order('updated_at', { ascending: false })
        .limit(1);
      
      const projectIdHint = (renderJob as any)?.project_id;
      if (projectIdHint) {
        jobQuery = jobQuery.eq('project_id', projectIdHint);
      } else {
        jobQuery = jobQuery.or(`generation_id.eq.${aggregationId},aggregation_id.eq.${aggregationId}`);
      }
      const { data: latestJob } = await jobQuery.maybeSingle();

      if (latestJob) {
        setRenderJob((prev: any) => ({ ...(prev || {}), ...(latestJob as any) }));
        if ((latestJob as any).status === 'completed') setStatus('ready');
        if ((latestJob as any).status === 'failed') {
          setStatus('failed');
          setError((latestJob as any).pipeline_last_error || 'Render falhou');
        }
      }

      const targetJobId = (latestJob as any)?.id || (renderJob as any)?.id;
      const eventsQuery = targetJobId
        ? supabase.from('cme_pipeline_events').select('*').or(`aggregation_id.eq.${aggregationId},render_job_id.eq.${targetJobId}`)
        : supabase.from('cme_pipeline_events').select('*').eq('aggregation_id', aggregationId);

      const { data: latestEvents } = await eventsQuery.order('created_at', { ascending: true });

      if (latestEvents && latestEvents.length > 0) {
        setEvents(latestEvents);
        const last = latestEvents[latestEvents.length - 1];
        setCurrentStage(last.stage);
        setProgress(last.progress);
        if (last.status === 'failed') {
          setStatus('failed');
          setError(last.message);
        } else if (last.progress === 100 || last.stage === 'completed') {
          setStatus('ready');
        }
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      clearInterval(pollTimer);
    };
  }, [aggregationId, onComplete, status, renderJob]);

  const openBuilder = () => {
    if (aggregationId) {
      navigate(`/admin/cinematic-builder/${aggregationId}`);
      onClose?.();
    }
  };

  // Retry manual capado (override freeze: cme-ux-correct-fix).
  const handleManualRetry = async () => {
    if (retryCount >= MAX_AUTO_RETRIES) {
      toast.error("Limite de tentativas atingido.", {
        description: "Por favor, tente novamente mais tarde ou contate o suporte.",
        id: "cme-retry-limit",
      });
      return;
    }
    setRetryCount(c => c + 1);
    setStatus('processing');
    setError(null);
    setProgress(0);
    const projectId = (renderJob as any)?.project_id;
    if (projectId) {
      try {
        await supabase.from("cme_render_jobs").update({ status: 'queued' } as any).eq('project_id', projectId);
        toast.success("Iniciando nova tentativa…", { id: "cme-retry" });
      } catch (e: any) {
        toast.error("Não foi possível iniciar uma nova tentativa agora.", { id: "cme-retry-fail" });
      }
    } else {
      window.location.reload();
    }
  };

  // ---- USER MODE (default): UI limpa, sem termos técnicos. ----
  // ---- ADMIN MODE: telemetria completa visível. ----
  const friendlyTitle = "Geração da aula";
  const friendlyStatus = FRIENDLY_STATUS_LABEL[status] ?? FRIENDLY_STATUS_LABEL.processing;
  const friendlyError = humanizeCMEMessage(error);
  const friendlyStage = friendlyStageLabel(progress);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
        paddingLeft: "max(env(safe-area-inset-left), 12px)",
        paddingRight: "max(env(safe-area-inset-right), 12px)",
      }}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 flex flex-col"
        style={{ maxHeight: "min(80dvh, 720px)" }}
      >
        {/* HEADER (sticky) */}
        <header className="flex-shrink-0 flex items-center justify-between gap-3 px-5 sm:px-8 py-4 sm:py-5 border-b border-white/5 bg-zinc-950">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Video className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {isAdmin ? "CME Cinematic Engine" : friendlyTitle}
              </h2>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-medium uppercase tracking-widest truncate">
                {isAdmin ? "Pipeline Enterprise Hardened" : friendlyStatus}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status === 'ready' && (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 text-[10px]">
                {isAdmin ? "READY" : "Pronta"}
              </Badge>
            )}
            {status === 'waiting_hardware' && isAdmin && (
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-2 py-0.5 text-[10px]">PENDING HARDWARE</Badge>
            )}
            {status === 'failed' && isAdmin && (
              <Badge variant="destructive" className="text-[10px]">FAILED</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 text-zinc-400 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* BODY (scroll) */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6 space-y-6">
          {/* Failure card */}
          {status === 'failed' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 sm:p-6 space-y-3 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <h3 className="font-semibold text-sm">
                  {isAdmin ? "Falha no Pipeline CME" : "Não conseguimos preparar a aula"}
                </h3>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">
                {isAdmin ? (error || "Erro inesperado.") : friendlyError}
              </p>
              {retryCount >= MAX_AUTO_RETRIES && !isAdmin && (
                <p className="text-zinc-500 text-xs">
                  Você atingiu o limite de tentativas. Tente novamente mais tarde.
                </p>
              )}
            </div>
          )}

          {/* Agile Mode Callout */}
          {['graphing', 'render_job_creation', 'worker_selection', 'gpu_rendering', 'pending_hardware', 'waiting_hardware', 'completed'].includes(currentStage) && progress >= 50 && status !== 'failed' && (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 sm:p-6 space-y-3 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-primary min-w-0">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <h3 className="font-bold text-sm truncate">Aula Interativa Pronta!</h3>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/10 uppercase text-[9px] font-black shrink-0">Acesso Instantâneo</Badge>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                A estrutura pedagógica e as questões já foram processadas. Você pode assistir a versão interativa agora.
              </p>
              <Button 
                onClick={() => setShowAgilePlayer(true)}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl gap-2"
              >
                <Play className="h-4 w-4 fill-current" /> Assistir Versão Ágil
              </Button>
            </div>
          )}

          {/* Waiting hardware — DEV worker simulation: ADMIN ONLY */}
          {status === 'waiting_hardware' && isAdmin && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-6 space-y-3 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <h3 className="font-bold text-sm">Aguardando disponibilidade de GPU</h3>
              </div>
              <Button
                size="sm"
                disabled={devWorkerLoading}
                onClick={async () => {
                  setDevWorkerLoading(true);
                  try {
                    await supabase.functions.invoke('cme-dev-worker', {
                      body: { action: 'pickup_and_run', projectId: renderJob?.project_id, aggregationId }
                    });
                    toast.success("Worker DEV simulado com sucesso!");
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setDevWorkerLoading(false);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-10 w-full"
              >
                {devWorkerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="mr-2 h-4 w-4" />} Iniciar Simulação de Render (DEV)
              </Button>
            </div>
          )}

          {/* Waiting hardware — USER MODE: friendly */}
          {status === 'waiting_hardware' && !isAdmin && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-2">
              <h3 className="font-semibold text-sm text-zinc-200">Aguardando início da geração…</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Sua aula está na fila. Isso pode levar alguns instantes.
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-medium text-zinc-400">
              <span className="truncate pr-2">
                {isAdmin ? (STAGE_LABELS[currentStage] || 'Processando') : friendlyStage}
              </span>
              <span className="tabular-nums shrink-0">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-900" />
          </div>

          {/* ADMIN-ONLY: stage timeline + telemetria */}
          {isAdmin && (
            <div className="pt-4 border-t border-white/5 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">
                Telemetria (admin/dev)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                {STAGES.map(s => {
                  const reached = progress >= s.progress;
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-md border",
                        reached
                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-600"
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-zinc-600 font-mono space-y-0.5 pt-2">
                <div>aggregation_id: {aggregationId}</div>
                {renderJob?.id && <div>render_job_id: {renderJob.id}</div>}
                {renderJob?.gpu_worker_id && <div>worker_id: {renderJob.gpu_worker_id}</div>}
                <div>config: {configState}</div>
                <div>events: {events.length}</div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER (sticky CTAs) */}
        <footer className="flex-shrink-0 px-5 sm:px-8 py-4 border-t border-white/5 bg-zinc-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "h-2 w-2 rounded-full shrink-0",
              status === 'ready' ? "bg-emerald-500" :
              status === 'failed' ? "bg-red-500" :
              "bg-amber-500 animate-pulse"
            )} />
            <span className="text-xs text-zinc-500 truncate">
              {isAdmin ? `Pipeline: ${status}` : friendlyStatus}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {status === 'failed' && retryCount < MAX_AUTO_RETRIES && (
              <Button onClick={handleManualRetry} variant="outline" size="sm" className="gap-1.5">
                <RefreshCcw className="h-3.5 w-3.5" /> Tentar novamente
              </Button>
            )}
            {isAdmin && (
              <Button onClick={openBuilder} variant="ghost" size="sm" className="text-zinc-400">
                Abrir no CME
              </Button>
            )}
            <Button onClick={onClose} variant="ghost" size="sm" className="text-zinc-400">
              Fechar
            </Button>
          </div>
        </footer>
      </div>

      {showAgilePlayer && (
        <AgileLessonPlayer 
          aggregationId={aggregationId} 
          onClose={() => setShowAgilePlayer(false)} 
        />
      )}
    </div>
  );
};
