import React from "react";
import { 
  CinematicCard, 
  CinematicMetric, 
  CinematicModule 
} from "./index";
import { 
  Activity, 
  Brain, 
  AlertTriangle, 
  BarChart3, 
  Timer,
  ShieldAlert,
  Zap,
  CheckCircle2,
  HelpCircle,
  FileSearch,
  Users,
  Film
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CMEExplainableScore {
  type: string;
  score: number;
  explanation: string;
  factors: string[];
  risks: string[];
  recommendations: string[];
}

interface CMEPlaybackHotspot {
  id: string;
  type: 'replay_hotspot' | 'fatigue_zone' | 'abandon_zone' | 'quiz_difficulty' | 'tutor_hotspot';
  friction_score: number;
  timestamp: string;
  details: string;
}

interface CMECinematicDashboardProps {
  projectId?: string;
  activeBenchmark?: string;
  similarityScore?: number;
  qualityScores?: CMEExplainableScore[];
  hotspots?: CMEPlaybackHotspot[];
  governanceStatus?: 'draft' | 'review' | 'approved' | 'published';
}

export const CMECinematicDashboard: React.FC<CMECinematicDashboardProps> = ({
  projectId,
  activeBenchmark = "Benchmark Oficial v3.0",
  similarityScore = 84,
  qualityScores = [],
  hotspots = [],
  governanceStatus = 'review'
}) => {
  const module: CinematicModule = "enaflix";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header com Status de Governança */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            CME Cinematic Engine v3.0
          </h2>
          <p className="text-muted-foreground text-sm">Orquestração e Auditoria de Performance Cognitiva Audiovisual</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest flex items-center gap-2",
            governanceStatus === 'approved' ? "bg-green-500/10 border-green-500/20 text-green-500" :
            governanceStatus === 'review' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
            "bg-blue-500/10 border-blue-500/20 text-blue-500"
          )}>
            <ShieldAlert className="h-3 w-3" />
            Status: {governanceStatus}
          </div>
          <button className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all">
            Validar Benchmark
          </button>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CinematicMetric
          label="Similarity Score"
          value={`${similarityScore}%`}
          subtitle={`Ref: ${activeBenchmark}`}
          icon={Activity}
          module={module}
          trend={{ value: "4%", direction: "up" }}
        />
        <CinematicMetric
          label="Pacing Efficiency"
          value="92%"
          subtitle="Otimizado por Adaptive Timing"
          icon={Timer}
          module={module}
        />
        <CinematicMetric
          label="Cognitive Load"
          value="Balanced"
          subtitle="Proteção contra fadiga ativa"
          icon={Brain}
          module={module}
        />
        <CinematicMetric
          label="Retention Projection"
          value="88%"
          subtitle="Baseado em Replay Hotspots"
          icon={BarChart3}
          module={module}
          trend={{ value: "12%", direction: "up" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scoring Explicável */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Explainable Quality Scores
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { type: 'Cinematic Score', score: 94, explanation: 'Narrativa visual em conformidade com o benchmark Pixar-style.' },
              { type: 'Narrative Flow', score: 88, explanation: 'Sequência lógica mantém atenção sem sobrecarga semântica.' },
              { type: 'Fatigue Protection', score: 91, explanation: 'Pacing reduzido em trechos de alta complexidade médica.' },
              { type: 'Semantic Continuity', score: 85, explanation: 'Conexões entre capítulos reforçadas pelo ACE.' },
            ].map((s, idx) => (
              <CinematicCard key={idx} variant="glass" module={module} pointerLight className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.type}</span>
                  <span className="text-2xl font-black text-primary">{s.score}%</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{s.explanation}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-green-500 font-bold uppercase">
                    <CheckCircle2 className="h-3 w-3" /> Fator: Pacing Adaptativo
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-amber-500 font-bold uppercase">
                    <AlertTriangle className="h-3 w-3" /> Risco: Drift Cognitivo no min 12
                  </div>
                </div>
              </CinematicCard>
            ))}
          </div>
        </div>

        {/* Cognitive Hotspots & Replay Intelligence */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Cognitive Hotspots
          </h3>
          <CinematicCard variant="glass" module={module} className="p-0 overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Filtro: Replay Excessivo</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {[
                { type: 'replay_hotspot', score: 0.85, time: '04:12', msg: 'Fricção alta em Fisiologia SRAA' },
                { type: 'fatigue_zone', score: 0.72, time: '18:45', msg: 'Queda de atenção após 15min' },
                { type: 'abandon_zone', score: 0.45, time: '22:10', msg: 'Abandono alto no Quiz 3' },
                { type: 'tutor_hotspot', score: 0.92, time: '08:30', msg: 'Abertura em massa do Tutor IA' },
              ].map((h, idx) => (
                <div key={idx} className="p-4 hover:bg-white/5 transition-colors group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold uppercase text-primary flex items-center gap-1">
                      <Timer className="h-3 w-3" /> {h.time}
                    </span>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                      h.score > 0.8 ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      Score: {h.score}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground mb-1">{h.msg}</p>
                  <p className="text-[10px] text-muted-foreground italic group-hover:text-primary transition-colors">
                    Sugerir variante: "Sprint" ou "Feynman"
                  </p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-primary/5 text-center">
              <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                Exportar Mapa de Fricção
              </button>
            </div>
          </CinematicCard>
        </div>
      </div>
      
      {/* Benchmarks Section */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          Cinematic Benchmarks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CinematicCard variant="glass" module={module} className="p-5 border-l-4 border-l-primary">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Benchmark Ativo</p>
                <p className="font-black">Estilo Pixar AAA</p>
              </div>
            </div>
          </CinematicCard>
          <CinematicCard variant="glass" module={module} className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <HelpCircle className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Acurácia Narrativa</p>
                <p className="font-black">98.2% vs Medical Expert</p>
              </div>
            </div>
          </CinematicCard>
          <CinematicCard variant="glass" module={module} className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Pacing Adaptativo</p>
                <p className="font-black">Ativo (Lvl 3)</p>
              </div>
            </div>
          </CinematicCard>
        </div>
      </div>
    </div>
  );
};