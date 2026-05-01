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
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from 'react-router-dom';

interface CMERenderModalProps {
  aggregationId: string;
  onClose?: () => void;
  onComplete?: () => void;
}

const STAGES = [
  { id: 'aggregation', label: 'Aggregation', icon: Database },
  { id: 'planning', label: 'Planning', icon: Brain },
  { id: 'graphing', label: 'Scene Graph', icon: Settings },
  { id: 'render_queued', label: 'Queue', icon: History },
  { id: 'rendering', label: 'GPU Render', icon: Cpu },
  { id: 'completed', label: 'Finished', icon: CheckCircle2 },
];

export const CMERenderModal = ({ aggregationId, onComplete, onClose }: CMERenderModalProps) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [currentStage, setCurrentStage] = useState('aggregation');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'processing' | 'ready' | 'failed' | 'waiting_hardware'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [sceneGraphId, setSceneGraphId] = useState<string | null>(null);
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
      }

      // Try to find scene graph
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

    // Stuck detection (20s)
    const timer = setInterval(async () => {
      const elapsed = Date.now() - lastEventRef.current;
      if (status === 'processing' && elapsed > 20000) {
        const { data: workers } = await supabase.from('cme_worker_nodes').select('id').eq('status', 'online');
        if (!workers || workers.length === 0) {
          setStatus('waiting_hardware');
        }
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [aggregationId, onComplete, status]);

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
              <div className="space-y-2">
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {error || "Ocorreu um erro inesperado durante a geração do vídeo."}
                </p>
                {currentStage === 'graphing' && (
                  <p className="text-xs text-zinc-500 bg-black/40 p-3 rounded-lg border border-red-500/10">
                    O planejamento pedagógico foi concluído, mas o Scene Graph não pôde ser salvo no banco de dados. Você pode tentar novamente ou gerar uma versão em slides.
                  </p>
                )}
                <span className="text-[10px] mt-2 block opacity-50 uppercase tracking-tighter">
                  Error Code: {events.find(e => e.status === 'failed')?.metadata?.code || 'N/A'} | Stage: {currentStage}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="border-red-500/20 hover:bg-red-500/10 text-red-500"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Tentar Novamente
                </Button>
                <Button 
                  onClick={() => navigate('/tutor')} 
                  variant="outline" 
                  className="border-zinc-800 hover:bg-zinc-800 text-zinc-400"
                >
                  Usar Fallback Pedagógico
                </Button>
                {aggregationId && (
                  <Button onClick={openBuilder} variant="ghost" className="text-zinc-500 underline">
                    Abrir CME Builder
                  </Button>
                )}
              </div>
            </div>
          )}

          {status === 'waiting_hardware' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertCircle className="h-6 w-6" />
                <h3 className="font-bold">Renderização pendente de hardware</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                O vídeo foi planejado e estruturado com sucesso, mas a renderização depende de um Worker/GPU ativo. 
                O sistema tentará novamente assim que um hardware for detectado.
              </p>
              <div className="flex gap-3">
                <Button onClick={openBuilder} variant="outline" className="border-amber-500/20 hover:bg-amber-500/10 text-amber-500">
                  <ExternalLink className="mr-2 h-4 w-4" /> Ir para o Builder
                </Button>
                <Button onClick={() => navigate('/admin/gpu-fleet')} variant="ghost" className="text-zinc-500 underline">Ver status do Cluster GPU</Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-tight">{currentStage.replace(/_/g, ' ')}</span>
              <span className="text-primary text-2xl font-black italic">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-900 shadow-inner" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              const isCompleted = events.some(e => e.stage === stage.id && e.status === 'completed') || (progress === 100 && status === 'ready');
              const isActive = currentStage === stage.id;
              
              return (
                <div key={stage.id} className={cn(
                  "p-3 rounded-xl border transition-all duration-500 flex flex-col items-center gap-2 text-center",
                  isCompleted ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" :
                  isActive ? "bg-primary/5 border-primary/40 text-primary animate-pulse" :
                  "bg-zinc-900/50 border-zinc-800 text-zinc-600 opacity-50"
                )}>
                  <Icon className="h-4 w-4" />
                  <span className="text-[8px] font-black leading-tight uppercase tracking-tight">{stage.label}</span>
                  {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                </div>
              );
            })}
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-4 h-32 overflow-hidden relative font-mono text-[10px]">
            <div className="space-y-1">
              {events.slice().reverse().map((e, i) => (
                <div key={i} className="flex gap-2 animate-in fade-in">
                  <span className="text-zinc-600">[{new Date(e.created_at).toLocaleTimeString()}]</span>
                  <span className={cn("font-bold uppercase", e.status === 'failed' ? "text-red-500" : "text-zinc-500")}>{e.stage}:</span>
                  <span className="text-zinc-400">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
          
          {status === 'ready' && (
             <Button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold uppercase py-6 rounded-2xl shadow-lg shadow-emerald-500/20">
               Concluir e Assistir
             </Button>
          )}
        </div>
      </div>
    </div>
  );
};
