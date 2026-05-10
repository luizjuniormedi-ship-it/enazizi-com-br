# Auditoria UX — CME Mobile (produção)

> **Status:** documentação apenas. **Nenhum código produtivo alterado.**
> **Execução:** primeira tarefa pós-freeze (a partir de 25/05/2026).
> **Decisão:** override freeze recusado — risco de regressão pré-GO-LIVE.

---

## 1. Problema observado

O CME está vazando arquitetura interna para o usuário final em mobile:

- Termos técnicos visíveis na UI:
  - `TutorCME_Pipeline`
  - `Semantic Planning`
  - `GPU Rendering`
  - Queue IDs / Worker names
  - Internal stages / failure stack
  - Recovery engine names
- Mensagens cruas como:
  - "Nenhuma mensagem encontrada para processar."
  - "Falha no componente TutorCME_Pipeline."
- Modal mobile denso demais (overflow, telemetria visível, CTA secundário disputando espaço).
- Toast técnico duplicado embaixo do modal.
- Recovery engine acionado automaticamente sem contexto amigável.
- Retry automático em loop sem feedback claro.

---

## 2. Risco

| Risco | Impacto |
|---|---|
| Confunde usuário final | Alto — termos técnicos em pt/en misturados |
| Sensação de erro grave | Alto — passa instabilidade do produto |
| Expõe arquitetura interna | Médio — informa concorrência sobre stack/pipeline |
| Quebra percepção premium do Tutor/CME | Alto — usuário paga por experiência polida |
| Mobile iPhone | Crítico — modal e toast competindo por safe-area |

---

## 3. Correção planejada (pós-freeze)

### 3.1 Separar modos
- `production-user`: UI limpa, mensagens humanas, zero termo técnico.
- `admin-observability`: pipeline visível, stages, queue IDs, recovery engine — **apenas perfis admin**.
- `dev`: tudo ligado em `import.meta.env.DEV`.

Implementação sugerida: hook `useCMEUXMode()` retornando `"user" | "admin" | "dev"`, com gate único em todos componentes do CME.

### 3.2 Humanizar mensagens
| Atual (cru) | Novo (amigável) |
|---|---|
| "Nenhuma mensagem encontrada para processar." | "A sessão ainda está sendo preparada. Tente novamente em alguns instantes." |
| "Falha no componente TutorCME_Pipeline" | "Ocorreu uma instabilidade temporária na geração da aula." |
| "Recovery engine ativado" | "Recuperando sua sessão…" |
| "Worker queue empty" | "Aguardando início da geração…" |
| "GPU rendering failed" | "Não conseguimos preparar a visualização agora." |

Centralizar em `src/cme/ux/userMessages.ts` (criar pós-freeze).

### 3.3 Modal mobile
- Reduzir altura (max-height ≤ 80dvh).
- Reduzir densidade visual (2 informações por linha no máximo).
- Esconder telemetria técnica em modo `user`.
- `overflow-y: auto` no corpo, header/footer fixos.
- Foco no CTA principal — secundários como link discreto.
- Aplicar `<HeaderSafe>` / `<FooterSafe>` (já preparados em `src/mobile-hardening/`).

### 3.4 Retry seguro
- Limitar retries automáticos a **2 tentativas**.
- Após o limite: parar auto-retry e mostrar botão "Tentar novamente" amigável.
- Backoff exponencial visível (sem stack técnico).
- Impedir loop infinito por watchdog `useRef<number>` contando tentativas.

### 3.5 Toasts
- Compactos (max 2 linhas, `max-w-[calc(100vw-32px)]` no mobile).
- Nunca incluir nome de componente, worker, stage, queue.
- Auto-dismiss em 3.5s.
- De-duplicar via `id` estável (sonner já suporta).
- Substituir por `<SafeToastViewport>` (já preparado em `src/mobile-hardening/`).

### 3.6 Logs técnicos — destinos corretos
- `console.debug` em DEV.
- Sentry / observability dashboard.
- CME admin panel (rota futura `/admin/cme/observability`).
- **Nunca** no DOM de produção.

### 3.7 Mobile iPhone
- `safe-area-inset-top` no header do modal.
- `safe-area-inset-bottom` no footer/CTA.
- `<KeyboardSafeContainer>` se houver input no modal.
- CTA principal sempre visível (sticky no footer do modal).

---

## 4. Restrições durante o freeze (até 24/05/2026)

❌ **NÃO** tocar nada listado abaixo:
- `TutorCME` componentes ativos
- Modais CME em produção
- Toasts globais (`sonner` configurado)
- Pipeline/recovery engine
- Mensagens de erro existentes
- Lógica de retry atual

✅ Permitido:
- Documentar (este arquivo).
- Preparar arquivos novos isolados em `src/cme/ux/_drafts/` se necessário, **sem importar**.
- Adicionar mensagens humanas em arquivo de fixtures sem ativar.

---

## 5. Plano de execução pós-freeze

| Ordem | Tarefa | Risco |
|---|---|---|
| 1 | Criar `useCMEUXMode()` + gate `<UserModeOnly>` / `<AdminModeOnly>` | Baixo |
| 2 | Criar `src/cme/ux/userMessages.ts` com tabela 3.2 | Nulo |
| 3 | Substituir mensagens cruas pelas humanas (1 componente por PR) | Baixo |
| 4 | Aplicar `<HeaderSafe>`/`<FooterSafe>` no modal CME mobile | Baixo |
| 5 | Trocar Toaster global por `<SafeToastViewport>` | Médio |
| 6 | Implementar retry com watchdog + CTA manual | Médio |
| 7 | Mover telemetria para `/admin/cme/observability` | Médio |
| 8 | Suite Playwright cobrindo: nenhum termo técnico em modo user | Baixo |

---

## 6. Critério de aceitação pós-freeze

- ✅ Usuário final nunca vê: pipeline names, worker names, queue IDs, stage names, stack traces.
- ✅ Toda mensagem de erro tem versão humana em pt-BR.
- ✅ Modal CME mobile cabe em viewport iPhone SE (375×667) sem scroll técnico.
- ✅ Retry automático nunca passa de 2 tentativas.
- ✅ Toasts não invadem safe-area nem ficam duplicados.
- ✅ Modo admin acessa toda telemetria via painel dedicado.

---

## 7. Referências cruzadas

- `.lovable/audit-cross-screen-dead-buttons.md` — auditoria mobile prévia
- `.lovable/backlog-pos-freeze-mobile-hardening.md` — Fase 2 backlog
- `src/mobile-hardening/` — infra preparada (HeaderSafe, FooterSafe, SafeToastViewport, KeyboardSafeContainer)
- `tests/e2e/mission-mobile-buttons.spec.ts` — template de teste mobile

---

**Owner pós-freeze:** primeira tarefa após 25/05/2026.
**Estimativa:** 2-3 dias de trabalho focado, 1 PR por etapa do plano (8 PRs pequenos).
