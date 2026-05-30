## Fase 1 revisada — Captura de Conhecimento + Validação GO/NO-GO

Acato integralmente a ressalva. A Fase 1 passa a começar com uma **auditoria pedagógica forense do V1**, antes de qualquer alteração de código. Nenhuma remoção, nenhuma deprecation suave, nenhuma edição em `ai-phase2-helpers.ts` ou no QR Mode acontece enquanto essa captura não estiver concluída e validada por você.

### Sequência da Fase 1 (read-only + 1 atualização de memória)

**1.1 — Auditoria de Nuances Exclusivas do V1** (read-only)
Vou ler em paralelo:
- `supabase/functions/reinforce-error/index.ts` (prompt completo + parsing).
- `supabase/functions/_shared/enazizi-prompt.ts` (prompt mestre do Tutor + builders).
- `supabase/functions/tutor-v2-chat/index.ts` (bloco `QUESTION_REVIEW_MODE` + `QUESTION_REVIEW_INSTRUCTION` + parser de metadados).

Para cada um dos 5 elementos que você listou, responder com evidência (arquivo:linha):

| Elemento V1 | Pergunta | Resposta esperada |
|---|---|---|
| Classificação de erro cognitivo (7 categorias) | Há enum fixo no Tutor? | Citação literal do trecho do Tutor que cobre ou não |
| Regra de ouro / memory anchor | Garantida explicitamente? | Idem |
| Formato compacto de correção | Existe modo compacto no Tutor? | Idem |
| Pergunta de fixação (Active Recall) | Obrigatória no Tutor? | Idem |
| Estrutura de feedback rápido | Existe contrato curto? | Idem |

Para cada elemento, classificar:
- 🟢 **Já garantido** — citar trecho do prompt do Tutor.
- 🟡 **Implícito / sujeito a drift** — recomendar adição literal ao prompt mestre.
- 🔴 **Ausente** — bloquear deprecation até migração.

**1.2 — Entrega da Matriz de Captura no chat** (texto/markdown direto, sem arquivos)
Conforme sua preferência de memória, todo o relatório é colado aqui no chat para você revisar antes de qualquer ação.

**1.3 — Registro do resultado em memória** (uma atualização)
Atualizar `mem://operacao/pos-freeze-v25-deprecation-reinforce-error` com:
- Resultado da auditoria de captura (5 elementos classificados).
- Lista final de trechos a migrar para `enazizi-prompt.ts` (se houver itens 🟡 ou 🔴).
- Critério GO atualizado para Fase 2: "0 itens 🔴 + 100% dos itens 🟡 migrados".

**1.4 — Reauditoria GO/NO-GO** (read-only)
Reconfirmar com dados frescos:
- Telemetria `function_edge_logs` para `reinforce-error` nos últimos 60 d.
- Ausência de novos consumidores (re-rodar `rg` sobre `reinforce-error`, `StudyLoop*`, `useStudyLoop`).
- Estabilidade do `tutor-v2-chat` (sem regressão no QR Mode).

**1.5 — Decisão de avanço para Fase 2**
Eu **não** avanço para Fase 2 automaticamente. Entrego o relatório completo no chat e aguardo sua autorização explícita.

### O que esta Fase 1 NÃO faz

- ❌ Não edita `enazizi-prompt.ts`, `tutor-v2-chat`, `reinforce-error` nem nenhum prompt.
- ❌ Não remove componentes, hooks ou edge functions.
- ❌ Não toca em `ai-phase2-helpers.ts`, `k6-load-test.js`, `scripts/check-edge-imports.ts`.
- ❌ Não cria migrations, RLS, tabelas, rotas ou componentes.
- ❌ Não desconecta `MissionQuickActions`.

Únicas escritas: 1 atualização em `mem://operacao/pos-freeze-v25-deprecation-reinforce-error` ao final, registrando o resultado da captura.

### Resultado esperado

Relatório forense colado no chat com:
1. Trecho literal do prompt V1 que define cada elemento.
2. Trecho literal do prompt do Tutor que cobre (ou não) cada elemento.
3. Veredito 🟢/🟡/🔴 por elemento.
4. Lista pronta de patches textuais a aplicar no prompt mestre **na Fase 2**, se houver lacuna.
5. Confirmação dos critérios GO ainda válidos.

Após sua revisão e autorização explícita, a Fase 2 (deprecation suave) pode ser planejada.