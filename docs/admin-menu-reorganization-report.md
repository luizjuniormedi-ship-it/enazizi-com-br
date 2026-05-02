# Admin Menu Reorganization Report — ENAZIZI / ENAFLIX / CONCURFLIX

> Status: **Implementado (Fase 1)** · Sem remoção de rotas · Sem perda de funcionalidade
> Data: Maio/2026

---

## 1. Contexto

O painel administrativo cresceu para mais de 40 páginas distintas distribuídas em rotas
planas sob `/admin/*`, com 3 dashboards executivos paralelos (Admin, AdminCEO,
AdminMonitoring) e mais de 20 entradas técnicas (CME, GPU, Render Queues, Workers,
NotebookLM, Telemetria, etc.) misturadas com fluxos operacionais cotidianos.

Esta reorganização introduz uma **arquitetura de navegação enterprise** sem destruir
nada: rotas antigas continuam funcionando, código legado permanece intocado e a
nova hierarquia é puramente uma camada de UX/permissão.

---

## 2. Nova Arquitetura

### 2.1 Componentes adicionados

| Arquivo | Função |
|---|---|
| `src/hooks/useAdminScope.ts` | Deriva 4 escopos (super_admin, admin_pedagogico, admin_operacional, devops) das roles existentes em `user_roles` |
| `src/components/admin/sidebar/adminMenuConfig.ts` | Fonte única de verdade do menu admin: 6 categorias × N itens, com scopes/keywords/tooltips |
| `src/components/admin/sidebar/AdminSidebarEnterprise.tsx` | Sidebar nova: categorias colapsáveis, busca debounced, mobile drawer, modo collapsed icon-only |
| `src/components/layout/AdminLayout.tsx` | Shell exclusivo de `/admin/*` (substitui DashboardLayout aqui) |
| `src/pages/admin/CentroComando.tsx` | Visão executiva unificada (3 tabs reaproveitando Admin / CEO / Monitoring) |

### 2.2 Hierarquia de menu

```
Centro de Comando        (super_admin · admin_pedagogico · admin_operacional)
├── Dashboard Executivo  → /admin
├── Monitor de Alunos    → /admin/monitoring
└── Auditoria de Ações   → /admin/ai-audit-mode

Gestão de Conteúdo       (super_admin · admin_pedagogico)
├── Curadoria de Aulas        → /admin/lessons-memory
├── Banco de Questões         → /admin/medical-review-queue
├── Simulados & Provas        → /admin/banca-readiness
├── Biblioteca de Ativos      → /admin/video-lessons
└── Importação de Conteúdo    → /admin/ingestion-provas

Comunidade & Suporte     (super_admin · admin_operacional)
├── Usuários              → /admin/users (alias de /admin antigo)
├── Mensagens & Alertas   → /admin/telemetry
└── Feedbacks dos Alunos  → /admin/specialty-friction

Inteligência ENA         (super_admin · admin_pedagogico)
├── Tutor IA              → /admin/tutor-memory
├── Configurações IA      → /admin/ai-studio          [super_admin]
├── Motor Adaptativo      → /admin/adaptive-engine    [super_admin]
└── Custos IA             → /admin/medical-governance [super_admin]

Sistema                  (super_admin)
├── Feature Flags         → /admin/intervention-policies
├── Permissões & Papéis   → /admin#roles
├── Integrações           → /admin/notebooklm
└── Storage               → /admin/cme-media-monitor

Laboratório Técnico      (devops · super_admin)  [OCULTO p/ admins comuns]
├── CME / GPU             → /admin/cme-executive
├── Workers               → /admin/gpu-fleet
├── Render Queue          → /admin/render-queues
├── AI Router             → /admin/orchestrator-insights
├── Incident Ops          → /admin/cme-incidents
└── Ferramentas DEV       → /admin/system-checklist
```

### 2.3 Mapeamento de escopos → roles existentes

| Escopo | Roles que atendem (atual) | Observação |
|---|---|---|
| `super_admin` | `admin` | Acesso total |
| `admin_pedagogico` | `admin`, `professor`, `coordinator` | Conteúdo + alunos |
| `admin_operacional` | `admin`, `institutional_admin` | Usuários + suporte |
| `devops` | `admin` | Provisório — criar role `devops_admin` no futuro |

Sem migração de banco nesta fase: o mapeamento é puramente client-side via
`useAdminScope`. Quando criarmos as roles dedicadas, basta estender o hook.

---

## 3. Itens mantidos / renomeados / movidos

### 3.1 Mantidos sem alteração de rota
Todas as 50+ rotas `/admin/*` continuam acessíveis. Nada foi excluído.

### 3.2 Renomeados (label visível, rota inalterada)

| Rota | Label antigo | Novo label | Categoria |
|---|---|---|---|
| `/admin/lessons-memory` | "Curadoria de Aulas" (já correto) | Curadoria de Aulas | Gestão de Conteúdo |
| `/admin/medical-review-queue` | "Fila de Revisão" | Banco de Questões | Gestão de Conteúdo |
| `/admin/medical-governance` | "Dashboard BI" | Custos IA | Inteligência ENA |
| `/admin/cme-executive` | "Executivo CME" | CME / GPU | Laboratório Técnico |
| `/admin/cme-media-monitor` | "Monitor CME" | Storage | Sistema |
| `/admin/orchestrator-insights` | "Insights Orquestrador" | AI Router | Laboratório Técnico |
| `/admin/system-checklist` | "Checklist" | Ferramentas DEV | Laboratório Técnico |
| `/admin/intervention-policies` | "Políticas" | Feature Flags | Sistema |

