
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLearningScience } from "@/hooks/useLearningScience";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { 
  Beaker, TrendingUp, AlertTriangle, Target, 
  Zap, Brain, History, Award, CheckCircle2,
  Activity, Info
} from 'lucide-react';
import { motion } from 'framer-motion';

export const LearningScienceCenter: React.FC = () => {
  const snapshot = useLearningScience();

  if (!snapshot) {
    return (
      <div className="p-8 text-center animate-pulse">
        <Beaker className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-xl font-medium">Calibrando Motores de Evidência Científica...</p>
      </div>
    );
  }

  const riskColor = {
    low: 'text-emerald-500',
    medium: 'text-amber-500',
    high: 'text-orange-500',
    critical: 'text-destructive'
  }[snapshot.riskIndex.level];

  const riskBg = {
    low: 'bg-emerald-500/10',
    medium: 'bg-amber-500/10',
    high: 'bg-orange-500/10',
    critical: 'bg-destructive/10'
  }[snapshot.riskIndex.level];

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
              <Beaker className="w-3 h-3 mr-1" /> PHASE LS-1
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              VALIDATED_AT: {new Date(snapshot.validatedAt).toLocaleTimeString()}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Science Center</h1>
          <p className="text-muted-foreground">Sistema de Evidência Científica e Validação Cognitiva</p>
        </div>
        
        <div className="flex gap-2">
          {snapshot.telemetryTags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-[10px] font-mono opacity-70">
              {tag}
            </Badge>
          ))}
        </div>
      </header>

      {/* Hero Section: Readiness & Approval Gap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden border-primary/20 relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Readiness & Approval Science
            </CardTitle>
            <CardDescription>Correlação atual com desempenho real: {Math.round(snapshot.forecastAccuracy * 100)}%</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-muted/20 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                  <motion.circle 
                    className="text-primary stroke-current" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    fill="transparent" 
                    r="40" cx="50" cy="50" 
                    strokeDasharray="251.2"
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * snapshot.readiness) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{Math.round(snapshot.readiness)}%</span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Readiness</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-6 w-full">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium">Approval Gap (Target: 78%)</span>
                    <span className="text-2xl font-bold text-primary">-{snapshot.approvalGap}pts</span>
                  </div>
                  <Progress value={snapshot.readiness} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    "Este gap representa a distância estatística para a zona de aprovação segura."
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <span className="text-[10px] uppercase text-muted-foreground block mb-1">Learning Velocity</span>
                    <span className="text-xl font-bold text-emerald-500">+{snapshot.learningVelocity.currentVelocity}</span>
                    <span className="text-[10px] ml-1 opacity-70">pts/mês</span>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <span className="text-[10px] uppercase text-muted-foreground block mb-1">Transfer Score</span>
                    <span className="text-xl font-bold">{snapshot.transferScore}%</span>
                    <span className="text-[10px] ml-1 opacity-70">fidelity</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Engine */}
        <Card className={`border-none ${riskBg} ring-1 ring-inset ring-foreground/5`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${riskColor}`} />
                Risk Index
              </CardTitle>
              <Badge variant="outline" className={`${riskColor} border-current uppercase text-[10px]`}>
                {snapshot.riskIndex.level}
              </Badge>
            </div>
            <CardDescription>Detecção proativa de falhas cognitivas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center pb-2">
              <span className={`text-5xl font-black ${riskColor}`}>{snapshot.riskIndex.score}</span>
              <span className="text-xs text-muted-foreground block">SCORE DE RISCO (0-100)</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">FSRS Backlog</span>
                <span className={snapshot.riskIndex.factors.fsrsBacklog > 50 ? 'text-orange-500 font-bold' : ''}>
                  {snapshot.riskIndex.factors.fsrsBacklog} itens
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Learning Velocity</span>
                <span className={snapshot.riskIndex.factors.velocity < 0 ? 'text-destructive font-bold' : 'text-emerald-500 font-bold'}>
                  {snapshot.riskIndex.factors.velocity} pts
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Error Bank Density</span>
                <span>{snapshot.riskIndex.factors.errorBankCount} pendentes</span>
              </div>
            </div>
            
            <div className="pt-2">
              <p className="text-[11px] leading-relaxed opacity-80">
                {snapshot.riskIndex.level === 'low' 
                  ? "Sinais vitais pedagógicos estáveis. Baixa probabilidade de queda de rendimento."
                  : "Sinais de fadiga ou esquecimento detectados. Recomenda-se intervenção via Tutor Recovery."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Yield and Attribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              Learning Yield Engine
            </CardTitle>
            <CardDescription>{snapshot.learningYield.formula}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Retenção', val: snapshot.learningYield.retention, fill: '#8884d8' },
                  { name: 'Acertos', val: snapshot.learningYield.accuracy, fill: '#82ca9d' },
                  { name: 'Recovery', val: snapshot.learningYield.recovery, fill: '#ffc658' },
                  { name: 'Velocity', val: snapshot.learningVelocity.currentVelocity * 5, fill: '#ff8042' },
                ]}>
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                    { [0,1,2,3].map((entry, index) => (
                      <Cell key={`cell-${index}`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Yield Score Geral</span>
                <div className="text-2xl font-bold">{snapshot.learningYield.score}</div>
              </div>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                MAX_EFFICIENCY
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Feature Attribution Score
            </CardTitle>
            <CardDescription>Impacto de cada ferramenta na aprovação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {snapshot.featureAttributions.map((attr, i) => (
                <div key={attr.feature} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{attr.feature}</span>
                    <span className="text-muted-foreground">+{attr.gainScore}pts ({attr.contributionPercentage}%)</span>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <motion.div 
                      className="h-full bg-amber-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${attr.contributionPercentage}%` }}
                      transition={{ delay: i * 0.1, duration: 1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Decay & Tutor Impact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="w-4 h-4 text-primary" />
              Knowledge Decay Forecast (FSRS Logic)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                  <tr>
                    <th className="px-4 py-2">Especialidade</th>
                    <th className="px-4 py-2">Força Atual</th>
                    <th className="px-4 py-2">Previsão (9d)</th>
                    <th className="px-4 py-2">Decaimento</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.knowledgeDecay.map(item => (
                    <tr key={item.topic} className="border-b">
                      <td className="px-4 py-3 font-medium">{item.topic}</td>
                      <td className="px-4 py-3">{item.currentStrength}%</td>
                      <td className="px-4 py-3 text-destructive font-semibold">{item.predictedStrengthIn9Days}%</td>
                      <td className="px-4 py-3">-{Math.round(item.decayRate * 100)}%</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/30">
                          {item.riskStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/10 italic">
                    <td colSpan={5} className="px-4 py-2 text-[10px] text-muted-foreground text-center">
                      Baseado em curvas de esquecimento reais e intervalos do algoritmo FSRS.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Brain className="w-4 h-4 text-primary" />
              Tutor Impact Science
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <span className="text-[10px] text-muted-foreground block uppercase">Diferencial Tutor</span>
                <span className="text-3xl font-bold text-primary">+{snapshot.tutorImpact.improvementDelta}pts</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Award className="w-6 h-6" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Sua Readiness (C/ Tutor)</span>
                  <span className="font-bold">{snapshot.tutorImpact.userTutorReadiness}%</span>
                </div>
                <Progress value={snapshot.tutorImpact.userTutorReadiness} className="h-1 bg-primary/20" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Média (S/ Tutor)</span>
                  <span className="font-bold opacity-70">{snapshot.tutorImpact.nonUserTutorReadiness}%</span>
                </div>
                <Progress value={snapshot.tutorImpact.nonUserTutorReadiness} className="h-1 opacity-20" />
              </div>
            </div>
            
            <div className="pt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Recovery: {snapshot.tutorImpact.recoverySuccessRate}%</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Domínio {snapshot.tutorImpact.masteryTimeReduction}% rápido</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="flex items-center justify-between border-t pt-4 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-4">
          <span>[ENAZIZI_CORE_V6.1]</span>
          <span>[AUDIT_STATUS: CERTIFIED]</span>
        </div>
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>Métricas baseadas em modelos preditivos com Erro &lt; 10%</span>
        </div>
      </footer>
    </div>
  );
};

export default LearningScienceCenter;
