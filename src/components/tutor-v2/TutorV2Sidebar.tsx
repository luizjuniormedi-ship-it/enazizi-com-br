import { 
  History, 
  Settings, 
  BookOpen, 
  Target, 
  AlertTriangle, 
  ClipboardCheck,
  Zap,
  ChevronRight,
  TrendingUp,
  Brain
} from "lucide-react";
import { MascotAvatar } from "../mascot/MascotAvatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import TutorV2History from "./TutorV2History";
import { motion } from "framer-motion";

interface TutorV2SidebarProps {
  session: any;
  stats?: {
    topicsCount: number;
    retention: number;
    errors: number;
  };
}

export default function TutorV2Sidebar({ session, stats }: TutorV2SidebarProps) {
  return (
    <aside className="w-80 border-r border-white/5 bg-slate-950 flex flex-col hidden xl:flex relative overflow-hidden">
      {/* Sidebar background glow */}
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
      
      <div className="p-6 relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-4 mb-10 group cursor-pointer">
          <div className="h-14 w-14 group-hover:scale-110 transition-transform duration-500">
            <MascotAvatar state="idle" size="md" />
          </div>

          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider leading-none">Tutor V3</h2>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Premium Active</p>
            </div>
          </div>
        </div>

        <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {/* Timeline / Cognitive Evolution */}
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4 px-2">Evolução Cognitiva</p>
            <div className="grid grid-cols-2 gap-2 px-2">
              <StatCard icon={TrendingUp} label="Retenção" value={`${stats?.retention || 0}%`} color="text-emerald-400" />
              <StatCard icon={Brain} label="Tópicos" value={stats?.topicsCount || 0} color="text-indigo-400" />
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4 px-2">Módulos de Elite</p>
            <nav className="space-y-1.5">
              <SidebarItem icon={Target} label="Mission Control" active count="12" />
              <SidebarItem icon={BookOpen} label="Quality Map" />
              <SidebarItem icon={AlertTriangle} label="Error Bank" count={stats?.errors.toString() || "0"} />
              <SidebarItem icon={Zap} label="Smart Planner" />
              <SidebarItem icon={ClipboardCheck} label="FSRS Dashboard" />
            </nav>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 px-2">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Histórico</p>
              <History className="h-3 w-3 text-slate-600" />
            </div>
            <TutorV2History />
          </div>

          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4 px-2">Guidelines Ativas</p>
            <div className="space-y-2.5">
              <ContextBadge label="Harrison 21ed" color="bg-blue-500" />
              <ContextBadge label="SBC 2024" color="bg-emerald-500" />
              <ContextBadge label="Protocolo Feynman" color="bg-purple-500" />
            </div>
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 group hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-2 relative z-10">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sessão Atual</p>
              <ChevronRight className="h-3 w-3 text-slate-700 group-hover:text-indigo-400 transition-colors" />
            </div>
            <p className="text-[12px] text-white font-bold truncate leading-tight mb-1 relative z-10">{session.topic || "Exploração Médica"}</p>
            <div className="flex items-center gap-1.5 relative z-10">
              <div className="h-1 w-1 rounded-full bg-indigo-500" />
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{session.specialty || "Clínica Médica"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tutor V3 Online</p>
            </div>
            <Settings className="h-3.5 w-3.5 text-slate-600 hover:text-white transition-colors cursor-pointer" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3 w-3" />
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className={cn("text-[13px] font-black", color)}>{value}</span>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active = false, count }: { icon: any; label: string; active?: boolean; count?: string }) {
  return (
    <button className={cn(
      "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
      active ? "bg-white/5 text-white shadow-lg border border-white/10 ring-1 ring-white/5" : "text-slate-500 hover:text-white hover:bg-white/5"
    )}>
      {active && <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500 rounded-r-full" />}
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", active ? "text-indigo-400" : "text-slate-600 group-hover:text-indigo-400")} />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      {count && (
        <Badge variant="outline" className="h-4 px-1.5 text-[8px] border-indigo-500/20 bg-indigo-500/10 text-indigo-400 font-black">
          {count}
        </Badge>
      )}
    </button>
  );
}

function ContextBadge({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
      <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );
}
