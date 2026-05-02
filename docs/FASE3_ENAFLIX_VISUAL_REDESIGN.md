# Fase 3 — Redesign Cinematográfico ENAFLIX (UX/UI)

> Apenas camada visual. Backend, edge functions, RLS, signed URLs, lógica de
> publicação, checklist persistido e telemetria (`tutor_lesson_events`) **não foram alterados**.

## Telas alteradas

| Tela | Antes | Depois |
|------|-------|--------|
| `src/pages/admin/AdminLessonsMemory.tsx` | Painel administrativo clássico em lista vertical com cards densos, sem hero, busca isolada, ações empilhadas. | **Central de Produção ENAFLIX** — hero cinematográfico com counters, tabs Netflix, busca premium glassmorphism, grid de cards cinematográficos com hover zoom, badges com glow, drawer lateral com abas (Resumo / Conteúdo / Prompts / Ações). |

> Player (`VideoLessonPlayer.tsx`) e Biblioteca do aluno (`MyLessonsPage.tsx`)
> permanecem na linha visual ENAFLIX já implementada anteriormente; serão
> aprofundados em iteração seguinte para evitar regressão sobre o player atual
> (1107 linhas, componentização ainda em progresso).

## Componentes novos

Em `src/components/enaflix/admin/`:

- **`ProductionHeroHeader.tsx`** — hero com gradiente animado, glows ambientais (violet + fuchsia), eyebrow ENAFLIX • Studio, contadores animados (Total / Publicadas / Estruturando / Aguardando).
- **`ProductionTabs.tsx`** — tabs horizontais estilo Netflix com indicador `motion.span` `layoutId` (transição spring entre estados), contagem por status.
- **`LessonStatusBadge.tsx`** — badges premium com ícone, cor e glow específicos para cada status (`structuring`, `pending_review`, `in_production`, `needs_adjustment`, `ready_to_publish`, `published`, `unpublished`, `archived`, `rejected`).
- **`LessonChecklistRing.tsx`** — anel de progresso SVG (stroke-dasharray animado) + 5 itens do checklist persistido (mantém keys `title_reviewed`, `content_reviewed`, `video_attached`, `no_hallucination`, `ready_to_publish`).
- **`LessonProductionCard.tsx`** (`React.memo`) — card cinematográfico com thumbnail grande, gradiente overlay, play button no hover, badges de status e IA, score pedagógico com dot pulsante, meta de duração e vídeo, animação fade+rise stagger.
- **`LessonDetailDrawer.tsx`** — Sheet lateral (Radix) com blur 2xl, glow ambiente, abas Resumo / Conteúdo / Prompts / Ações. Inclui:
  - `LessonChecklistRing` integrado.
  - Renderização condicional de objetivos, pegadinhas, capítulos, roteiro, flashcards e quiz vindos de `structured_content`.
  - **Action pills** glassmorphism para Reestruturar IA, NotebookLM, Gemini, Google Vids, Markdown, Subir vídeo, Preview seguro.
  - Botão de publicação com gradiente esmeralda e glow, desabilitando quando o checklist/upload não está completo (mesma regra antiga `canPublish`).

## Animações

- `framer-motion` com `initial/animate` em hero e contadores (stagger delay).
- `LessonProductionCard` faz fade + slide-up com easing `[0.22, 1, 0.36, 1]` (Apple-like).
- `whileHover={{ y: -4 }}` + scale-110 da thumbnail (700 ms) + revelação de overlay violeta + play button.
- `ProductionTabs` usa `motion.span layoutId` com spring para o indicador ativo (transição fluida estilo Netflix).
- Drawer e ScrollArea do Radix Sheet preservam motion nativa do Radix.

## Melhorias UX

- **Hero com contexto imediato**: o admin vê total, publicadas, estruturando e aguardando revisão sem precisar contar nos cards.
- **Tabs em vez de lista única**: filtra rapidamente por estado de produção sem digitar.
- **Drawer lateral em vez de tudo no card**: cards ficam respiráveis; ações pesadas (export, upload, publicar) ganham espaço dedicado e descritivo.
- **Estados visuais semânticos**: cada status tem cor e glow próprios, eliminando carga cognitiva.
- **Ações com hint** (ex.: "MP4, WebM, MOV, MKV ou AVI · até 500 MB") evitam erros antes do upload.
- **Bloqueio explicado**: rodapé do drawer mostra exatamente o que falta para publicar.

## Mobile

- Hero collapse: `text-3xl sm:text-5xl`, padding adaptativo `px-6 sm:px-10 py-10 sm:py-14`.
- Counters em `grid-cols-2 sm:grid-cols-4`.
- Grid de cards `1 / 2 / 3 / 4` colunas conforme breakpoint (sm/lg/xl).
- Filtros em coluna no mobile, linha no `lg:`.
- Drawer ocupa 100% do width no mobile (`w-full sm:max-w-2xl`).
- Tabs com `flex-wrap` para não estourar a viewport.

## Performance

- `LessonProductionCard` envolto em `React.memo`.
- Thumbnails com `loading="lazy"`.
- Tabs counters memoizados (`useMemo`) sobre `lessons`.
- Filtragem combinada (status + busca) memoizada.
- Drawer só monta seu conteúdo quando `open=true` (Radix Sheet).
- Stagger limitado a `Math.min(index * 0.04, 0.4)` para evitar atrasos longos com muitas aulas.
- Backdrops e glows usam `pointer-events-none` e `blur` via Tailwind (GPU).

## Backend / segurança preservados

- Mesmas queries `tutor_lesson_memory`, mesmo `select *`, mesma ordenação.
- Mesmas mutations: upload (Storage `tutor-lesson-videos`), update de `status`, `published_at`, `quality_checklist`.
- Mesmos eventos em `tutor_lesson_events`: `lesson_uploaded`, `lesson_ready_to_publish`, `lesson_published`.
- Mesmas edge functions invocadas: `tutor-lesson-signed-url`, `tutor-lesson-export`, `tutor-lesson-structure`.
- Mesmas validações pré-publish (`canPublish`).
- Sanitização de nome de arquivo idêntica.
- Limites idênticos (500 MB, MIME whitelist).

## Status final

- TypeScript: limpo (executado pelo harness).
- Build: limpo (executado pelo harness).
- Não há novas dependências; usa `framer-motion`, Radix Sheet/Tabs/ScrollArea, lucide-react já presentes.
