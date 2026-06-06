
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  Brain, 
  Target, 
  Activity, 
  CheckCircle2, 
  XCircle,
  FileText,
  Zap,
  Dna,
  Scale,
  GraduationCap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ShadowAudit {
  scores: {
    clinical: number;
    security: number;
    communication: number;
    enare: number;
    management: number;
    cognitive: number;
  };
  report: {
    strengths: string[];
    weaknesses: string[];
    critical_errors: string[];
    improvement_plan: string;
  };
  recovery_data: {
    questions_enare: any[];
    recovery_case_summary: string;
    flashcards_fsrs: any[];
  };
}

export const ShadowExaminerPanel = ({ simulationId }: { simulationId?: string }) => {
  const [audit, setAudit] = useState<ShadowAudit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!simulationId) return;
    
    const fetchAudit = async () => {
      const { data, error } = await supabase
        .from('hospital_shadow_audits')
        .select('*')
        .eq('simulation_id', simulationId)
        .maybeSingle();
        
      if (data) {
        setAudit({
          scores: data.scores,
          report: data.report,
          recovery_data: data.recovery_data
        } as any);
      }
      setLoading(false);
    };

    fetchAudit();
  }, [simulationId]);

  if (loading) return <div className="p-8 text-center animate-pulse text-white/40 font-mono text-xs uppercase tracking-widest">Generating Shadow Report...</div>;
  if (!audit) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">Shadow Examiner Report</h2>
          <p className="text-[10px] text-white/40 uppercase font-mono">ENAZIZI V6 Independent Audit</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Clínico', score: audit.scores.clinical, icon: Target, color: 'text-blue-500' },
          { label: 'Segurança', score: audit.scores.security, icon: ShieldCheck, color: 'text-red-500' },
          { label: 'Comunicação', score: audit.scores.communication, icon: Activity, color: 'text-emerald-500' },
          { label: 'ENARE Style', score: audit.scores.enare, icon: Dna, color: 'text-yellow-500' },
          { label: 'Gestão', score: audit.scores.management, icon: Scale, color: 'text-blue-400' },
          { label: 'Cognitivo', score: audit.scores.cognitive, icon: Brain, color: 'text-purple-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 p-3 rounded-xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-black uppercase text-white/40 flex items-center gap-1">
                <s.icon className={`h-3 w-3 ${s.color}`} /> {s.label}
              </span>
              <span className={`text-xs font-black ${s.score >= 85 ? 'text-emerald-500' : 'text-amber-500'}`}>{s.score}</span>
            </div>
            <Progress value={s.score} className="h-1 bg-white/5" indicatorClassName={s.color.replace('text', 'bg')} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="py-3">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Pontos Fortes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.report.strengths.map((s, i) => (
              <div key={i} className="text-[10px] text-white/60 leading-relaxed">• {s}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="py-3">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <XCircle className="h-3 w-3 text-red-500" /> Erros Críticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.report.critical_errors.map((s, i) => (
              <div key={i} className="text-[10px] text-red-500/80 leading-relaxed">• {s}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="py-3">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <GraduationCap className="h-3 w-3 text-primary" /> Plano de Recuperação V6 (Auto-Triggered)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[10px] text-white/60 leading-relaxed italic">{audit.report.improvement_plan}</p>
          
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="bg-white/5 p-2 rounded-lg text-center">
              <div className="text-[10px] font-black text-primary">{audit.recovery_data.questions_enare.length}</div>
              <div className="text-[8px] uppercase text-white/40">Questões</div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg text-center">
              <div className="text-[10px] font-black text-primary">{audit.recovery_data.flashcards_fsrs.length}</div>
              <div className="text-[8px] uppercase text-white/40">Flashcards</div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg text-center">
              <div className="text-[10px] font-black text-primary">01</div>
              <div className="text-[8px] uppercase text-white/40">Caso de Recuperação</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShadowExaminerPanel;
