import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, ShieldAlert, Activity, LayoutDashboard, Database, Zap, Cpu, AlertCircle, BarChart3, Fingerprint } from 'lucide-react';
import { CognitivePipeline } from '@/components/admin/cognitive-observatory/CognitivePipeline';
import { FSRSInspector } from '@/components/admin/cognitive-observatory/FSRSInspector';
import { ErrorIntelligence } from '@/components/admin/cognitive-observatory/ErrorIntelligence';
import { AIRuntimeMonitor } from '@/components/admin/cognitive-observatory/AIRuntimeMonitor';
import { CognitiveTimeline } from '@/components/admin/cognitive-observatory/CognitiveTimeline';
import { CognitiveStateEngine } from '@/components/admin/cognitive-observatory/CognitiveStateEngine';
import { PerformanceAnalytics } from '@/components/admin/cognitive-observatory/PerformanceAnalytics';
import { CognitiveAlerts } from '@/components/admin/cognitive-observatory/CognitiveAlerts';
import { CognitiveReplay } from '@/components/admin/cognitive-observatory/CognitiveReplay';
import { ModelIntelligence } from '@/components/admin/cognitive-observatory/ModelIntelligence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CognitiveObservatory: React.FC = () => {
  useEffect(() => {
    // Setup real-time subscriptions for critical cognitive events
    const tutorChannel = supabase
      .channel('cognitive-tutor-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutor_events' }, (payload) => {
        const newData = payload.new as any;
        if (!newData) return;
        toast.info(`Cognitive Event: ${newData.event_type || 'Update'}`, {
          description: newData.topic ? `Topic: ${newData.topic}` : undefined,
          icon: <Brain className="w-4 h-4 text-purple-500" />
        });
      })
      .subscribe();

    const runtimeChannel = supabase
      .channel('cognitive-runtime-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_runtime_logs' }, (payload) => {
        if (!payload.new.success) {
          toast.error(`AI Runtime Failure: ${payload.new.task_type}`, {
            description: `Model: ${payload.new.model} - Fallback Triggered`,
            icon: <ShieldAlert className="w-4 h-4 text-red-500" />
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tutorChannel);
      supabase.removeChannel(runtimeChannel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 space-y-8 font-sans">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/50 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-white">
              COGNITIVE <span className="text-emerald-500">OBSERVATORY</span>
            </h1>
          </div>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">
            Enazizi adaptive learning intelligence monitor • live forensics
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="bg-slate-900/50 border-slate-800 text-xs h-8 gap-2 hover:bg-slate-800">
            <Database className="w-3 h-3" />
            EXPORT TELEMETRY
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-xs h-8 gap-2 font-bold">
            <Activity className="w-3 h-3" />
            RECALIBRATE ENGINES
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: States & Pipeline & Performance */}
        <div className="xl:col-span-3 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="md:col-span-3"
            >
              <CognitiveStateEngine />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="md:col-span-1"
            >
              <Card className="bg-emerald-500/5 border-emerald-500/20 backdrop-blur-sm h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint className="w-3 h-3" />
                    Adaptive Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-white italic tracking-tighter">
                    94.<span className="text-emerald-500">8</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">HIGHLY PERSONALIZED</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[9px] uppercase font-mono">
                      <span className="text-slate-600">Dynamic Decisions</span>
                      <span className="text-slate-300">124</span>
                    </div>
                    <div className="flex justify-between text-[9px] uppercase font-mono">
                      <span className="text-slate-600">Explainability</span>
                      <span className="text-slate-300">8.9/10</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <CognitivePipeline />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <PerformanceAnalytics />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <ModelIntelligence />
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <CognitiveReplay />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <ErrorIntelligence />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <FSRSInspector />
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <AIRuntimeMonitor />
          </motion.div>

        </div>

        {/* Right Column: Timeline & Explain Decisions */}
        <div className="xl:col-span-1 space-y-6">
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CognitiveAlerts />
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="h-full"
          >
            <CognitiveTimeline />
          </motion.div>

          <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Brain className="w-3 h-3 text-purple-500" />
                EXPLAIN DECISION
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 italic mb-4">
                "O sistema escolheu priorizar IAM devido à queda súbita na retenção (FSRS) e reincidência de erros em conduta diagnóstica (Error Bank)."
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-[10px] h-8 border-slate-800 hover:bg-slate-900">
                  REASONING LOGS
                </Button>
                <Button variant="outline" className="flex-1 text-[10px] h-8 border-slate-800 hover:bg-slate-900">
                  CALIBRATION
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Footer Info */}
      <footer className="pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-600" />
            <span className="text-[10px] text-slate-500 font-mono">Engine: v2.4.1-adaptive</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-600" />
            <span className="text-[10px] text-slate-500 font-mono">Uptime: 99.98%</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-600 font-mono">
          © 2026 ENAZIZI COGNITIVE CORP • CONFIDENTIAL ADMIN ACCESS
        </p>
      </footer>
    </div>
  );
};

export default CognitiveObservatory;
