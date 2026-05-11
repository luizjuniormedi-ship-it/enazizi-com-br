import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MessageSquare, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CognitiveTimeline: React.FC = () => {
  const { data: events } = useQuery({
    queryKey: ['cognitive-timeline-v2'],
    queryFn: async () => {
      const { data: tutorEvents, error: tutorError } = await supabase
        .from('tutor_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      const { data: telemetryEvents, error: telemetryError } = await supabase
        .from('telemetry_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (tutorError || telemetryError) throw tutorError || telemetryError;

      const combined = [
        ...(tutorEvents || []).map(e => ({ 
          id: e.id,
          created_at: e.created_at,
          event_type: e.event_type,
          topic: e.topic,
          outcome: e.outcome,
          source: 'tutor' 
        })),
        ...(telemetryEvents || []).map(e => ({ 
          id: e.id,
          created_at: e.timestamp,
          event_type: e.event_name,
          topic: (e.properties as any)?.topic,
          outcome: null,
          source: 'telemetry' 
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15);

      return combined;
    }
  });

  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          COGNITIVE EVOLUTION TIMELINE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-slate-800">
        {events?.map((event: any) => (
          <div key={`${event.source}-${event.id}`} className="relative pl-6 border-l border-slate-800 pb-6 last:pb-0">
            <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
            
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-mono text-slate-500">
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
              </span>
              <div className="flex gap-2">
                {event.source === 'tutor' ? (
                  <MessageSquare className="w-3 h-3 text-purple-400" />
                ) : (
                  <Target className="w-3 h-3 text-emerald-400" />
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 font-medium">
              {event.event_type || 'System Event'}
            </p>
            
            {event.topic && (
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                Topic: {event.topic}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[8px] font-mono text-slate-400 uppercase">
                {event.source}
              </span>
              {event.outcome && (
                <span className={`px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[8px] font-mono uppercase ${event.outcome === 'success' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {event.outcome}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
