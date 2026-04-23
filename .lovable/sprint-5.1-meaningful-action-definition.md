# Sprint 5.1 — Definição Oficial de "Ação Pedagógica Real"

**Data:** 2026-04-23
**Status:** ✅ regra filosófica congelada
**Autor da decisão:** usuário (validada após audit técnico de telemetria)
**Aplica-se a:** `first_meaningful_action` em `behavioral_telemetry`

---

## Princípio fundador

A baseline da Sprint 5.1 NÃO mede:

- ❌ interesse
- ❌ exploração
- ❌ curiosidade
- ❌ navegação
- ❌ discovery

A baseline mede UMA coisa só:

> 🧠 **Entrada em estado ativo de aprendizagem.**

Tudo o que NÃO for entrada em estado ativo de aprendizagem **NÃO conta** como `first_meaningful_action`, mesmo que o usuário tenha clicado, navegado, scrollado ou aberto um módulo.

---

## Critério único e universal

Uma ação é `first_meaningful_action` **se e somente se**:

> O usuário iniciou uma **atividade cognitiva ativa** de estudo.

Não importa o ponto de entrada (Dashboard, Estudar, ENAFLIX, IA, Bottom Nav, Sidebar). Importa apenas se houve execução pedagógica real.

---

## Tabela oficial: o que conta vs. o que não conta

### ✅ CONTA como `first_meaningful_action`

| Ação | entry_point típico | action_kind |
|---|---|---|
| Iniciar missão diária | `visao_geral` / `bottom_nav` | `start_mission` |
| Continuar missão em andamento | `mission_resume` | `resume_mission` |
| Iniciar tema de estudo | `estudar` | `start_topic` |
| Iniciar revisão FSRS | `estudar` / `bottom_nav` | `start_review` |
| Iniciar simulado | `estudar` | `start_simulado` |
| Abrir banco de erros **para revisar** (não só visualizar) | qualquer | `open_errors` |
| Iniciar sessão de flashcards | qualquer | `open_flashcards` |
| Continuar sessão pedagógica salva | qualquer | `continue_session` |
| Usar Tutor IA **pedagogicamente** (pergunta de estudo, explicação, revisão de erro, mini-quiz) | `ia` | `open_tutor` |
| ENAFLIX → clicar **"Iniciar revisão / Começar tema / Resolver questões / Abrir em modo estudo"** | `enaflix` | um dos kinds acima |

### ❌ NÃO CONTA

| Ação | Por quê |
|---|---|
| Navegar entre rotas | navegação ≠ estudo |
| Abrir menus, sidebar, bottom nav | exploração de UI |
| Scroll em qualquer lista | passivo |
| Abrir o painel da IA sem fazer pergunta pedagógica | testar interface |
| Conversar com Tutor IA fora de contexto de estudo | chat social/curiosidade |
| ENAFLIX: scroll em carrossel, abrir catálogo, navegar módulos, assistir preview, browsing | **discovery, não execução** |
| Abrir banco de erros só para olhar | visualização ≠ revisão |
| Visualizar dashboard, métricas, gráficos | leitura de status |

---

## A separação crítica do ENAFLIX

ENAFLIX é o caso mais delicado porque mistura **descoberta** e **execução** no mesmo módulo.

A regra é binária:

- 🎬 **ENAFLIX em modo discovery** → não conta. Mede interesse, não estudo.
- 🧠 **ENAFLIX em modo execução** (botão explícito de "Iniciar / Começar / Resolver / Continuar") → conta.

> O momento em que ENAFLIX deixa de ser catálogo e vira sessão pedagógica é o momento que a baseline registra.

---

## A separação crítica da IA

O painel de IA também tem dois modos:

- 🤖 **IA como interface aberta** (clicar, ver agentes, testar prompts) → não conta.
- 🧠 **IA como ferramenta cognitiva ativa** (pergunta de estudo, explicação de tema, revisão de erro, mini-quiz, raciocínio guiado) → conta.

> Abrir o tutor não é estudar. **Usar o tutor para entender algo é estudar.**

---

## Implicações operacionais (NÃO executar agora — só registrar)

Quando, no futuro, decidirmos instrumentar ENAFLIX e IA, os pontos de captura DEVERÃO ser:

### ENAFLIX — instrumentar APENAS:
- Botão "Iniciar revisão"
- Botão "Começar tema"
- Botão "Resolver questões"
- Botão "Continuar sessão"
- Botão "Abrir módulo em modo estudo"

NÃO instrumentar: cliques em cards de discovery, hovers, plays de preview, abertura de catálogo.

### IA — instrumentar APENAS:
- Envio de mensagem ao Tutor **dentro de um contexto pedagógico** (tema selecionado, questão em revisão, erro sendo discutido)
- Início de mini-quiz pelo tutor
- Pedido de explicação sobre tema curricular
- Revisão de erro via tutor

NÃO instrumentar: abertura do painel, troca de agente, mensagens sociais/curiosidade sem âncora pedagógica.

---

## Estado atual (NÃO mudar nada agora)

| Módulo | Instrumentado hoje | Conta corretamente? |
|---|---|---|
| Dashboard → MissionStartButton | ✅ sim | ✅ sim — é `start_mission` legítimo |
| /estudar → OperationalHub | ✅ sim | ✅ sim — start de execução real |
| /enaflix | ❌ não | ✅ correto: discovery não conta |
| /ai (livre) | ❌ não | ✅ correto: chat sem âncora pedagógica não conta |
| /ai (dentro de sessão) | ❌ não | ⚠️ gap conhecido — mas não instrumentar agora |

> **Decisão:** o sistema permanece congelado. Nenhuma instrumentação nova até a baseline atual emergir naturalmente. A ausência de eventos em ENAFLIX/IA está **metodologicamente correta** sob esta definição.

---

## Por que essa decisão protege a baseline

1. **Integridade**: separa execução de exploração — duas fenomenologias distintas.
2. **Comparabilidade**: futuras sprints poderão medir impacto sem confundir "mais cliques" com "mais estudo".
3. **Coerência cognitiva**: alinha a métrica ao que o ENAZIZI realmente otimiza (aprendizagem, não tempo de tela).
4. **Validade futura**: se um dia adicionarmos um módulo novo, a regra já está pronta — basta perguntar "isso é entrada em estado ativo de aprendizagem?".

---

## Resumo em uma linha

> `first_meaningful_action` = o instante em que o aluno **deixa de explorar e começa a aprender**.
