import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { 
  Clapperboard, 
  Brain, 
  History, 
  Settings2, 
  Play, 
  Save, 
  Plus, 
  ChevronRight,
  GripVertical,
  Activity,
  AlertCircle,
  Stethoscope,
  BarChart,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CMERenderModal } from "@/components/cinematic/CMERenderModal";

export default function CinematicBuilder() {
  const { aggregationId } = useParams();
  const [searchParams] = useSearchParams();
  const [aggregation, setAggregation] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (aggregationId && aggregationId !== 'new') {
      fetchAggregationData();
    } else {
      const mode = searchParams.get('mode');
      const topic = searchParams.get('topic');
      if (mode === 'full_session' && topic) {
        startNewAggregation();
      }
    }
  }, [aggregationId, searchParams]);

  const fetchAggregationData = async () => {
    setIsLoading(true);
    const { data: agg } = await supabase
      .from('cme_session_aggregations')
      .select('*')
      .eq('id', aggregationId)
      .single();
    
    if (agg) {
      setAggregation(agg);
      const { data: b } = await supabase
        .from('cme_lesson_blocks')
        .select('*')
        .eq('aggregation_id', agg.id)
        .order('order_index', { ascending: true });
      setBlocks(b || []);
    }
    setIsLoading(false);
  };

  const startNewAggregation = async () => {
    setIsProcessing(true);
    // Logic to call the edge function cme-start-pipeline
    // For now we simulate or call it via searchParams if we had tutorSessionId
    const tutorSessionId = searchParams.get('tutorSessionId') || searchParams.get('session');
    if (!tutorSessionId) {
      console.warn("[CinematicBuilder] Tutor Session ID is missing in query params");
      toast.error("ID da sessão do Tutor ausente. Não é possível iniciar o pipeline.");
      setIsProcessing(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('cme-start-pipeline', {
        body: { tutorSessionId, mode: 'full_session' }
      });

      if (error) throw error;
      if (data?.aggregationId) {
        window.history.replaceState(null, '', `/admin/cinematic-builder/${data.aggregationId}`);
        fetchAggregationData();
      }
    } catch (err: any) {
      toast.error("Failed to start pipeline: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartRender = () => {
    setShowRenderModal(true);
  };

  if (isLoading && !isProcessing) return <div className="flex h-screen items-center justify-center bg-black text-white">Loading CME Builder...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-32">
      {showRenderModal && aggregation && (
        <CMERenderModal 
          aggregationId={aggregation.id} 
          onComplete={() => toast.success("Render concluído!")} 
        />
      )}

      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/40">
            <Clapperboard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Cinematic Builder</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
              {aggregation?.title || 'Novo Projeto Médico'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-zinc-800 bg-zinc-900/50 rounded-xl gap-2 text-xs font-bold">
            <Save className="h-4 w-4" /> SALVAR RASCUNHO
          </Button>
          <Button 
            onClick={handleStartRender}
            className="bg-orange-600 hover:bg-orange-500 rounded-xl gap-2 text-xs font-black shadow-lg shadow-orange-900/20"
          >
            <Play className="h-4 w-4" /> GERAR VIDEOAULA
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Capítulos Pedagógicos</h2>
            <Button variant="ghost" size="sm" className="text-primary gap-2 text-[10px] font-bold">
              <Plus className="h-3 w-3" /> ADICIONAR BLOCO
            </Button>
          </div>

          <div className="space-y-3">
            {blocks.map((block, idx) => (
              <Card key={block.id} className="bg-zinc-900/50 border-zinc-800 group hover:border-orange-600/50 transition-all rounded-2xl">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-zinc-700 group-hover:text-zinc-400 transition-colors">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center text-xs font-black italic text-zinc-500">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase tracking-tighter px-2",
                        block.block_type === 'mini_quiz' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-orange-600/5 border-orange-600/20 text-orange-600"
                      )}>
                        {block.block_type === 'mini_quiz' ? 'QUIZ INTERATIVO' : block.block_type}
                      </Badge>
                      <h3 className="text-sm font-bold text-white truncate">{block.title}</h3>
                    </div>
                    {block.block_type === 'mini_quiz' ? (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-400 line-clamp-2 italic font-medium">
                          {block.content?.split('\n').find(l => l.trim().length > 0 && !l.startsWith('#'))}
                        </p>
                        {block.scene_graph_data?.questions?.length > 0 && (
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-[8px] h-4 bg-zinc-900 text-zinc-600 uppercase border-zinc-800">
                              {block.scene_graph_data.questions.length} Perguntas extraídas
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 truncate">{block.content?.substring(0, 100)}...</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-zinc-500">
                    <div className="flex items-center gap-1">
                      <BarChart className="h-3.5 w-3.5 text-blue-500" />
                      {block.cognitive_density?.toFixed(1) || '0.8'}
                    </div>
                    <span>{block.estimated_minutes} min</span>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-md">
            <CardContent className="p-6 space-y-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-800 pb-3">Análise Cognitiva</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-500">DENSIDADE NARRATIVA</span>
                  <span className="text-xs font-black text-primary italic">ALTA (0.9)</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-[90%] bg-primary shadow-glow-sm" />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-500">FADIGA COGNITIVA</span>
                  <span className="text-xs font-black text-emerald-500 italic">BAIXA (0.2)</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-[20%] bg-emerald-500" />
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 p-3 rounded-2xl text-center">
                  <div className="text-zinc-500 text-[9px] font-black uppercase tracking-tight mb-1">Duração Est.</div>
                  <div className="text-lg font-black italic">14:20</div>
                </div>
                <div className="bg-zinc-800/50 p-3 rounded-2xl text-center">
                  <div className="text-zinc-500 text-[9px] font-black uppercase tracking-tight mb-1">Specialty</div>
                  <div className="text-xs font-black truncate">{aggregation?.detected_specialties?.[0] || 'Geral'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-zinc-900 to-black border-zinc-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-orange-600">
              <Activity className="h-5 w-5" />
              <h3 className="text-sm font-black uppercase">Telemetry Ready</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              O pipeline está conectado ao Cluster GPU. A geração utilizará o Scene Graph Dinâmico para renderização cinematográfica.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
