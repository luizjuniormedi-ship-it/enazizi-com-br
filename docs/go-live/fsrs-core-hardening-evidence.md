# FSRS Core — Hardening Evidence (Wave 8)

## 1. Status executivo

`FSRS-CORE CONTRACT GATE READY — FREEZE SAFE`

Duas funções da camada de revisão/recuperação cobertas por bateria de contrato
HTTP e CI gate único. Zero alteração em código produtivo.

## 2. Funções cobertas

| Função | Status | Observação |
|---|---|---|
| `schedule-review` | `GO-LIVE READY` (Wave 8) | DEPRECATED (orphan) — hardening preserva contrato |
| `generate-recovery-flashcard` | `GO-LIVE READY` (Wave 8) | Pipeline ativo error → flashcard |

## 3. Bugs encontrados

Nenhum bug crítico. Achados:

- `schedule-review` (orphan/deprecated): `await req.json()` sem `.catch`, mas o top-level `try/catch` retorna `500 { error: e.message }` — controlado, sem stack. Helper de teste aceita esse 500 controlado.
- `generate-recovery-flashcard`: `topic?.toUpperCase()` poderia lançar `TypeError` para `topic` não-string, mas o `enterpriseEdgeHandler` envolve qualquer exceção num `500 { error: "INTERNAL_ERROR", message: "Erro interno no servidor." }` genérico (sem stack, sem `TypeError`, sem mensagem leakada). Contrato preservado.

## 4. Patches aplicados

Nenhum. **Zero alteração em `index.ts` produtivo.**

## 5. Cenários testados

`schedule-review` (9):
OPTIONS · 401 anônimo · JSON malformado · body vazio · campos obrigatórios ausentes · `tema_id` non-string · `was_successful: null` · uuid desconhecido · `accuracy` non-number.

`generate-recovery-flashcard` (9):
OPTIONS · 401 anônimo · JSON malformado · body vazio · `errorId`/`questionId` ausentes (400) · `errorId` non-string · `topic` non-string · uuid desconhecido · campos adversariais.

**Total: 18 cenários.**

## 6. Invariantes protegidos

- Nunca vaza `TypeError`, `Cannot read`, `toLowerCase`, `trim`, `"stack"`.
- 500 só é aceito se for resposta controlada (sem stack, sem mensagem crua de runtime).
- Algoritmo SR (D1→D90), risco/prioridade do `schedule-review` intocados.
- Local templates SEPSE/IAM/IC, `applyQualityGate`, `insertFlashcardsWithFsrs`, `FLASHCARD_MOTOR_PREMIUM`, AI runtime orchestrator intocados.
- Payloads inválidos NÃO criam revisões/cards órfãos: rejeitados antes de qualquer escrita.

## 7. Riscos remanescentes

- `schedule-review` permanece **DEPRECATED** (orphan). Hardening apenas garante segurança caso seja invocada; consolidação com FSRS oficial (`fsrs_cards` + `useFsrs`) continua pós-baseline.
- `generate-recovery-flashcard`: pipeline IA possui dependência externa (AI Gateway); falha externa é coberta pelo wrapper `runAI` + `enterpriseEdgeHandler`.
- Cobertura é de contrato HTTP; efeito colateral profundo (FSRS scheduler real, governança de flashcards) permanece sob auditoria pedagógica vigente.

## 8. Confirmação de freeze

Nenhuma alteração em:

- algoritmo FSRS / parâmetros / fórmula de agendamento;
- memória pedagógica;
- Event Bus;
- Planner;
- Tutor;
- Error Bank;
- prompts;
- frontend;
- schema;
- RLS;
- `index.ts` produtivo de qualquer função do FSRS Core;
- funções já travadas Waves 1–7.

Arquivos criados:

- `supabase/functions/schedule-review/__tests__/{contract.test.ts,README.md}`
- `supabase/functions/generate-recovery-flashcard/__tests__/{contract.test.ts,README.md}`
- `.github/workflows/fsrs-core-contract.yml`
- `docs/go-live/fsrs-core-hardening-evidence.md`

Arquivos atualizados:

- `docs/go-live/edge-functions-go-live-index.md`
- `docs/go-live/edge-functions-risk-triage-wave-1.md`

## 9. Status final

`FSRS-CORE CONTRACT GATE READY — FREEZE SAFE`