### 3.3 Movidos para super_admin / devops (ocultos para operacional)

- Todas as rotas CME/GPU/Render Queue/Workers
- Cinematic Builder, CME Audit, CME Origins, CME Incidents
- AI Studio, Adaptive Engine, Adaptive Experiments
- Telemetry Health Check, Generator Telemetry, Granular Generator

### 3.4 Itens legados médicos (sem categoria nova)
Continuam acessíveis via deep-link mas não aparecem mais no menu principal:
- `/admin/validation`, `/admin/coverage`, `/admin/coverage-boost`
- `/admin/classification`, `/admin/classification-runner`, `/admin/classification-health`
- `/admin/curriculum-coverage`, `/admin/granular-generator`, `/admin/generator-telemetry`
- `/admin/simulado-selection`, `/admin/cme-status`, `/admin/cme-builder-audit`
- `/admin/notebooklm-sync`, `/admin/notebooklm-analytics`
- `/admin/knowledge-graph`, `/admin/cme-audit`, `/admin/cme-origins`

> Acesso preservado para operações pontuais. Próxima fase: decidir quais arquivar.

### 3.5 Aliases criados

| Alias | Destino | Motivo |
|---|---|---|
| `/admin/users` | Página `Admin` (gestão de usuários) | A raiz `/admin` agora é o Centro de Comando |
| `/admin/ingestion-network` | `AdminLessonsMemory` | Era 404 — corrigido para apontar à curadoria de aulas |

---

## 4. Mudanças visíveis ao usuário

1. **`/admin/*` agora usa um shell próprio** (`AdminLayout`) com a sidebar enterprise, ao invés do `DashboardLayout`.
2. **`DashboardSidebar` foi limpo**: removidos 7 atalhos admin inline (CME, GPU, Render, Audit, Builder, etc.); restou apenas "Painel Admin" → `/admin`.
3. **Centro de Comando** é a tela inicial em `/admin`, com 3 tabs (Executivo / Sistema & Alunos / Usuários) reaproveitando os 3 painéis antigos.
4. **Busca global de menus** disponível na sidebar admin (debounced, com loading e empty state).
5. **Categorias colapsáveis** com persistência em `localStorage`.
6. **Drawer mobile** para acesso completo em telas pequenas.
7. **Tooltips contextuais** explicam cada item para administradores não-técnicos.

---

## 5. Permissões & filtros aplicados

- Itens sem `scope` correspondente são **filtrados antes de renderizar** (não aparecem nem em busca).
- Categorias inteiras desaparecem quando vazias após filtro.
- Categoria "Laboratório Técnico" só aparece para `devops` (hoje = `admin` role).
- Categoria "Sistema" só aparece para `super_admin`.
- Fallback gracioso: se `useUserRoles` ainda está carregando, mostra spinner; se sem roles, exibe "Sem permissões administrativas".

---

## 6. O que **não** foi feito (intencional)

- ❌ Nenhuma rota foi deletada.
- ❌ Nenhum arquivo `.tsx` antigo foi removido.
- ❌ Nenhuma role nova foi criada no banco.
- ❌ Nenhum hard-delete de funcionalidade.
- ❌ DashboardLayout intocado para `/dashboard` e `/professor`.

---

## 7. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Usuário com bookmark em `/admin` esperando a página de gestão de usuários | Alias `/admin/users` aponta para a tela antiga; adicionar redirect 301 só após validação |
| Roles `coordinator` / `institutional_admin` podem ver itens inesperados | Mapeamento conservador: por padrão essas roles veem apenas Centro de Comando + áreas relacionadas |
| Categorias colapsáveis podem confundir usuários acostumados ao menu plano | Auto-expansão da categoria que contém a rota ativa |
| Perda de acesso rápido a CME/GPU para devs | Mantidos no Laboratório Técnico + busca global + URLs preservadas |

---

## 8. Próximos passos (Fase 2)

1. **Roles dedicadas no banco**: criar enum values `pedagogical_admin`, `ops_admin`, `devops_admin` em `app_role`.
2. **UI de gestão de roles**: tela em `/admin/users` para atribuir escopos.
3. **Arquivamento**: mover páginas legadas (validation, coverage, classification-*) para `_archive/admin/`.
4. **Telemetria de uso**: instrumentar cliques no menu para descobrir o que pode ser removido.
5. **Internacionalização**: extrair labels para um único arquivo i18n.
6. **Testes**: adicionar `Routes.test.tsx` para validar que cada item do menu resolve sem 404.

---

## 9. Resultado

Painel Admin reorganizado, com Centro de Comando unificado, hierarquia clara por
área de responsabilidade, busca global de menus, escopos de permissão e nenhuma
funcionalidade quebrada. Tudo o que existia continua existindo — apenas ficou
mais fácil de encontrar.
