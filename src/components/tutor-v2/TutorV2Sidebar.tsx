import { 
  History, 
  Settings, 
  BookOpen, 
  Target, 
  Brain, 
  AlertTriangle, 
  ClipboardCheck,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TutorV2SidebarProps {
  session: any;
}

export default function TutorV2Sidebar({ session }: TutorV2SidebarProps) {
  return (
    <aside className="w-64 border-r border-white/5 bg-slate-950 flex flex-col hidden lg:flex">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider leading-none">Tutor V2</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Beta Experimental</p>
          </div>
        </div>

        <nav className="space-y-1">
          <SidebarItem icon={Target} label="Missão Atual" active />
          <SidebarItem icon={BookOpen} label="Clinical Quality" />
          <SidebarItem icon={AlertTriangle} label="Error Bank" />
          <SidebarItem icon={Zap} label="Planner Sync" />
          <SidebarItem icon={ClipboardCheck} label="FSRS Stats" />
          <SidebarItem icon={History} label="Histórico" />
        </nav>
      </div>

      <div className="mt-auto p-6">
        <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Sessão</p>
          <p className="text-[11px] text-white font-medium truncate">{session.title || "Sem título"}</p>
          <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-indigo-500 rounded-full" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({ icon: Icon, label, active = false }: { icon: any; label: string; active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active ? "bg-white/5 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
    )}>
      <Icon className={cn("h-4 w-4", active ? "text-indigo-400" : "text-slate-500 group-hover:text-indigo-400")} />
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
