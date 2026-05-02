
import React, { useEffect, useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
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
  History,
  Layout,
  RefreshCcw,
  ExternalLink,
  Play,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AgileLessonPlayer } from './AgileLessonPlayer';

interface CMERenderModalProps {
  aggregationId: string;
  onClose?: () => void;
  onComplete?: () => void;
}

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

export const CMERenderModal = ({ aggregationId, onComplete, onClose }: CMERenderModalProps) => {
  const navigate = useNavigate();
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

      // Latest render job
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
      if (!sg && progress < 50) return; // Still scripting
      
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-primary/10">
        <div className="p-8 space-y-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase">CME Cinematic Engine</h2>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Pipeline Enterprise Hardened</p>
              </div>
            </div>
            {status === 'ready' && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">READY</Badge>}
            {status === 'waiting_hardware' && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1">PENDING HARDWARE</Badge>}
            {status === 'failed' && <Badge variant="destructive">FAILED</Badge>}
          </header>

          {status === 'failed' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-500">
                <AlertCircle className="h-6 w-6" />
                <h3 className="font-bold">Falha no Pipeline CME</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">{error || "Erro inesperado."}</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => window.location.reload()} variant="outline" className="border-red-500/20 text-red-500">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Tentar Novamente
                </Button>
                <Button onClick={openBuilder} variant="ghost" className="text-zinc-500 underline">Abrir Builder</Button>
              </div>
            </div>
          )}

          {/* Agile Mode Callout */}
          {['graphing', 'render_job_creation', 'worker_selection', 'gpu_rendering', 'pending_hardware', 'waiting_hardware', 'completed'].includes(currentStage) && progress >= 50 && (
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500 shadow-lg shadow-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-primary">
                  <Sparkles className="h-6 w-6" />
                  <h3 className="font-bold">Aula Interativa Pronta!</h3>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/10 uppercase text-[9px] font-black">Acesso Instantâneo</Badge>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                A estrutura pedagógica e as questões já foram processadas. Você pode assistir a versão interativa agora enquanto a versão cinematográfica é renderizada em background.
              </p>
              <Button 
                onClick={() => setShowAgilePlayer(true)}
                className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-lg shadow-primary/20 gap-2"
              >
                <Play className="h-5 w-5 fill-current" /> Assistir Versão Ágil
              </Button>
            </div>
          )}

          {status === 'waiting_hardware' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertCircle className="h-6 w-6" />
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

          <div className="space-y-4">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span>{STAGE_LABELS[currentStage] || 'Processando'}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-900" />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
             <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", status === 'ready' ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-tighter">
                  Pipeline: {status}
                </span>
             </div>
             {status === 'ready' && (
               <Button onClick={onClose} variant="ghost" className="text-xs">Fechar Monitor</Button>
             )}
          </div>
        </div>
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
