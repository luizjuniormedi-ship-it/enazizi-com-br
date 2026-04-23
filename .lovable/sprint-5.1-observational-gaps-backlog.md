# Sprint 5.1 — Backlog Metodológico de Gaps Observacionais

**Data:** 2026-04-23
**Status:** 📋 backlog congelado — **NÃO implementar agora**
**Depende de:** baseline oficial v1 publicada (ver `sprint-5.1-baseline-contract.md`)
**Definição governante:** `sprint-5.1-meaningful-action-definition.md`

---

## Por que esse documento existe

Ao oficializar a definição de `first_meaningful_action` como **"entrada em estado ativo de aprendizagem"**, identificamos áreas do produto onde existe — por design — **estudo cognitivo real que não é capturado pela telemetria atual**.

Esse documento **registra esses gaps** sem agir sobre eles, porque:

1. Instrumentar agora **mudaria a baseline antes de ela existir**.
2. Cada gap precisa de critério explícito de captura para não virar vanity metric.
3. A próxima sprint precisa começar de uma baseline **estável e comparável**.

> Regra de ouro: gap observacional conhecido > instrumentação prematura.

---

## Gaps oficialmente reconhecidos

### Gap #1 — Tutor IA em contexto pedagógico

| Campo | Valor |
|---|---|
| **Módulo** | `/ai` (Tutor IA) e TutorChatPanel embutido em sessões |
| **Estado atual** | ❌ não instrumentado |
| **Tipo de evento ausente** | `first_meaningful_action` com `action_kind = open_tutor` |
| **Critério de captura (futuro)** | Mensagem enviada ao Tutor **com âncora pedagógica**: tema selecionado, questão em revisão, erro sendo discutido, ou modo "missão" ativo |
| **NÃO capturar** | Abertura do painel, troca de agente, mensagens sociais/curiosidade sem âncora |
| **Por que esperar** | Discriminar "âncora pedagógica" exige heurística (presença de `sc_*` na URL, sessão ativa, ou contexto de erro) — definir antes de medir |
| **Risco se instrumentar agora** | Inflar `first_meaningful_action` com chats exploratórios → corromper baseline |

---

### Gap #2 — ENAFLIX em modo execução

| Campo | Valor |
|---|---|
| **Módulo** | `/enaflix` |
| **Estado atual** | ❌ não instrumentado (intencionalmente — discovery não conta) |
| **Tipo de evento ausente** | `first_meaningful_action` quando o usuário **sai de discovery e entra em execução** |
| **Critério de captura (futuro)** | Clique explícito em CTAs de execução: "Iniciar revisão", "Começar tema", "Resolver questões", "Continuar sessão", "Abrir módulo em modo estudo" |
| **NÃO capturar** | Scroll de carrossel, abertura de catálogo, hover em cards, play de preview, navegação entre módulos |
| **Por que esperar** | Os CTAs de execução precisam ser **inventariados e validados** um a um — instrumentar genericamente captaria discovery |
| **Risco se instrumentar agora** | Confundir "interesse" com "estudo" → métrica perde poder discriminativo |

---

### Gap #3 — Banco de Erros: visualização vs revisão

| Campo | Valor |
|---|---|
| **Módulo** | Banco de Erros (aba Proficiência) |
| **Estado atual** | ❌ não instrumentado |
| **Critério de captura (futuro)** | Início de **revisão ativa** de um erro (clique em "Revisar este erro", abertura de tutor sobre o erro, refazer questão) |
| **NÃO capturar** | Apenas abrir a aba e olhar a lista |
| **Por que esperar** | Distinguir "olhar" de "revisar" requer evento dedicado no fluxo de revisão |

---

### Gap #4 — Continuação de sessão pedagógica salva

| Campo | Valor |
|---|---|
| **Módulo** | `ResumeSessionBanner` (universal) |
| **Estado atual** | ⚠️ parcial — `mission_resume` existe como entry_point, mas não há captura sistemática de "continue_session" para sessões não-missão |
| **Critério de captura (futuro)** | Clique no banner de retomada de qualquer sessão (`module_sessions`) |
| **NÃO capturar** | Visualização do banner sem ação |
| **Por que esperar** | Validar primeiro se baseline atual já cobre a maioria dos retornos via outros entry_points |

---

### Gap #5 — Mini-quiz disparado pelo Tutor IA

| Campo | Valor |
|---|---|
| **Módulo** | Tutor IA (modo missão / sessão) |
| **Estado atual** | ❌ não instrumentado |
| **Critério de captura (futuro)** | Início de mini-quiz sugerido pelo tutor (resposta da primeira alternativa) |
| **NÃO capturar** | Sugestão exibida sem interação |
| **Por que esperar** | Depende de instrumentação do Gap #1 primeiro |

---

## Ordem de prioridade futura (quando destravar)

A ordem é definida por **densidade pedagógica esperada × risco de contaminação**:

| Ordem | Gap | Justificativa |
|---|---|---|
| 1º | Gap #2 (ENAFLIX execução) | CTAs explícitos = baixo risco de falso positivo, alto valor sinalizador |
| 2º | Gap #4 (continuação de sessão) | Captura retorno comprometido, baixa ambiguidade |
| 3º | Gap #1 (Tutor IA pedagógico) | Alto valor mas requer heurística cuidadosa de "âncora pedagógica" |
| 4º | Gap #3 (Banco de Erros revisão) | Requer evento dedicado, depende de UX já existir |
| 5º | Gap #5 (Mini-quiz tutor) | Depende do Gap #1 |

---

## Pré-condições para destravar QUALQUER gap

Nenhum gap deste backlog pode ser implementado antes que TODAS as condições abaixo sejam verdadeiras:

- [ ] Baseline oficial v1 publicada (critérios do `sprint-5.1-baseline-contract.md` atendidos)
- [ ] Faixas 🟢🟡🔴 aplicadas e congeladas como referência
- [ ] Decisão explícita do usuário de "destravar gap X"
- [ ] Documentação de que a instrumentação **cria uma nova baseline v2** — não substitui a v1

---

## Princípio de versionamento da baseline

Cada nova instrumentação **divide a história em duas eras**:

- **Baseline v1** — apenas pontos atualmente instrumentados (Dashboard MissionStartButton + /estudar OperationalHub)
- **Baseline v2** — após primeiro gap instrumentado
- **Baseline v3** — após segundo gap, etc.

Comparações entre eras devem ser feitas com cautela e documentadas explicitamente. Métricas dentro da mesma versão são comparáveis; entre versões, exigem normalização.

---

## O que NÃO está neste backlog (e por quê)

| Item | Por que está fora |
|---|---|
| Tracking de scroll, hover, tempo de permanência | Mede atenção, não aprendizagem |
| Tracking de abertura de painéis | Mede curiosidade, não estudo |
| Tracking de cliques agregados | Vanity metric — não responde "houve cognição ativa?" |
| Heatmaps de UI | Útil para UX, irrelevante para baseline pedagógica |
| Análise de funil clássica | Pressupõe modelo linear — aprendizagem não é linear |

---

## Resumo em uma linha

> O sistema **sabe o que não está medindo** — e essa consciência é mais valiosa, no estágio atual, do que medir tudo mal.
