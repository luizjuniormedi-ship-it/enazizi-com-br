import { useState } from "react";
import { Sparkles, Wand2, Activity, Info, Loader2, Zap, GraduationCap, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { simulateHighStudyActivity } from "@/lib/enaflixSimulation";
import { generateP2LessonBatch } from "@/lib/p2BatchGeneration";
import { toast } from "sonner";

interface Props {
  userId?: string;
}

const AdminAutomationLab = ({ userId }: Props) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSimulate = async (topic: string) => {
    if (!userId) {
      toast.error("Usuário não identificado.");
      return;
    }
    setLoading(topic);
    try {
      await simulateHighStudyActivity(userId, topic);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="border-violet-500/20 bg-[#13131e]/50 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-white">ENAFLIX Automation Lab</CardTitle>
              <CardDescription className="text-white/50 text-xs">
                Simule comportamentos reais de estudo para testar a engine de videoaulas.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Engine Online</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Simuladores de comportamento */}
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2 mb-1">
                <Wand2 className="h-4 w-4 text-violet-300" />
                Simuladores de Estudo Real
              </h4>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Cada ação simula 30min de estudo no Tutor IA, erros recorrentes e interação profunda. 
                Isso deve disparar a geração automática após atingir o threshold de 85pts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!loading}
                className="bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-400/40 text-[10px] gap-2 py-4 h-auto flex-col"
                onClick={() => handleSimulate("Insuficiência Cardíaca")}
              >
                {loading === "Insuficiência Cardíaca" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Activity className="h-3 w-3" /> Insuf. Cardíaca</>}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!loading}
                className="bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-400/40 text-[10px] gap-2 py-4 h-auto flex-col"
                onClick={() => handleSimulate("IAM (Infarto Agudo)")}
              >
                {loading === "IAM (Infarto Agudo)" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Zap className="h-3 w-3" /> IAM Agudo</>}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!loading}
                className="bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-400/40 text-[10px] gap-2 py-4 h-auto flex-col"
                onClick={() => handleSimulate("Câncer de Próstata")}
              >
                {loading === "Câncer de Próstata" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wand2 className="h-3 w-3" /> CA de Próstata</>}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!loading}
                className="bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-400/40 text-[10px] gap-2 py-4 h-auto flex-col"
                onClick={() => handleSimulate("Neonatologia")}
              >
                {loading === "Neonatologia" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3" /> Neonatologia</>}
              </Button>
            </div>
          </div>

          {/* Engine Status & Batch Actions */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/10 space-y-3">
              <h4 className="font-bold text-sm text-violet-200 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Lote P2: Clínica & Pediatria
              </h4>
              <p className="text-[10px] text-violet-200/60 leading-tight">
                Gere automaticamente 41 aulas baseadas nos temas das provas P2. 
                Cada tema terá seu próprio roteiro e prompts individuais.
              </p>
              <Button 
                onClick={() => generateP2LessonBatch(userId || "")}
                disabled={!!loading}
                className="w-full bg-violet-500 hover:bg-violet-600 text-white font-black text-[10px] uppercase tracking-tighter h-9 gap-2 shadow-[0_0_15px_-3px_rgba(139,92,246,0.5)]"
              >
                <BookOpen className="h-3.5 w-3.5" /> Iniciar Produção em Lote (P2)
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-300" />
                Engine Intelligence
              </h4>
...
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Geração Threshold</span>
                <span className="text-xs font-black text-white">85 / 100</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Deduplicação</span>
                <span className="text-xs font-black text-emerald-400">ATIVO</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Rollout Control</span>
                <span className="text-xs font-black text-violet-400">ADMIN ONLY</span>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Info className="h-3.5 w-3.5 text-white/30 shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/30 leading-tight">
                Aulas geradas automaticamente aparecerão em "Memória Aulas" (tutor-lessons) com o selo "Uso Real".
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminAutomationLab;
