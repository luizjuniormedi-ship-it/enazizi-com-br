import { 
  History, 
  Settings, 
  BookOpen, 
  Target, 
  Brain, 
  AlertTriangle, 
  ClipboardCheck,
  Zap,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import TutorV2History from "./TutorV2History";

interface TutorV2SidebarProps {
  session: any;
}

export default function TutorV2Sidebar({ session }: TutorV2SidebarProps) {
  return (
    <aside className="w-72 border-r border-white/5 bg-slate-950 flex flex-col hidden xl:flex">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider leading-none">Tutor V2</h2>
            <p className="text-[10px] text-indigo-500 font-black uppercase mt-1 tracking-widest">Medical Intelligence</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">Módulos Inteligentes</p>
            <nav className="space-y-1">
              <SidebarItem icon={Target} label="Mission Control" active count="12" />
              <SidebarItem icon={BookOpen} label="Quality Map" />
              <SidebarItem icon={AlertTriangle} label="Error Bank" count="4" />
              <SidebarItem icon={Zap} label="Smart Planner" />
              <SidebarItem icon={ClipboardCheck} label="FSRS Dashboard" />
            </nav>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">Histórico Recente</p>
            <TutorV2History />
          </div>

          <div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">Contexto Clínico</p>
            <div className="space-y-2">
              <ContextBadge label="Harrison 21ed" color="bg-blue-500" />
              <ContextBadge label="SBC 2024" color="bg-emerald-500" />
              <ContextBadge label="Medicina Baseada em Evidências" color="bg-purple-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 group hover:border-indigo-500/30 transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sessão Atual</p>
            <ChevronRight className="h-3 w-3 text-slate-700 group-hover:text-indigo-400 transition-colors" />
          </div>
          <p className="text-[11px] text-white font-bold truncate leading-tight mb-1">{session.topic || "Exploração Médica"}</p>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{session.specialty || "Geral"}</p>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cloud V2 Online</p>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ icon: Icon, label, active = false, count }: { icon: any; label: string; active?: boolean; count?: string }) {
  return (
    <button className={cn(
      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
      active ? "bg-white/5 text-white shadow-sm border border-white/5" : "text-slate-500 hover:text-white hover:bg-white/5"
    )}>
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
