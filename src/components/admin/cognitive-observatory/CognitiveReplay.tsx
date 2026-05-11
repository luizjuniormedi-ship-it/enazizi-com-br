import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, ArrowRight, Brain, Target, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export const CognitiveReplay: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: recentEvents } = useQuery({
    queryKey: ['cognitive-replay-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telemetry_events')
        .select('*')
        .eq('event_name', 'error')
        .order('timestamp', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <History className="w-3 h-3 text-blue-500" />
          Cognitive Replay
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Triggers */}
          <div className="space-y-3">
            <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">Detection Triggers (Recent Errors)</p>
            <div className="space-y-2">
              {recentEvents?.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedSession(event.id)}
                  className={cn(
                    "w-full text-left p-3 rounded border transition-all",
                    selectedSession === event.id 
                      ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <Badge variant="destructive" className="text-[8px] h-4">ERROR DETECTED</Badge>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium truncate">
                    {event.event_name}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono mt-1">
                    Layer: {String((event.properties as any)?.layer || 'Unknown')}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Replay Visualization */}
          <div className="relative pl-6 border-l border-slate-800">
            <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-4">Adaptive Chain Reaction</p>
            
            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-slate-700">
                <Brain className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[10px] uppercase font-mono tracking-tighter italic">Select a trigger to replay sequence</p>
              </div>
            ) : (
              <div className="space-y-6">
                <ReplayStep 
                  icon={<AlertTriangle className="w-3 h-3 text-red-500" />}
                  title="Cognitive Error"
                  description="User failed to identify 'Infectious Endocarditis' signs twice."
                  status="Trigger"
                />
                <ArrowRight className="w-3 h-3 text-slate-800 rotate-90 mx-auto" />
                <ReplayStep 
                  icon={<Target className="w-3 h-3 text-amber-500" />}
                  title="Engine Decision"
                  description="Error Bank triggered priority recalibration for ID layer."
                  status="Active"
                />
                <ArrowRight className="w-3 h-3 text-slate-800 rotate-90 mx-auto" />
                <ReplayStep 
                  icon={<Brain className="w-3 h-3 text-emerald-500" />}
                  title="Adaptive Injection"
                  description="Planner inserted 3 corrective cases in tomorrow's mission."
                  status="Resolved"
                />
                <ArrowRight className="w-3 h-3 text-slate-800 rotate-90 mx-auto" />
                <ReplayStep 
                  icon={<CheckCircle2 className="w-3 h-3 text-blue-500" />}
                  title="Closed Loop"
                  description="Tutor shifted to 'Deep Preceptor' mode for this topic."
                  status="Persistent"
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ReplayStep = ({ icon, title, description, status }: { icon: React.ReactNode, title: string, description: string, status: string }) => (
  <div className="relative group">
    <div className="flex items-start gap-3">
      <div className="mt-1 p-1.5 rounded-full bg-slate-900 border border-slate-800 group-hover:border-slate-600 transition-colors">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-tight">{title}</h4>
          <Badge variant="outline" className="text-[8px] h-3 py-0 border-slate-800 text-slate-500 font-mono">{status}</Badge>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{description}</p>
      </div>
    </div>
  </div>
);
