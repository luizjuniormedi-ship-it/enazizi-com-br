## Resumo

<!-- O que muda e por quê. -->

## Escopo

- [ ] Mudança restrita ao que foi descrito acima
- [ ] Não inclui refactor amplo nem mudanças cosméticas fora do escopo

## Go-Live Structural Freeze

- [ ] Não alterei prompts
- [ ] Não alterei FSRS
- [ ] Não alterei memória pedagógica
- [ ] Não alterei Bank Guard
- [ ] Não alterei frontend sem necessidade
- [ ] Não alterei schema / RLS

## Generate Adaptive Simulado — Contract Gate

Obrigatório se o PR toca `supabase/functions/generate-adaptive-simulado/**`.

- [ ] Rodei ou validei o gate `Contract regression (21 scenarios)`
      (workflow `generate-adaptive-simulado Contract Gate`)
- [ ] `questions.length` nunca fica negativo
- [ ] `questions.length` nunca passa de 100
- [ ] `topics=[]` não causa crash
- [ ] `count` inválido cai para default seguro (10)
- [ ] Aliases `specialty` / `topic` / `selectedTopics` / `selectedSubtopics` preservados
- [ ] 401 sem auth preservado
- [ ] CORS `OPTIONS` preservado

Detalhes: [`docs/go-live/generate-adaptive-simulado-release-gate.md`](../docs/go-live/generate-adaptive-simulado-release-gate.md)

## Testes

<!-- Como validou (local, CI, edge function logs, etc.). -->
