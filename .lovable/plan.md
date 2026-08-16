# AUDITORIA SOMENTE LEITURA — Capacidade de deploy da `question-generator`

Resposta objetiva às 4 perguntas, com fatos do estado atual do repositório e do projeto conectado.

## (1) Supabase project ref conectado

- **Ref:** `qszsyskumcmuknumwxtk`
- Confirmado em `supabase/config.toml` → `project_id = "qszsyskumcmuknumwxtk"` (único `config.toml`, auto-gerado, não alterado).
- Este é o mesmo ref do painel de backend do projeto. Nenhum outro projeto Supabase está referenciado no código.

## (2) Capacidade/autorização para implantar a `question-generator` a partir do código no GitHub

- **Sim, sem criar projeto/rota/função paralela.** A função já existe no repositório:
  - `supabase/functions/question-generator/index.ts` (23.576 bytes)
  - `supabase/functions/question-generator/difficulty-quota.ts`
  - `supabase/functions/question-generator/__tests__/contract.test.ts`
- `supabase/config.toml` já contém o bloco `[functions.question-generator]` com `verify_jwt = false` (mantém o padrão do projeto).
- **Worktree está limpa** (`git status --short` vazio); HEAD = `9a38a4556 Fast Visual Edit`. O código no GitHub == código local; um deploy implantaria exatamente o que está versionado.
- **Sem `deno.lock`** em `supabase/` nem na raiz → menor risco de falha por lockfile incompatível.
- Último commit que tocou `question-generator/index.ts`: `ad6dc6be6 fix(simulados): govern official board readiness (#40)`.

> Observação de capacidade: o deploy de Edge Functions neste ambiente é feito pela ferramenta `supabase functions deploy` (Lovable Cloud). O `service_role` key e a senha do banco **não estão disponíveis** no Lovable Cloud, mas **não são necessários** para `functions deploy` — este usa as credenciais de gerenciamento do projeto, já configuradas. Portanto a implantação é viável.

## (3) Ação exata para implantar somente essa função

Uma única ação, sem tocar em código, migrations, rotas ou outras funções:

```bash
supabase functions deploy question-generator \
  --project-ref qszsyskumcmuknumwxtk \
  --no-verify-jwt
```

Pontos:
- Implanta **apenas** `question-generator` (as 220+ outras funções não são afetadas).
- `--no-verify-jwt` mantém `verify_jwt = false` (já é o estado atual e o padrão do projeto — não introduz regressão).
- Não cria nova rota nem função paralela: a rota `https://qszsyskumcmuknumwxtk.functions.supabase.co/question-generator` já existe e seria apenas atualizada.
- Não exige `service_role` key nem senha do banco.
- Não exige alteração no `config.toml` (o bloco já existe).

## (4) Deploy/publish do frontend também implanta Edge Functions?

- **Não.** Publish do frontend (Vite/React) implanta apenas os artefatos estáticos do cliente (HTML/JS/CSS) no host do preview/published. É uma pipeline separada e não aciona `supabase functions deploy`.
- Edge Functions só são implantadas via `supabase functions deploy` (explicitamente, por função), ou, em projetos gerenciados, pelo fluxo gerenciado pelo Lovable Cloud que orquestra o deploy de funções — **independente** do publish do frontend.
- Portanto, para atualizar a `question-generator` no backend é necessário executar o deploy da função (item 3); um publish do frontend **não** o fará.

## Proposta de ação (uma única etapa, read-only respeitado)

Se aprovado, executar **somente** o deploy da função `question-generator` conforme item (3), sem editar arquivos, sem criar migration e sem publish de frontend. Nada mais.

Se preferir manter read-only total: ignorar/skipar — nenhum deploy será feito.
