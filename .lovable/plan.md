## Desativar Freeze v25

Encerrar oficialmente o **Operational Governance Freeze v25** e liberar a execução do plano de deprecation controlada do `reinforce-error`.

### Ações

1. **Atualizar `mem://index.md`** — remover do bloco **Core** a linha do Freeze v25 (`OPERATIONAL GOVERNANCE FREEZE v25 (ACTIVE)...`) e a entrada correspondente na lista **Memories** (`[Operational Governance Freeze v25]`).
2. **Atualizar `mem://constraint/operational-governance-freeze-v25`** — marcar como `ENCERRADO em 2026-05-30`, preservando histórico (motivo de criação, checkpoints atingidos, decisão de encerramento) mas deixando claro que não está mais ativo.
3. **Registrar nova memória `mem://operacao/pos-freeze-v25-deprecation-reinforce-error`** — apontar que, com o freeze encerrado, o plano oficial de deprecation controlada do `reinforce-error` (4 fases, 60 dias) está liberado para execução conforme decisão executiva anterior.

### Não incluso (intencional)

- Nenhuma alteração de código, schema, edge function, prompt ou rota.
- Nenhuma execução das fases de deprecation — apenas liberação de governança. A execução das Fases 1–4 será solicitada explicitamente em prompts futuros.
- Outros guard-rails ativos (Sprint 2.3, Go-Live Structural Freeze, LGPD Hardening, Escopo ProntoMedic, Dashboard Nomenclatura) permanecem **intactos**.

### Resultado

Freeze v25 oficialmente desativado nas memórias. Próximo passo natural: iniciar Fase 1 (Validação) do plano de deprecation quando você autorizar.