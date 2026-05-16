import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, TrendingUp, ShieldAlert, Cpu, BarChart3, Zap } from 'lucide-react';
import { ExecutiveOverview } from '@/components/admin/executive/ExecutiveOverview';
import { Button } from '@/components/ui/button';

const ExecutiveIntelligence: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 space-y-8 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/50 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-white">
              EXECUTIVE <span className="text-blue-500">INTELLIGENCE</span>
            </h1>
          </div>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">
            ENAZIZI ENTERPRISE DECISION SUPPORT • PHASE 2
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="bg-slate-900/50 border-slate-800 text-xs h-8 gap-2 hover:bg-slate-800">
            <TrendingUp className="w-3 h-3" />
            SIMULATE ROI
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 text-xs h-8 gap-2 font-bold">
            <LayoutDashboard className="w-3 h-3" />
            PUBLISH REPORT
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
           <ExecutiveOverview />
        </div>
        
        <div className="xl:col-span-1 space-y-6">
            <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="p-6 rounded-2xl bg-slate-950/50 border border-slate-800 backdrop-blur-sm"
            >
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-3 h-3 text-red-500" />
                    RISK ANALYSIS
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-2 rounded bg-red-500/5 border border-red-500/10">
                        <span className="text-[10px] text-red-400 font-bold uppercase">Churn Risk</span>
                        <span className="text-xs font-mono text-white">12% LOW</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-amber-500/5 border border-amber-500/10">
                        <span className="text-[10px] text-amber-400 font-bold uppercase">Model Drift</span>
                        <span className="text-xs font-mono text-white">0.4% NEGLIGIBLE</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">Uptime</span>
                        <span className="text-xs font-mono text-white">99.99%</span>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-2xl bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-600/20"
            >
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <h3 className="text-xs font-black text-white uppercase italic">Phase 2 Insights</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                    "O motor de TRI indica que a dificuldade média das questões está 12% acima do ideal para o perfil atual. Recomendamos recalibragem do Simulator Agent."
                </p>
            </motion.div>
        </div>
      </div>

      <footer className="pt-8 border-t border-slate-800/50 flex justify-between items-center">
        <div className="flex gap-4">
           <div className="flex items-center gap-2">
             <Cpu className="w-4 h-4 text-slate-600" />
             <span className="text-[10px] text-slate-500 font-mono italic">Governance v2.0</span>
           </div>
           <div className="flex items-center gap-2">
             <BarChart3 className="w-4 h-4 text-slate-600" />
             <span className="text-[10px] text-slate-500 font-mono italic">Analytics Level: Enterprise</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default ExecutiveIntelligence;
