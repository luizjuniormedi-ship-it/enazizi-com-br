
## Study Engine V3 — Volume + Exam Pressure

### O que já existe (não mexer)
- `coverageEngine.ts` + boost `+12` 🎯 no studyEngine
- `monthlyGoalEngine.ts` (mês corrente) + boost `+8` 📈 quando `paceStatus === "behind"`
- `MonthlyGoalCard` no GuidedFlowLayer

### O que falta e será adicionado

#### 1. `src/lib/questionGoalEngine.ts` (NOVO)
Função pura `getQuestionGoalStatus(userId, examDate?)` — janela rolante de 30d (não calendário):
- `questions_30d` ← `COUNT(practice_attempts WHERE created_at >= now()-30d)`
- `target = 2000`, `backlog = max(0, target - questions_30d)`
- `days_left = min(diasAtéFimDoMês, diasAtéProva)` (mínimo 1)
- `daily_target = ceil(backlog / days_left)`
- `status: "ok" | "behind"`

Por que separar de `monthlyGoalEngine`: aquele usa mês-calendário e dirige o card UI. Este usa janela rolante 30d e dirige o motor — semânticas diferentes, prompt explicitamente pede esta lógica.

#### 2. `src/lib/examPressureEngine.ts` (NOVO)
Função pura `getExamPressure(examDate)`:
- `> 90d` → `{ pressure_level: "low", multiplier: 1.0 }`
- `30–90d` → `{ pressure_level: "medium", multiplier: 1.3 }`
- `< 30d` → `{ pressure_level: "high", multiplier: 1.6 }`
- Sem prova → `multiplier: 1.0`

#### 3. `src/lib/studyEngine.ts` (PATCH cirúrgico)
Imediatamente após o bloco existente do `monthlyGoalEngine` (linha ~1116), adicionar **um novo bloco**:
```ts
try {
  const { getQuestionGoalStatus } = await import("./questionGoalEngine");
  const { getExamPressure } = await import("./examPressureEngine");
  const examDate = profileData?.exam_date || mentorExamDate;
  const goal = await getQuestionGoalStatus(userId, examDate);
  const exam = getExamPressure(examDate);

  for (const rec of recs) {
    const t = (rec.type || "").toLowerCase();
    const isQuestionType = t === "practice" || t === "simulado" || t === "error_review";
    const isNewContent = t === "new";

    // (a) Volume: backlog rolante 30d
    if (goal.status === "behind" && isQuestionType) {
      rec.priority = cap(rec.priority + 20);
      if (!rec.reason.includes("📊")) rec.reason = `📊 ${rec.reason}`;
    }
    if (goal.backlog > 500 && isQuestionType) {
      rec.priority = cap(rec.priority + 10);
    }

    // (b) Pressão da prova
    if (exam.multiplier !== 1.0) {
      rec.priority = cap(rec.priority * exam.multiplier);
    }

    // (c) Conteúdo novo perto da prova → reduz
    if (exam.days !== null && exam.days < 30 && isNewContent) {
      rec.priority = cap(rec.priority - 15);
      if (!rec.reason.includes("⏱️")) rec.reason = `⏱️ ${rec.reason}`;
    }
  }
} catch (e) {
  console.warn("[StudyEngine] question goal / exam pressure skipped:", e);
}
```
Tudo em `try/catch` — qualquer falha não quebra o motor (mesmo padrão dos sinais já existentes).

#### 4. `src/hooks/useQuestionGoal.ts` (NOVO)
`useQuery` simples chamando `getQuestionGoalStatus`, staleTime 5min — para a UI.

#### 5. `src/components/dashboard/guided/QuestionsGoalCard.tsx` (NOVO)
Card compacto no `GuidedFlowLayer` (ao lado do `MonthlyGoalCard`):
- Linha 1: `840 / 2000 questões (30d)`
- Linha 2: `Meta diária: 70/dia` (do `daily_target`)
- Se `status === "behind"`: alerta amarelo *"Você está abaixo da meta de questões para aprovação"*
- CTA → `/dashboard/simulados`

Adicionar `<QuestionsGoalCard />` no grid de `GuidedFlowLayer.tsx`, mantendo `MonthlyGoalCard` (mostram visões complementares: mês vs janela rolante).

### Garantias (regras críticas respeitadas)
- ✅ Sem schema novo, sem migration, sem edge function
- ✅ Sem alterar FSRS, Tutor, Coverage, MonthlyGoal, GuidedFlowLayer (apenas append)
- ✅ Sem remover lógica existente do studyEngine — só append no final do pipeline de boosts
- ✅ Lê apenas `practice_attempts` + `profiles.exam_date` (já consultados ou no `coreData`)
- ✅ `try/catch` defensivo em volta do bloco

### Arquivos
**Novos (4):** `src/lib/questionGoalEngine.ts`, `src/lib/examPressureEngine.ts`, `src/hooks/useQuestionGoal.ts`, `src/components/dashboard/guided/QuestionsGoalCard.tsx`
**Editados (2):** `src/lib/studyEngine.ts` (append ~30 linhas), `src/components/dashboard/GuidedFlowLayer.tsx` (1 import + 1 linha JSX)

### Validação final
- `npx tsc --noEmit` deve continuar em 0 erros
- Cenários cobertos: novo (sem prova → mult 1.0), atrasado (+20 nos questions), próximo da prova (×1.6 + new −15), avançado (status ok → sem boost)
