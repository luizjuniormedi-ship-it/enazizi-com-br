# Release Gate — `generate-adaptive-simulado`

> Evidência final consolidada em [`generate-adaptive-simulado-final-evidence.md`](./generate-adaptive-simulado-final-evidence.md).


Trava obrigatória de release para a Edge Function `generate-adaptive-simulado`.
Compatível com **Go-Live Structural Freeze**.

## Objetivo

Impedir merge / deploy que quebre o contrato público da função:
sanitização de `count` e `topics`, aliases, autenticação, CORS, limite
máximo de 100 questões, ausência de crash runtime.

## Arquivos protegidos

- `supabase/functions/generate-adaptive-simulado/**`
- `.github/workflows/generate-adaptive-simulado-contract.yml`

## Workflow / Status check

| Item | Valor exato |
|---|---|
| Arquivo | `.github/workflows/generate-adaptive-simulado-contract.yml` |
| Workflow `name` | `generate-adaptive-simulado Contract Gate` |
| Job id | `contract` |
| Status check (Branch Protection) | `Contract regression (21 scenarios)` |

> Esse é o `jobs.<id>.name` exposto pelo GitHub como status check.
> Se o nome for alterado, atualizar a regra de Branch Protection.

## Como rodar localmente

**Sem token (MODE A — sempre roda):**
```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
```
Valida: 401, OPTIONS/CORS, no-crash estrutural.

**Com token (MODE B — bateria completa 21/21):**
```bash
USER_JWT=<jwt-real> deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
```

## Configurar o secret no GitHub

GitHub → **Settings → Secrets and variables → Actions → New repository secret**

| Nome | Valor |
|---|---|
| `SUPABASE_CONTRACT_USER_JWT` | JWT de usuário de teste (longo prazo) |

Opcional. Sem ele o workflow ainda gates os cenários públicos.

## Configurar Branch Protection (passos manuais)

1. GitHub → **Settings → Branches → Branch protection rules**
2. **Add rule** (ou editar a regra existente para `main` / `master`)
3. Marcar **Require status checks to pass before merging**
4. Marcar **Require branches to be up to date before merging**
5. Em **Status checks that are required**, buscar e selecionar:
   - `Contract regression (21 scenarios)`
6. Salvar

> O check só aparece na busca depois que o workflow rodou pelo menos
> uma vez em algum PR.

## Comportamento esperado em PR

- PR que toca `supabase/functions/generate-adaptive-simulado/**` dispara o gate.
- Sem o secret configurado: roda MODE A e gates contrato público.
- Com o secret configurado: roda MODE B (21/21).
- Falha do gate → merge bloqueado pela Branch Protection.

## O que fazer se o teste falhar

1. Ler o cenário que quebrou no log do Actions.
2. **Não** relaxar o teste para "passar".
3. Reverter a mudança que quebrou o contrato, **ou** aplicar patch
   mínimo na função preservando o contrato.
4. Reabrir o PR; o gate roda de novo automaticamente.

## Freeze confirmado

- prompts intactos
- FSRS intacto
- memória pedagógica intacta
- Bank Guard intacto
- frontend intacto
- schema intacto
- RLS intacto
- `index.ts` da função não alterado

`RELEASE PROTECTION READY — FREEZE SAFE`
