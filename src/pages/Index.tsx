import React from 'react';

const WarRoomDashboard = () => {
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
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm">
      <div className="max-w-4xl mx-auto whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
};

export default WarRoomDashboard;
