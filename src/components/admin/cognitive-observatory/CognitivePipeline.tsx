import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Zap, Brain, LayoutDashboard, AlertTriangle, Play, CheckCircle2 } from 'lucide-react';

interface PipelineStep {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'idle' | 'processing' | 'success' | 'error';
  timestamp?: string;
  latency?: number;
  metadata?: any;
}

const steps: PipelineStep[] = [
  { id: 'error', name: 'ERRO', icon: <AlertTriangle className="w-4 h-4" />, status: 'success' },
  { id: 'error_bank', name: 'ERROR BANK', icon: <Database className="w-4 h-4" />, status: 'success' },
  { id: 'study_engine', name: 'STUDY ENGINE', icon: <Zap className="w-4 h-4" />, status: 'processing' },
  { id: 'planner', name: 'PLANNER', icon: <Play className="w-4 h-4" />, status: 'idle' },
  { id: 'fsrs', name: 'FSRS', icon: <Brain className="w-4 h-4" />, status: 'idle' },
  { id: 'tutor', name: 'TUTOR IA', icon: <Brain className="w-4 h-4" />, status: 'idle' },
  { id: 'tri', name: 'TRI', icon: <Brain className="w-4 h-4" />, status: 'idle' },
  { id: 'dashboard', name: 'DASHBOARD', icon: <LayoutDashboard className="w-4 h-4" />, status: 'idle' },
];

export const CognitivePipeline: React.FC = () => {
  return (
    <Card className="bg-slate-950/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          COGNITIVE PIPELINE MONITOR
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex justify-between items-center px-4 py-8 overflow-x-auto">
          {/* Connecting Line Background */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
          
          {steps.map((step, index) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center border-2
                  ${step.status === 'success' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' :
                    step.status === 'processing' ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' :
                    'bg-slate-900 border-slate-700 text-slate-500'}
                `}
              >
                {step.status === 'processing' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Zap className="w-6 h-6" />
                  </motion.div>
                ) : step.status === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  step.icon
                )}
              </motion.div>
              
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  {step.name}
                </p>
                {step.latency && (
                  <span className="text-[8px] text-slate-500 font-mono">
                    {step.latency}ms
                  </span>
                )}
              </div>

              {index < steps.length - 1 && (
                <div className="absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2">
                   {/* Arrow or animation if needed */}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Confidence Score</p>
              <p className="text-lg font-mono text-emerald-400">0.94</p>
           </div>
           <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Latency (Avg)</p>
              <p className="text-lg font-mono text-amber-400">142ms</p>
           </div>
           <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Active Threads</p>
              <p className="text-lg font-mono text-blue-400">12</p>
           </div>
           <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase">Cache Hit Rate</p>
              <p className="text-lg font-mono text-purple-400">88%</p>
           </div>
        </div>
      </CardContent>
    </Card>
  );
};
