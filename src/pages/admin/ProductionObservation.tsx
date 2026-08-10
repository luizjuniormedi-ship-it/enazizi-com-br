import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `
# WAR ROOM — D1 PRODUCTION DOGFOOD | ENAZIZI.COM

## MODO DE EXECUÇÃO
\`\`\`text
PRODUCTION OBSERVATION — DAY 1
READ-ONLY AUDIT
REAL USER SIMULATION
ZERO FEATURE DEVELOPMENT
ZERO PREVENTIVE REFACTOR
\`\`\`

## MISSÃO
Executar o primeiro Dogfood autenticado da janela oficial de 14 dias do ENAZIZI, simulando usuários reais e procurando regressões funcionais, pedagógicas, de segurança, persistência, performance e UX.

Baselines oficiais:
\`\`\`text
FASE_2_CERTIFICATION_REPORT.md
PRODUCTION_OBSERVATION_GUARD.md
\`\`\`

---

# REGRA ABSOLUTA
NESTA EXECUÇÃO:
\`\`\`text
❌ NÃO corrigir código
❌ NÃO alterar banco
❌ NÃO alterar RLS
❌ NÃO alterar cron
❌ NÃO alterar flags
❌ NÃO trocar providers
❌ NÃO alterar prompts
❌ NÃO criar features
❌ NÃO refatorar
\`\`\`

Permitido:
\`\`\`text
✅ navegar
✅ clicar
✅ responder questões
✅ criar dados normais de teste via UI
✅ consultar banco em modo read-only
✅ consultar logs
✅ consultar network
✅ consultar console
✅ executar healthchecks
\`\`\`

# PERSONA A — ALUNO REAL
Executar login real. Validar /login -> /dashboard.

# A1 — DASHBOARD
Validar saudação, missão, Readiness, flashcards, revisões, Planner, recomendações.

# A2 — PLANNER
Abrir, iniciar, concluir missão. Validar persistência.

# A3 — TUTOR V3 — IAM
Perguntar: "Explique o diagnóstico e a conduta inicial no IAM com supra de ST."

# A4 — TROCA DE TEMA
Mudar para "Sepse". Perguntar: "Qual a abordagem inicial do choque séptico?"

# A5 — TUTOR AUTH
Testar chamada sem JWT -> Esperado 401.

# A6 — PROVIDER AI
Registrar provider real (logs/trace).

# A7 — SIMULADO IAM #1
Criar simulado (10 questões, IAM). Bloquear Pericardite, IC, etc.

# A8 — SIMULADO IAM #2
Repetir. Calcular overlap.

# A9 — SIMULADO COMPLETO
Responder e errar 1. Validar finalização.

# A10 — RECOVERY LOOP
Validar Erro -> Bank -> Recovery -> Flashcard -> FSRS.

# A11 — FLASHCARDS
Validar Due UI == Due DB.

# A12 — BANCO DE ERROS
Treinar erro. Validar persistência.

# A13 — MNEMÔNICOS
Gerar. Adicionar.

# A14 — RESULTADOS OFICIAIS
Validar badges e RLS.

# A15 — MODO PLANTÃO
Iniciar caso. Validar motor fisiológico.

# PERSONA B — PROFESSOR
Validar /professor.

# B1 — PROFESSOR SIMULADO
Criar simulado de teste.

# B2 — PROVIDER PROFESSOR
Validar provider real.

# PERSONA C — ADMIN
Validar /admin, dogfood-monitor, etc.

# C1 — ALPHA COHORT
Validar ALPHA_2026.

# C2 — OFFICIAL OUTCOMES
Validar tiers.

# C3 — DOGFOOD MONITOR
Garantir dados reais.

---
`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: PRODUCTION OBSERVATION
          </h1>
          <p className="text-zinc-500 mt-1">Status: Day 1 — Active Observation Mode</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400">READ-ONLY</Badge>
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">STABILITY FREEZE</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <Cpu className="h-3 w-3" /> Edge Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-500">DADOS INSUFICIENTES</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Auth Integrity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-500">OPERATIONAL</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Active Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-zinc-400">0 P0 / 0 P1</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500">Session Drift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-500">STABLE</div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[60vh] rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="max-w-4xl mx-auto whitespace-pre-wrap leading-relaxed opacity-80">
          {content}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProductionObservationPage;
