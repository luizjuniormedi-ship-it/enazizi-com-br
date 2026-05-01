import React, { useEffect, useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  RefreshCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";

interface CMERenderModalProps {
  aggregationId: string;
  onClose?: () => void;
  onComplete?: () => void;
}

const STAGES = [
  { id: 'aggregation', label: 'Session Aggregation', icon: Database },
  { id: 'planning', label: 'Semantic Planning', icon: Brain },
  { id: 'narrative', label: 'Narrative Building', icon: Layout },
  { id: 'graphing', label: 'Scene Graph Generation', icon: Settings },
  { id: 'queue', label: 'Render Queue', icon: History },
  { id: 'rendering', label: 'GPU Rendering', icon: Cpu },
  { id: 'upload', label: 'Upload CDN', icon: Globe },
  { id: 'validation', label: 'Validation', icon: CheckCircle2 },
];

export const CMERenderModal = ({ aggregationId, onComplete }: CMERenderModalProps) => {
  const [events, setEvents] = useState<any[]>([]);
  const [currentStage, setCurrentStage] = useState('aggregation');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'processing' | 'ready' | 'failed'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aggregationId) return;

    // Load initial events
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
        if (last.status === 'ready' || last.status === 'completed' && last.progress === 100) {
          setStatus('ready');
        }
      }
    };

    fetchEvents();

    // Realtime subscription
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
          
          if (newEvent.status === 'failed') {
            setStatus('failed');
            setError(newEvent.error_message || newEvent.message);
          } else if (newEvent.progress === 100) {
            setStatus('ready');
            onComplete?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [aggregationId, onComplete]);

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
                <h2 className="text-xl font-black tracking-tight text-white uppercase">Fábrica de Vídeos CME</h2>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Cinematic Medical Engine — Pipeline Realtime</p>
              </div>
            </div>
            {status === 'ready' && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">READY</Badge>}
            {status === 'failed' && <Badge variant="destructive">FAILED</Badge>}
            {status === 'processing' && (
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase animate-pulse">
                <RefreshCcw className="h-3 w-3 animate-spin" />
                Processando
              </div>
            )}
          </header>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-tight">{currentStage.replace(/_/g, ' ')}</span>
              <span className="text-primary text-2xl font-black italic">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-900 shadow-inner" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              const isCompleted = events.some(e => e.stage === stage.id && e.status === 'completed') || progress > 90;
              const isActive = currentStage === stage.id;
              
              return (
                <div 
                  key={stage.id} 
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-3 text-center",
                    isCompleted ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" :
                    isActive ? "bg-primary/5 border-primary/40 text-primary shadow-glow-sm" :
                    "bg-zinc-900/50 border-zinc-800 text-zinc-600 opacity-50"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "animate-bounce")} />
                  <span className="text-[9px] font-black leading-tight uppercase tracking-tight">{stage.label}</span>
                  {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-xs font-medium animate-in slide-in-from-bottom-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="bg-zinc-900/50 rounded-2xl p-4 h-32 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-zinc-950/50 to-transparent z-10 pointer-events-none" />
            <ScrollArea className="h-full pr-4">
              <div className="space-y-2">
                {events.slice().reverse().map((e, i) => (
                  <div key={i} className="flex items-center gap-3 text-[10px] animate-in fade-in slide-in-from-top-1">
                    <span className="text-zinc-600 font-mono">[{new Date(e.created_at).toLocaleTimeString()}]</span>
                    <span className={cn("font-bold uppercase", e.status === 'failed' ? "text-red-500" : "text-zinc-400")}>{e.stage}:</span>
                    <span className="text-zinc-500">{e.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScrollArea = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("overflow-y-auto", className)}>{children}</div>
);
