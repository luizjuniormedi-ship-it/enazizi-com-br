# Auditoria + Reativação — Mapas Mentais

**Data:** 2026-04-27

---

## A) Auditoria — o que JÁ EXISTIA (e estava só desligado)

### Tabela
- ✅ `public.mental_maps` **EXISTE** (não `mind_maps`/`mind_map_nodes`/`mind_map_edges`).
  Schema: `id, user_id, title, content_json, source_topic, specialty, difficulty, source_type, tags, flashcards_count, questions_count, created_at, updated_at`.
- ✅ RLS por `auth.uid() = user_id` em SELECT/INSERT/UPDATE/DELETE.
- ✅ FKs: `flashcards.source_map_id` e `questions_bank.source_map_id` apontam para `mental_maps(id)`.
- ✅ Índices: `user_id`, `specialty`, GIN(`tags`).
- ✅ 2 mapas reais já gravados (Cardiologia / IAM).

### Edge functions (3 deployadas e funcionais)
- `generate-mind-map` — gera mapa via IA + persiste em `mental_maps`.
- `generate-map-flashcards` — converte mapa → flashcards + FSRS cards.
- `generate-map-questions` — converte mapa → questões em `questions_bank`.

### Frontend (1.441 linhas já prontas)
- `src/pages/MindMaps.tsx` (400 linhas) — listagem, busca, filtros, criação.
- `src/pages/MindMapFullscreen.tsx` (287 linhas) — viewer fullscreen, gerar flashcards/questões.
- `src/components/mind-maps/MindMapViewer.tsx` (461) — canvas/leitura.
- `src/components/mind-maps/MindMapNode.tsx` (107).
- `src/components/mind-maps/MindMapDetailPanel.tsx` (96).
- `src/components/mind-maps/MapSuggestions.tsx` (90).

### Libs já instaladas
- ✅ `@xyflow/react` v12.10.2 (React Flow moderno).
- ❌ Não instaladas: reactflow (legacy), excalidraw, mermaid, zustand, konva, d3, cytoscape, dagre.
  → A implementação atual NÃO depende de canvas pesado — usa render hierárquico próprio em `MindMapViewer`.

### Causa raiz do "Em breve"
Comentário no `App.tsx` dizia "tabelas mind_maps* não existem" — verdade técnica enganosa, porque a tabela real chama-se **`mental_maps`** (singular do conceito). O módulo foi desligado por engano na Fase 0.

### Diagnóstico
| Item | Estado | Ação |
|---|---|---|
| Tabela | ✅ existe | nenhuma |
| RLS | ✅ correta | nenhuma |
| Edge functions | ✅ 3 ativas | nenhuma |
| Páginas | ✅ prontas | nenhuma |
| Components | ✅ prontos | nenhuma |
| Rotas | ❌ redirecionadas para "coming_soon" | **reativar** |
| QuickAction | ❌ `comingSoon: true` | **remover flag** |
| Tipos faltando | nenhum | nenhuma |
| Migração nova | não necessária | nenhuma |

---

## B) Ativação mínima aplicada

### Arquivos alterados
1. **`src/App.tsx`** (linhas 192-200)
   - Removido `<Navigate to="/dashboard?mind_maps=coming_soon">`.
   - Restaurado `<Route path="mapas-mentais" element={<MindMaps />} />`.
   - Restaurado `<Route path="/dashboard/mapas-mentais/:id" element={<MindMapFullscreen />} />`.
   - Imports `MindMaps`/`MindMapFullscreen` já existiam (lazy).

2. **`src/components/dashboard-v2/QuickActionsPanel.tsx`** (linha 32-33)
   - Removido `comingSoon: true` do quick action "Mapas Mentais".
   - Removido comentário Fase 0.

### Tabelas
- **Nenhuma criada** — `mental_maps` já existe.
- **Nenhuma migração nova** — schema, RLS, FKs e índices estão completos.

### Funcionalidades agora ativas (já implementadas no código existente)
- ✅ Listagem dos mapas do usuário (com filtro/busca/ordenação).
- ✅ Criação de mapa via dialog (tema + especialidade + dificuldade) → IA + persistência.
- ✅ Viewer fullscreen com painel detalhado, navegação por nó.
- ✅ Geração derivada: flashcards (FSRS) e questões (questions_bank) a partir do mapa.
- ✅ Exclusão de mapa (cascade SET NULL nos derivados).
- ✅ Persistência em `mental_maps` + isolamento por RLS.

### Não mexido (intencional)
- ❌ Adaptive engine / `study-next` / `study-orchestrator` — sem alteração.
- ❌ FSRS engine — sem alteração (cards gerados via fluxo antigo já existente, idêntico ao previamente operante).
- ❌ Shadow Adaptive Layer — sem ativação.
- ❌ Telemetria nova — não adicionada.
- ❌ `studyEngine.ts`, planners — sem mudança.

### Verificação
```
rg "shadowAdaptive|shadow-adaptive" supabase/functions/study-next \
  supabase/functions/study-orchestrator src/lib/studyEngine.ts
→ 0 matches (motores intactos)
```

### Build
```
npx tsc --noEmit  → 0 erros
```

### Dados existentes preservados
2 mapas previamente gravados em `mental_maps` (Cardiologia/IAM, 16-22/abr) voltam a aparecer ao usuário automaticamente.

---

## C) O que NÃO foi feito (e por quê)

| Item solicitado | Decisão | Motivo |
|---|---|---|
| Criar `mind_map_nodes` / `mind_map_edges` | ❌ não criado | Render atual usa árvore hierárquica em `content_json` (jsonb). Criar tabelas separadas seria duplicidade arquitetural. |
| Instalar React Flow | ❌ desnecessário | `MindMapViewer` atual não usa canvas pan/zoom — usa layout estruturado por categoria. `@xyflow/react` está disponível se quisermos evoluir depois. |
| Editor drag/drop | ❌ fora do escopo mínimo | Atualmente o mapa é gerado por IA + lido. Edição manual node-a-node fica para uma Fase 2 do módulo. |
| Telemetria / shadow events | ❌ não adicionado | Respeita o freeze observacional da baseline. |

---

## Conclusão

🟢 **Mapas Mentais reativado em 2 edits cirúrgicos** (App.tsx + QuickActionsPanel).
Todo o backend, RLS, edge functions e UI já existiam e estavam funcionais — só precisavam ser religados. Nenhuma tabela criada. Nenhum motor pedagógico/adaptativo tocado. Baseline preservada.
